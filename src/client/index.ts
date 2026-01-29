import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
} from '@solana/web3.js';
import { PrivacyCash } from 'privacycash';
import { WasmFactory } from '@lightprotocol/hasher.rs';
import crypto from 'crypto';
import {
  X402ClientConfig,
  WalletAdapter,
  PaymentQuote,
  PaymentPayload,
  PrivateBalance,
  PaymentResult,
  BalanceProof,
  SolanaNetwork,
} from '../types';
import { EncryptionService } from '../utils/encryption';
import { InsufficientBalanceError } from '../errors';

/**
 * X402 Payment Client for Privacy Cash
 * Handles private payments for API access using Privacy Cash protocol
 */
export class X402PaymentClient {
  private config: X402ClientConfig;
  private connection: Connection;
  private wallet: WalletAdapter;
  private client: PrivacyCash | null = null;
  private encryptionService: EncryptionService | null = null;
  private initialized: boolean = false;
  private network: SolanaNetwork;

  constructor(config: X402ClientConfig) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl, 'confirmed');
    this.wallet = config.wallet;
    this.network = config.rpcUrl.includes('devnet') ? 'devnet' : 'mainnet-beta';
  }

  /**
   * Initialize the client - must be called before other operations
   * Signs a message to derive encryption keys
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('Initializing Privacy Cash SDK...');

    // Initialize WASM
    await WasmFactory.getInstance();

    // Get wallet signature for encryption
    const message = new TextEncoder().encode('Privacy Money account sign in');
    const signature = await this.wallet.signMessage(message);

    // Initialize encryption service
    this.encryptionService = new EncryptionService();
    this.encryptionService.deriveEncryptionKeyFromSignature(signature);

    // Initialize Privacy Cash client
    this.client = new PrivacyCash({
      RPC_url: this.connection.rpcEndpoint,
      owner: this.wallet.publicKey.toBase58(),
    });

    this.initialized = true;
    console.log('Privacy Cash SDK initialized');
  }

  /**
   * Get current private balance
   */
  async getPrivateBalance(): Promise<PrivateBalance> {
    this.ensureInitialized();

    const balance = await this.client!.getPrivateBalance();
    return {
      lamports: balance.lamports,
      sol: balance.lamports / LAMPORTS_PER_SOL,
    };
  }

  /**
   * Deposit SOL into Privacy Cash pool
   */
  async deposit(lamports: number): Promise<{ tx: string }> {
    this.ensureInitialized();

    console.log(`Depositing ${lamports / LAMPORTS_PER_SOL} SOL into Privacy Cash pool...`);

    const result = await this.client!.deposit({ lamports });

    console.log('Deposit successful!');
    console.log(`Transaction: ${result.tx}`);

    return { tx: result.tx };
  }

  /**
   * Generate payment headers for a quote
   * Returns headers to include in request to protected endpoint
   */
  async generatePayment(quote: PaymentQuote): Promise<{
    'X-Payment': string;
    'X-Privacy-Commitment': string;
    'X-Wallet-Address': string;
  }> {
    this.ensureInitialized();

    // Get current balance
    const balance = await this.getPrivateBalance();

    // Check if we have enough balance
    if (balance.lamports < quote.payment.amount) {
      throw new InsufficientBalanceError(quote.payment.amount, balance.lamports);
    }

    // Generate unique commitment
    const commitment = this.generateCommitment();
    const noteHash = this.hashNote(commitment);

    // Generate balance proof
    const balanceProof = this.generateBalanceProof(balance.lamports);

    // Create x402 payload
    const payload: PaymentPayload = {
      x402Version: 1,
      scheme: 'privacycash',
      network: `solana-${this.network}`,
      payload: {
        noteHash,
        commitment,
        timestamp: Date.now(),
        balanceProof,
      },
    };

    const xPaymentHeader = Buffer.from(JSON.stringify(payload)).toString('base64');

    return {
      'X-Payment': xPaymentHeader,
      'X-Privacy-Commitment': commitment,
      'X-Wallet-Address': this.wallet.publicKey.toBase58(),
    };
  }

  /**
   * Full payment flow: request quote, ensure balance, pay, return response
   */
  async payForAccess(url: string): Promise<PaymentResult> {
    this.ensureInitialized();

    console.log(`\nRequesting payment quote from ${url}...`);

    // Step 1: Request quote (expect 402)
    const quoteRes = await fetch(url);

    if (quoteRes.status !== 402) {
      // Already have access or error
      if (quoteRes.ok) {
        const data = await quoteRes.json();
        return { success: true, data };
      }
      throw new Error(`Unexpected status: ${quoteRes.status}`);
    }

    const quote = (await quoteRes.json()) as PaymentQuote;
    console.log('Payment Quote:', {
      recipient: quote.payment.recipientWallet,
      amount: `${quote.payment.amount / LAMPORTS_PER_SOL} SOL`,
    });

    // Step 2: Check balance and deposit if needed
    let balance = await this.getPrivateBalance();
    console.log(`Current private balance: ${balance.sol} SOL`);

    if (balance.lamports < quote.payment.amount) {
      console.log('Insufficient balance, depositing...');
      await this.deposit(quote.payment.amount);
      balance = await this.getPrivateBalance();
      console.log(`New private balance: ${balance.sol} SOL`);
    }

    // Step 3: Generate payment headers
    const headers = await this.generatePayment(quote);

    // Step 4: Make paid request
    console.log('Sending payment...');
    const paidRes = await fetch(url, { headers });

    if (!paidRes.ok) {
      const errorData = await paidRes.json();
      throw new Error(`Payment failed: ${JSON.stringify(errorData)}`);
    }

    const response = (await paidRes.json()) as { data: any; paymentDetails?: any };
    console.log('Payment verified! Access granted.');

    return {
      success: true,
      data: response.data,
      paymentDetails: response.paymentDetails,
    };
  }

  /**
   * Generate balance proof for server verification
   */
  private generateBalanceProof(balance: number): string {
    const proof: BalanceProof = {
      balance,
      timestamp: Date.now(),
      wallet: this.wallet.publicKey.toBase58(),
    };
    return Buffer.from(JSON.stringify(proof)).toString('base64');
  }

  /**
   * Generate unique commitment for this payment
   */
  private generateCommitment(): string {
    const data = `${this.wallet.publicKey.toBase58()}-${Date.now()}-${Math.random()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Hash the commitment for x402 header
   */
  private hashNote(note: string): string {
    return crypto.createHash('sha256').update(note).digest('hex');
  }

  /**
   * Ensure client is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.client) {
      throw new Error('Client not initialized. Call initialize() first.');
    }
  }

  /**
   * Get the underlying Privacy Cash client (for advanced usage)
   */
  getPrivacyCashClient(): PrivacyCash | null {
    return this.client;
  }

  /**
   * Get the encryption service (for advanced usage)
   */
  getEncryptionService(): EncryptionService | null {
    return this.encryptionService;
  }
}
