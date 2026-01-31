/**
 * p402 Server Example
 *
 * A complete Express server using the privacycash-x402 package.
 *
 * Setup:
 *   1. npm install
 *   2. Create .env file with MERCHANT_WALLET
 *   3. npx ts-node server.ts
 *
 * Environment variables:
 *   MERCHANT_WALLET  - Your Solana wallet address (required)
 *   API_PRICE        - Price in lamports (default: 10000000 = 0.01 SOL)
 *   PORT             - Server port (default: 3001)
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import { X402PaymentServer } from 'privacycash-x402';

// Configuration
const MERCHANT_WALLET = process.env.MERCHANT_WALLET || '';
const API_PRICE = parseInt(process.env.API_PRICE || '10000000');
const PORT = parseInt(process.env.PORT || '3001');

if (!MERCHANT_WALLET) {
  console.error('Error: MERCHANT_WALLET environment variable is required');
  console.error('Create a .env file with: MERCHANT_WALLET=YourSolanaWalletAddress');
  process.exit(1);
}

// Create payment server
const paymentServer = new X402PaymentServer({
  merchantWallet: MERCHANT_WALLET,
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  apiPrice: API_PRICE,
});

// Create Express app
const app = express();
app.use(express.json());

// Public endpoint - no payment required
app.get('/api/public', (req: Request, res: Response) => {
  res.json({
    message: 'This is public content, no payment needed!',
  });
});

// Premium endpoint - protected by x402 payment
app.get('/api/premium', paymentServer.middleware(), (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Premium content unlocked!',
    data: {
      secret: 'This data is protected by Privacy Cash x402',
      timestamp: new Date().toISOString(),
    },
  });
});

// Another premium endpoint with different pricing
app.get('/api/exclusive', paymentServer.middleware(), (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Exclusive content!',
    data: {
      analysis: 'Top secret market analysis...',
      generated: Date.now(),
    },
  });
});

// Stats endpoint
app.get('/api/stats', (req: Request, res: Response) => {
  const stats = paymentServer.getStats();
  res.json({
    totalPayments: stats.usedCommitments,
    pendingPayments: stats.pendingPayments,
    pendingAmount: `${stats.totalPendingAmount / 1e9} SOL`,
  });
});

// Start server
app.listen(PORT, () => {
  console.log('\n=================================');
  console.log('  p402 Payment Server Running');
  console.log('=================================\n');
  console.log(`URL:      http://localhost:${PORT}`);
  console.log(`Merchant: ${MERCHANT_WALLET}`);
  console.log(`Price:    ${API_PRICE / 1e9} SOL\n`);
  console.log('Endpoints:');
  console.log('  GET /api/public   - Free content');
  console.log('  GET /api/premium  - Paid content (0.01 SOL)');
  console.log('  GET /api/stats    - Server statistics\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  paymentServer.stop();
  process.exit(0);
});
