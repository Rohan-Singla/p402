/**
 * p402 Client Example
 *
 * A client that pays for API access using the privacycash-x402 package.
 *
 * Setup:
 *   1. npm install
 *   2. Create .env file with WALLET_KEYPAIR
 *   3. Start the server first: npx ts-node server.ts
 *   4. npx ts-node client.ts
 *
 * Environment variables:
 *   WALLET_KEYPAIR - JSON array of your keypair bytes (required)
 *   SERVER_URL     - Server URL (default: http://localhost:3001)
 *   MOCK_MODE      - Set to "false" for real payments (default: true)
 */

import 'dotenv/config';
import { Keypair } from '@solana/web3.js';
import { X402PaymentClient } from 'privacycash-x402';

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const MOCK_MODE = process.env.MOCK_MODE !== 'false';

// Load keypair from environment
function loadKeypair(): Keypair {
  if (!process.env.WALLET_KEYPAIR) {
    console.error('Error: WALLET_KEYPAIR environment variable is required');
    console.error('\nTo generate a keypair:');
    console.error('  solana-keygen new -o wallet.json');
    console.error('\nThen add to .env:');
    console.error('  WALLET_KEYPAIR=[...contents of wallet.json...]');
    process.exit(1);
  }

  try {
    const bytes = new Uint8Array(JSON.parse(process.env.WALLET_KEYPAIR));
    return Keypair.fromSecretKey(bytes);
  } catch {
    console.error('Error: Invalid WALLET_KEYPAIR format');
    process.exit(1);
  }
}

async function main() {
  console.log('\n=================================');
  console.log('  p402 Payment Client');
  console.log('=================================\n');

  // Load wallet
  const keypair = loadKeypair();
  console.log(`Wallet: ${keypair.publicKey.toBase58()}`);
  console.log(`Mode:   ${MOCK_MODE ? 'Mock (no real SOL)' : 'Live (real payments)'}\n`);

  // Create client
  const client = new X402PaymentClient({
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    keypair,
    mockMode: MOCK_MODE,
  });

  // Initialize
  console.log('Initializing client...');
  await client.initialize();
  console.log('Client ready!\n');

  // Access premium endpoint
  console.log(`Requesting: ${SERVER_URL}/api/premium\n`);

  try {
    const result = await client.payForAccess(`${SERVER_URL}/api/premium`);

    if (result.success) {
      console.log('Payment successful!\n');
      console.log('Response:');
      console.log(JSON.stringify(result.data, null, 2));

      if (result.paymentDetails) {
        console.log('\nPayment Details:');
        console.log(`  Commitment: ${result.paymentDetails.noteHash?.slice(0, 16)}...`);
        console.log(`  Verified:   ${result.paymentDetails.verified}`);
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('Payment failed:', error.message);

      if (error.message.includes('ECONNREFUSED')) {
        console.log('\nTip: Make sure the server is running:');
        console.log('  npx ts-node server.ts');
      }
    }
  }
}

main().catch(console.error);
