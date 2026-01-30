import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import crypto from 'crypto';
import { PrivacyCash } from 'privacycash';
import {
  X402ServerConfig,
  PaymentPayload,
  PaymentQuote,
  PendingPayment,
  BalanceProof,
  SolanaNetwork,
} from '../types';
import {
  X402Error,
  DoubleSpendError,
  InvalidPaymentError,
  InsufficientBalanceError,
  ExpiredBalanceProofError,
  NetworkMismatchError,
} from '../errors';
import { EncryptionService } from '../utils/encryption';
import { BALANCE_PROOF_VALIDITY_MS } from '../utils/constants';

/**
 * X402 Payment Server for Privacy Cash
 * Handles HTTP 402 payment verification with privacy-preserving payments
 */
export class X402PaymentServer {
  private config: X402ServerConfig;
  private connection: Connection;
  private usedCommitments: Set<string> = new Set();
  private pendingPayments: Map<string, PendingPayment> = new Map();
  private merchantClient: PrivacyCash | null = null;
  private encryptionService: EncryptionService | null = null;
  private withdrawalInterval: NodeJS.Timeout | null = null;
  private network: SolanaNetwork;

  constructor(config: X402ServerConfig) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl, 'confirmed');
    this.network = config.rpcUrl.includes('devnet') ? 'devnet' : 'mainnet-beta';

    // Initialize merchant client if keypair provided
    if (config.merchantKeypair) {
      this.initializeMerchant(config.merchantKeypair);
    }

    // Start withdrawal processor
    this.startWithdrawalProcessor();
  }

  /**
   * Initialize merchant Privacy Cash client for withdrawals
   */
  private async initializeMerchant(keypairBytes: Uint8Array): Promise<void> {
    try {
      const keypair = Keypair.fromSecretKey(keypairBytes);

      // Initialize encryption service
      this.encryptionService = new EncryptionService();
      this.encryptionService.deriveEncryptionKeyFromWallet(keypair);

      // Initialize Privacy Cash client
      this.merchantClient = new PrivacyCash({
        RPC_url: this.config.rpcUrl,
        owner: keypair,
      });

      console.log('Merchant Privacy Cash client initialized');
    } catch (error) {
      console.error('Failed to initialize merchant client:', error);
    }
  }

  /**
   * Create Express middleware for x402 payment flow
   */
  middleware(): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const xPaymentHeader = req.header('X-Payment');
      const commitment = req.header('X-Privacy-Commitment');
      const walletAddress = req.header('X-Wallet-Address');

      // No payment header - return 402 with quote
      if (!xPaymentHeader) {
        const quote = this.generateQuote();
        res.status(402).json(quote);
        return;
      }

      // Verify payment
      try {
        await this.verifyPayment(xPaymentHeader, commitment, walletAddress);
        // Payment verified - continue to protected endpoint
        next();
      } catch (error) {
        if (error instanceof X402Error) {
          res.status(error.statusCode).json(error.toJSON());
        } else {
          res.status(500).json({
            error: 'Payment verification failed',
            details: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    };
  }

  /**
   * Generate payment quote for 402 response
   */
  private generateQuote(): PaymentQuote {
    return {
      payment: {
        recipientWallet: this.config.merchantWallet,
        tokenSymbol: 'SOL',
        amount: this.config.apiPrice,
        cluster: this.network,
      },
      message: 'Payment required. Deposit into Privacy Cash pool and provide payment proof.',
      instructions: [
        '1. Deposit SOL into Privacy Cash pool',
        '2. Generate payment commitment',
        '3. Send X-Payment header with proof',
        '4. Include X-Privacy-Commitment and X-Wallet-Address headers',
      ],
    };
  }

  /**
   * Verify x402 payment
   */
  private async verifyPayment(
    xPaymentHeader: string,
    commitment: string | undefined,
    walletAddress: string | undefined
  ): Promise<void> {
    // Decode x402 header
    let decoded: PaymentPayload;
    try {
      decoded = JSON.parse(Buffer.from(xPaymentHeader, 'base64').toString('utf8'));
    } catch {
      throw new InvalidPaymentError('Invalid X-Payment header encoding');
    }

    // Validate scheme
    if (decoded.scheme !== 'privacycash') {
      throw new InvalidPaymentError(`Invalid payment scheme: ${decoded.scheme}`);
    }

    // Validate network
    const expectedNetwork = `solana-${this.network}`;
    if (decoded.network !== expectedNetwork) {
      throw new NetworkMismatchError(expectedNetwork, decoded.network);
    }

    // Validate required headers
    if (!commitment || !walletAddress) {
      throw new InvalidPaymentError('Missing X-Privacy-Commitment or X-Wallet-Address header');
    }

    // Verify commitment hash matches
    const computedHash = this.hashNote(commitment);
    if (computedHash !== decoded.payload.noteHash) {
      throw new InvalidPaymentError('Commitment hash mismatch');
    }

    // Check for double-spend
    if (this.usedCommitments.has(commitment)) {
      throw new DoubleSpendError(commitment);
    }

    // Verify balance proof
    const hasBalance = this.verifyBalance(decoded.payload.balanceProof, this.config.apiPrice);
    if (!hasBalance) {
      throw new InsufficientBalanceError(this.config.apiPrice);
    }

    // Mark commitment as used
    this.usedCommitments.add(commitment);
    console.log('Commitment verified and marked as used');

    // Queue for merchant withdrawal
    this.pendingPayments.set(commitment, {
      commitment,
      amount: this.config.apiPrice,
      userWallet: walletAddress,
      timestamp: Date.now(),
      verified: true,
    });
    console.log('Queued for merchant withdrawal');
  }

  /**
   * Verify balance proof from client
   * Checks that the proof is recent and balance meets requirement
   */
  private verifyBalance(balanceProof: string, required: number): boolean {
    try {
      const proof: BalanceProof = JSON.parse(
        Buffer.from(balanceProof, 'base64').toString('utf8')
      );

      // Check timestamp is recent (within validity window)
      if (Date.now() - proof.timestamp > BALANCE_PROOF_VALIDITY_MS) {
        console.log('Balance proof expired');
        return false;
      }

      // Check balance meets requirement
      if (proof.balance < required) {
        console.log(`Insufficient balance: ${proof.balance} < ${required}`);
        return false;
      }

      console.log(`Balance proof verified: ${proof.balance} >= ${required}`);
      return true;
    } catch (error) {
      console.error('Failed to parse balance proof:', error);
      return false;
    }
  }

  /**
   * Hash function for commitments
   */
  private hashNote(note: string): string {
    return crypto.createHash('sha256').update(note).digest('hex');
  }

  /**
   * Start background withdrawal processor
   */
  private startWithdrawalProcessor(): void {
    // Run every 5 minutes
    this.withdrawalInterval = setInterval(() => {
      this.processMerchantWithdrawals();
    }, 5 * 60 * 1000);
  }

  /**
   * Process pending merchant withdrawals
   */
  private async processMerchantWithdrawals(): Promise<void> {
    const paymentsToProcess = Array.from(this.pendingPayments.values()).filter(
      (p) => p.verified
    );

    if (paymentsToProcess.length === 0) {
      console.log('No pending withdrawals');
      return;
    }

    console.log(`\nProcessing ${paymentsToProcess.length} merchant withdrawals...`);

    // If no merchant client, just log
    if (!this.merchantClient) {
      console.log('Merchant client not initialized - withdrawals simulated');
      for (const payment of paymentsToProcess) {
        console.log(`   Simulated withdrawal: ${payment.amount} lamports`);
        this.pendingPayments.delete(payment.commitment);
      }
      return;
    }

    // Calculate total to withdraw
    const total = paymentsToProcess.reduce((sum, p) => sum + p.amount, 0);

    try {
      // Actually withdraw from Privacy Cash
      const result = await this.merchantClient.withdraw({
        lamports: total,
        recipientAddress: this.config.merchantWallet,
      });

      console.log(`Withdrawal successful: ${total} lamports`);
      console.log(`Transaction: ${result.tx}`);

      // Clear processed payments
      for (const payment of paymentsToProcess) {
        this.pendingPayments.delete(payment.commitment);
      }
    } catch (error) {
      console.error('Withdrawal failed:', error);
    }
  }

  /**
   * Get server statistics
   */
  getStats(): {
    usedCommitments: number;
    pendingPayments: number;
    totalPendingAmount: number;
  } {
    return {
      usedCommitments: this.usedCommitments.size,
      pendingPayments: this.pendingPayments.size,
      totalPendingAmount:
        Array.from(this.pendingPayments.values()).reduce((sum, p) => sum + p.amount, 0) /
        1e9,
    };
  }

  /**
   * Stop the server (cleanup)
   */
  stop(): void {
    if (this.withdrawalInterval) {
      clearInterval(this.withdrawalInterval);
    }
  }
}

/**
 * Create x402 middleware function (convenience export)
 */
export function createX402Middleware(config: X402ServerConfig): RequestHandler {
  const server = new X402PaymentServer(config);
  return server.middleware();
}
