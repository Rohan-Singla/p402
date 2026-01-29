/**
 * Privacy Cash x402 Client Example
 *
 * Make sure the server is running first: npm run example:server
 *
 * Environment variables:
 * - WALLET_KEYPAIR: JSON array of keypair bytes (or will use mock wallet)
 * - RPC_URL: Solana RPC URL (default: devnet)
 * - SERVER_URL: x402 server URL (default: http://localhost:3001)
 */

import 'dotenv/config';
import { Keypair, PublicKey, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { X402PaymentClient, WalletAdapter } from '../src';

// Load config from environment
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';

/**
 * Create wallet adapter from keypair bytes or generate mock
 */
function createWallet(): { wallet: WalletAdapter; keypair?: Keypair } {
  // Try to load from environment
  if (process.env.WALLET_KEYPAIR) {
    try {
      const keypairBytes = new Uint8Array(JSON.parse(process.env.WALLET_KEYPAIR));
      const keypair = Keypair.fromSecretKey(keypairBytes);

      const wallet: WalletAdapter = {
        publicKey: keypair.publicKey,
        signMessage: async (message: Uint8Array) => {
          return nacl.sign.detached(message, keypair.secretKey);
        },
      };

      return { wallet, keypair };
    } catch (e) {
      console.warn('Failed to parse WALLET_KEYPAIR, using mock wallet');
    }
  }

  // Use mock wallet for demo (won't work for real transactions)
  console.log('Using mock wallet (for demo only)');
  const mockPublicKey = new PublicKey('4tMdV9E1vsFP2WFnzD3iBmrFz7hHJxR4qkT44tK7J9ET');

  const wallet: WalletAdapter = {
    publicKey: mockPublicKey,
    signMessage: async (message: Uint8Array) => {
      console.log('Mock signMessage called');
      return new Uint8Array(64); // Fake signature
    },
  };

  return { wallet };
}

/**
 * Main demo function
 */
async function main() {
  console.log('\nPrivacy Cash x402 Client Demo\n');
  console.log('==============================\n');

  // Create wallet
  const { wallet, keypair } = createWallet();
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);

  // Check wallet balance if we have a real keypair
  if (keypair) {
    const connection = new Connection(RPC_URL, 'confirmed');
    const balance = await connection.getBalance(keypair.publicKey);
    console.log(`Wallet SOL balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    if (balance < 0.02 * LAMPORTS_PER_SOL) {
      console.log('\nWarning: Low SOL balance. Get devnet SOL from:');
      console.log('https://faucet.solana.com/\n');
    }
  }

  // Create x402 client
  const client = new X402PaymentClient({
    rpcUrl: RPC_URL,
    wallet,
  });

  // Initialize client (signs message to derive encryption keys)
  console.log('\nInitializing client...');
  await client.initialize();

  // Check private balance
  console.log('\nChecking private balance...');
  try {
    const balance = await client.getPrivateBalance();
    console.log(`Private balance: ${balance.sol} SOL (${balance.lamports} lamports)`);
  } catch (e) {
    console.log('Could not check private balance (expected with mock wallet)');
  }

  // Try to access premium endpoint
  console.log(`\nAccessing premium endpoint at ${SERVER_URL}/premium...`);

  try {
    const result = await client.payForAccess(`${SERVER_URL}/premium`);

    if (result.success) {
      console.log('\nPremium Content Unlocked!');
      console.log('========================');
      console.log(result.data);

      if (result.paymentDetails) {
        console.log('\nPayment Details:');
        console.log(`  Note Hash: ${result.paymentDetails.noteHash?.substring(0, 20)}...`);
        console.log(`  Verified: ${result.paymentDetails.verified}`);
      }

      console.log('\nPrivacy Achieved:');
      console.log('  Your deposit is mixed with others in the pool');
      console.log('  Server receives payment but cannot link it to your wallet');
      console.log('  On-chain observers see anonymous deposit/withdrawal');
      console.log('  Zero-knowledge proofs verify payment validity');
    }
  } catch (error) {
    console.error('\nPayment failed:', error);

    if (error instanceof Error && error.message.includes('402')) {
      console.log('\nTip: Make sure you have enough SOL in the privacy pool');
      console.log('You can deposit using client.deposit(lamports)');
    }
  }
}

// Run the demo
main().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
