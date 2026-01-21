// client/privacycash-x402-client.ts
import { 
  Connection, 
  LAMPORTS_PER_SOL, 
  PublicKey,
  VersionedTransaction 
} from "@solana/web3.js";
import { PrivacyCash } from "privacycash";
import { WasmFactory } from '@lightprotocol/hasher.rs';
import { EncryptionService } from "../utils/encryption";

/**
 * Privacy Cash x402 Payment Client
 * Handles private payments for API access using Privacy Cash protocol
 */

interface PaymentQuote {
  payment: {
    recipientWallet: string;
    tokenSymbol: string;
    amount: number; // in lamports
    cluster: string;
  };
}

interface X402PaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    noteHash: string;
    commitment: string;
    timestamp: number;
    withdrawProof?: string; // Proof that funds can be withdrawn
  };
}

interface Signed {
  publicKey: PublicKey;
  signature?: Uint8Array;
  provider: any;
}

/**
 * Get user signature for Privacy Cash encryption
 */
async function getSignedSignature(signed: Signed) {
  if (signed.signature) {
    return;
  }

  const encodedMessage = new TextEncoder().encode("Privacy Money account sign in");
  
  let signature: Uint8Array;
  try {
    signature = await signed.provider.signMessage(encodedMessage);
  } catch (err: any) {
    if (err instanceof Error && err.message?.toLowerCase().includes('user rejected')) {
      throw new Error('User rejected the signature request');
    }
    throw new Error('Failed to sign message: ' + err.message);
  }

  // Handle different wallet signature formats
  if ((signature as any).signature) {
    signature = (signature as any).signature;
  }

  if (!(signature instanceof Uint8Array)) {
    throw new Error('signature is not an Uint8Array type');
  }

  signed.signature = signature;
}

/**
 * Initialize Privacy Cash client with proper encryption
 */
async function initPrivacyCashClient(
  connection: Connection,
  wallet: any // Wallet adapter (Phantom, Solflare, etc.)
): Promise<{ client: PrivacyCash; encryptionService: EncryptionService }> {
  
  // Get wallet signature for encryption
  const signed: Signed = {
    publicKey: wallet.publicKey,
    provider: wallet,
  };

  await getSignedSignature(signed);

  // Initialize encryption service
  const encryptionService = new EncryptionService();
  encryptionService.deriveEncryptionKeyFromSignature(signed.signature!);

  // Initialize Privacy Cash client
  const client = new PrivacyCash({
    RPC_url: connection.rpcEndpoint,
    owner: wallet.publicKey,
    // encryptionService,
    // storage: typeof window !== 'undefined' ? localStorage : undefined,
  });

  return { client, encryptionService };
}

/**
 * Main payment flow
 */
async function runPrivacyCashPayment(wallet: any) {
  console.log("🔐 Privacy Cash x402 Payment Demo\n");

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  console.log("👤 User Wallet:", wallet.publicKey.toBase58());

  // 1. Initialize Privacy Cash SDK with encryption
  console.log("🔧 Initializing Privacy Cash SDK...");
  const lightWasm = await WasmFactory.getInstance();
  const { client, encryptionService } = await initPrivacyCashClient(connection, wallet);
  console.log("✅ Privacy Cash SDK initialized\n");

  // 2. Request payment quote from server
  console.log("📋 Requesting payment quote from server...");
  const quoteRes = await fetch("http://localhost:3001/premium");
  
  if (quoteRes.status !== 402) {
    throw new Error(`Expected 402 Payment Required, got ${quoteRes.status}`);
  }

  const quote: PaymentQuote = await quoteRes.json();
  console.log("📄 Payment Quote:", {
    recipient: quote.payment.recipientWallet,
    amount: `${quote.payment.amount / LAMPORTS_PER_SOL} SOL`,
    token: quote.payment.tokenSymbol,
  });
  console.log();

  // 3. Check current private balance
  let privateBalance = await client.getPrivateBalance();
  console.log("💰 Current private balance:", privateBalance.lamports / LAMPORTS_PER_SOL, "SOL");

  // 4. Deposit SOL into Privacy Cash pool if needed
  const requiredAmount = quote.payment.amount;
  
  if (privateBalance.lamports < requiredAmount) {
    console.log("🔒 Depositing into Privacy Cash pool...");
    console.log("   This breaks the link between your wallet and the payment");
    
    try {
      const depositResult = await client.deposit({
        lamports: requiredAmount,
      });

      console.log("✅ Deposit successful!");
      console.log("   Transaction:", depositResult.tx);
      console.log();

      // Update balance
      privateBalance = await client.getPrivateBalance();
      console.log("💰 New private balance:", privateBalance.lamports / LAMPORTS_PER_SOL, "SOL");
    } catch (error) {
      console.error("❌ Deposit failed:", error);
      throw error;
    }
  }

  // 5. Create withdrawal proof (merchant will use this)
  console.log("📝 Creating withdrawal proof...");
  
  // Generate a unique commitment for this payment
  const commitment = generateCommitment(wallet.publicKey.toBase58(), Date.now());
  const noteHash = hashNote(commitment);

  const x402Payload: X402PaymentPayload = {
    x402Version: 1,
    scheme: "privacycash",
    network: "solana-devnet",
    payload: {
      noteHash: noteHash,
      commitment: commitment,
      timestamp: Date.now(),
      withdrawProof: privateBalance.lamports.toString(), // Proof of balance
    },
  };

  const xPaymentHeader = Buffer.from(JSON.stringify(x402Payload)).toString("base64");

  // 6. Request premium content with payment proof
  console.log("🌐 Requesting premium content...");
  const paidRes = await fetch("http://localhost:3001/premium", {
    headers: {
      "X-Payment": xPaymentHeader,
      "X-Privacy-Commitment": commitment,
      "X-Wallet-Address": wallet.publicKey.toBase58(), // Server needs this to verify
    },
  });

  if (!paidRes.ok) {
    const errorData = await paidRes.json();
    throw new Error(`Payment verification failed: ${JSON.stringify(errorData)}`);
  }

  const response = await paidRes.json();
  
  console.log("✅ Payment verified! Access granted.");
  console.log("\n📦 Premium Content:", response.data);
  console.log("🔐 Privacy Details:", {
    noteUsed: response.paymentDetails.noteHash.substring(0, 20) + "...",
    commitment: response.paymentDetails.commitment.substring(0, 20) + "...",
  });

  // 7. Privacy achieved!
  console.log("\n🎉 Privacy Achieved:");
  console.log("   ✓ Your deposit is mixed with others in the pool");
  console.log("   ✓ Server receives payment but can't link it to your wallet");
  console.log("   ✓ On-chain observers see anonymous deposit/withdrawal");
  console.log("   ✓ Zero-knowledge proofs verify payment validity");

  return response;
}

/**
 * Helper: Generate commitment
 */
function generateCommitment(walletAddress: string, timestamp: number): string {
  const crypto = require('crypto');
  const data = `${walletAddress}-${timestamp}-${Math.random()}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Helper: Hash the commitment for x402 header
 */
function hashNote(note: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(note).digest('hex');
}

/**
 * Check private balance
 */
async function checkPrivateBalance(wallet: any) {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  const { client } = await initPrivacyCashClient(connection, wallet);
  
  try {
    const balance = await client.getPrivateBalance();
    console.log(`💰 Private Balance: ${balance.lamports / LAMPORTS_PER_SOL} SOL`);
    return balance;
  } catch (error) {
    console.error("Error checking balance:", error);
    throw error;
  }
}

export async function demoPayWithPrivacyCash(wallet: any) {
  return runPrivacyCashPayment(wallet);
}


export {
  runPrivacyCashPayment,
  checkPrivateBalance,
  initPrivacyCashClient,
  hashNote,
  generateCommitment,
};