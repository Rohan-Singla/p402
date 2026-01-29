/**
 * Privacy Cash x402 Client Example
 *
 * Make sure the server is running first: npm run example:server
 *
 * Environment variables:
 * - WALLET_KEYPAIR: JSON array of keypair bytes (required)
 * - RPC_URL: Solana RPC URL (default: devnet)
 * - SERVER_URL: x402 server URL (default: http://localhost:3001)
 * - MOCK_MODE: Set to "false" to use real Privacy Cash (requires mainnet)
 */

import 'dotenv/config';
import { Keypair, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { X402PaymentClient } from '../src';

// Load config from environment
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const MOCK_MODE = process.env.MOCK_MODE !== 'false'; // Default to mock mode

/**
 * Load keypair from environment
 */
function loadKeypair(): Keypair {
  if (!process.env.WALLET_KEYPAIR) {
    console.error('Error: WALLET_KEYPAIR environment variable is required');
    console.error('Generate one with: solana-keygen new --outfile wallet.json');
    console.error('Then add to .env: WALLET_KEYPAIR=[...contents of wallet.json...]');
    process.exit(1);
  }

  try {
    const keypairBytes = new Uint8Array(JSON.parse(process.env.WALLET_KEYPAIR));
    return Keypair.fromSecretKey(keypairBytes);
  } catch (e) {
    console.error('Error: Failed to parse WALLET_KEYPAIR');
    console.error('Make sure it is a valid JSON array of 64 bytes');
    process.exit(1);
  }
}

/**
 * Main demo function
 */
async function main() {
  console.log('\nPrivacy Cash x402 Client Demo\n');
  console.log('==============================\n');

  // Load keypair
  const keypair = loadKeypair();
  console.log(`Wallet: ${keypair.publicKey.toBase58()}`);

  // Check wallet balance (skip in mock mode)
  if (!MOCK_MODE) {
    const connection = new Connection(RPC_URL, 'confirmed');
    const balance = await connection.getBalance(keypair.publicKey);
    console.log(`Wallet SOL balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    if (balance < 0.02 * LAMPORTS_PER_SOL) {
      console.log('\nWarning: Low SOL balance.');
      console.log(`Address: ${keypair.publicKey.toBase58()}\n`);
    }
  }

  // Create x402 client
  const client = new X402PaymentClient({
    rpcUrl: RPC_URL,
    keypair,
    mockMode: MOCK_MODE,
  });

  if (MOCK_MODE) {
    console.log('\n[MOCK MODE] Simulating Privacy Cash - no real transactions');
    console.log('Set MOCK_MODE=false in .env to use real Privacy Cash (mainnet only)\n');
  }

  // Initialize client
  console.log('\nInitializing client...');
  await client.initialize();

  // Check private balance
  console.log('\nChecking private balance...');
  try {
    const privateBalance = await client.getPrivateBalance();
    console.log(`Private balance: ${privateBalance.sol} SOL (${privateBalance.lamports} lamports)`);
  } catch (e) {
    console.log('No private balance yet (first time using Privacy Cash)');
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

    if (error instanceof Error) {
      if (error.message.includes('insufficient funds')) {
        console.log('\nTip: You need SOL in your wallet to deposit into the privacy pool');
        console.log(`Get devnet SOL: https://faucet.solana.com/`);
        console.log(`Your address: ${keypair.publicKey.toBase58()}`);
      }
    }
  }
}

// Run the demo
main().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
