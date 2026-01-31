/**
 * Simple p402 Example
 *
 * The quickest way to see privacycash-x402 in action.
 *
 * Usage:
 *   npm install
 *   npx ts-node simple.ts
 */

import express from 'express';
import { Keypair } from '@solana/web3.js';
import { X402PaymentServer, X402PaymentClient } from 'privacycash-x402';

async function main() {
  // Generate a random keypair for demo
  const merchantKeypair = Keypair.generate();
  const clientKeypair = Keypair.generate();

  console.log('p402 Quick Demo\n');
  console.log('Generated wallets:');
  console.log(`  Merchant: ${merchantKeypair.publicKey.toBase58()}`);
  console.log(`  Client:   ${clientKeypair.publicKey.toBase58()}\n`);

  // === SERVER SETUP ===
  const paymentServer = new X402PaymentServer({
    merchantWallet: merchantKeypair.publicKey.toBase58(),
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    apiPrice: 10_000_000, // 0.01 SOL
  });

  const app = express();

  // Protected endpoint
  app.get('/api/premium', paymentServer.middleware(), (req, res) => {
    res.json({
      success: true,
      message: 'You unlocked premium content!',
      data: { secret: 'The answer is 42' },
    });
  });

  // Start server
  const server = app.listen(3001, () => {
    console.log('Server running on http://localhost:3001');
    console.log('Protected endpoint: GET /api/premium\n');
  });

  // === CLIENT SETUP ===
  const client = new X402PaymentClient({
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    keypair: clientKeypair,
    mockMode: true, // Use mock mode (no real SOL needed)
  });

  await client.initialize();
  console.log('Client initialized (mock mode)\n');

  // === MAKE PAYMENT REQUEST ===
  console.log('Requesting protected endpoint...\n');

  try {
    const result = await client.payForAccess('http://localhost:3001/api/premium');

    if (result.success) {
      console.log('Payment successful!');
      console.log('Response:', JSON.stringify(result.data, null, 2));
    }
  } catch (error) {
    console.error('Request failed:', error);
  }

  // Cleanup
  server.close();
  paymentServer.stop();
  console.log('\nDemo complete!');
}

main().catch(console.error);
