/**
 * Privacy Cash x402 Server Example
 *
 * Start this server, then run client-example.ts in another terminal
 *
 * Environment variables:
 * - MERCHANT_WALLET: Your Solana wallet address for receiving payments
 * - MERCHANT_KEYPAIR: JSON array of keypair bytes (for withdrawals)
 * - API_PRICE: Price in lamports (default: 10000000 = 0.01 SOL)
 * - RPC_URL: Solana RPC URL (default: devnet)
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import { X402PaymentServer } from '../src/server';

// Load config from environment
const MERCHANT_WALLET = process.env.MERCHANT_WALLET || '';
const API_PRICE = parseInt(process.env.API_PRICE || '10000000'); // 0.01 SOL
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';

// Parse merchant keypair if provided
let merchantKeypair: Uint8Array | undefined;
if (process.env.MERCHANT_KEYPAIR) {
  try {
    merchantKeypair = new Uint8Array(JSON.parse(process.env.MERCHANT_KEYPAIR));
  } catch (e) {
    console.warn('Failed to parse MERCHANT_KEYPAIR, withdrawals will be simulated');
  }
}

// Create server
const paymentServer = new X402PaymentServer({
  merchantWallet: MERCHANT_WALLET,
  rpcUrl: RPC_URL,
  apiPrice: API_PRICE,
  merchantKeypair,
});

// Create Express app
const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  const stats = paymentServer.getStats();
  res.json({
    status: 'healthy',
    service: 'Privacy Cash x402 Server',
    network: RPC_URL.includes('devnet') ? 'devnet' : 'mainnet-beta',
    stats,
  });
});

// Premium endpoint - protected by x402 payment
app.get('/premium', paymentServer.middleware(), (req: Request, res: Response) => {
  res.json({
    success: true,
    data: 'Premium content unlocked! This data is protected by Privacy Cash.',
    message: 'Your payment was verified privately. No one can link this to your deposit.',
    privacyGuarantees: [
      'Your wallet address is hidden from this transaction',
      'Payment amount is mixed with others in the pool',
      'Zero-knowledge proofs verify validity without revealing identity',
      'On-chain observers cannot link deposit to withdrawal',
    ],
  });
});

// Admin stats endpoint
app.get('/admin/stats', (req: Request, res: Response) => {
  const stats = paymentServer.getStats();
  res.json({
    totalPaymentsReceived: stats.usedCommitments,
    pendingWithdrawals: stats.pendingPayments,
    totalPendingRevenue: stats.totalPendingAmount,
    uptime: process.uptime(),
  });
});

// Start server
const PORT = parseInt(process.env.PORT || '3001');

app.listen(PORT, () => {
  console.log('\nPrivacy Cash x402 Server Running');
  console.log('=====================================');
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`Network: ${RPC_URL.includes('devnet') ? 'devnet' : 'mainnet-beta'}`);
  console.log(`Merchant: ${MERCHANT_WALLET}`);
  console.log(`API Price: ${API_PRICE / 1e9} SOL`);
  console.log('\nPrivacy Features:');
  console.log('   Zero-knowledge payment verification');
  console.log('   Unlinkable deposits and withdrawals');
  console.log('   Anonymous sender privacy');
  console.log('   Double-spend protection');
  console.log('\nEndpoints:');
  console.log('   GET  /premium       - Protected content (requires payment)');
  console.log('   GET  /health        - Health check');
  console.log('   GET  /admin/stats   - Server statistics');
  console.log('\nReady to accept private payments!\n');
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  paymentServer.stop();
  process.exit(0);
});
