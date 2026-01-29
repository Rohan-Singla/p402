import { PublicKey, Keypair } from '@solana/web3.js';

// Network types
export type SolanaNetwork = 'devnet' | 'mainnet-beta';
export type TokenSymbol = 'SOL' | 'USDC' | 'USDT';

// x402 Protocol types
export interface PaymentQuote {
  payment: {
    recipientWallet: string;
    tokenSymbol: TokenSymbol;
    amount: number;
    cluster: SolanaNetwork;
  };
  message: string;
  instructions?: string[];
}

export interface PaymentPayload {
  x402Version: number;
  scheme: 'privacycash';
  network: `solana-${SolanaNetwork}`;
  payload: {
    noteHash: string;
    commitment: string;
    timestamp: number;
    balanceProof: string;
  };
}

// Balance proof structure (sent by client, verified by server)
export interface BalanceProof {
  balance: number;
  timestamp: number;
  wallet: string;
}

// Server config types
export interface X402ServerConfig {
  merchantWallet: string;
  rpcUrl: string;
  apiPrice: number;
  merchantKeypair?: Uint8Array; // For withdrawals
}

// Client config types
export interface X402ClientConfig {
  rpcUrl: string;
  keypair: Keypair;
  mockMode?: boolean; // Enable mock mode for demos (no real transactions)
}

// Wallet adapter interface (compatible with Phantom, Solflare, etc.)
export interface WalletAdapter {
  publicKey: PublicKey;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}

// Pending payment stored by server
export interface PendingPayment {
  commitment: string;
  amount: number;
  userWallet: string;
  timestamp: number;
  verified: boolean;
}

// Private balance response
export interface PrivateBalance {
  lamports: number;
  sol: number;
}

// Payment result from payForAccess
export interface PaymentResult {
  success: boolean;
  data: any;
  paymentDetails?: {
    noteHash: string;
    commitment: string;
    verified: boolean;
    timestamp: string;
    amount: number;
  };
}
