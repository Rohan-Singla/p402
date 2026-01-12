import { PublicKey, Connection } from "@solana/web3.js";

export const CONNECTION = new Connection("https://api.devnet.solana.com", "confirmed");

// Devnet USDC mint
export const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

// Merchant wallet (can be ephemeral later)
export const MERCHANT_WALLET = new PublicKey("seFkxFkXEY9JGEpCyPfCWTuPZG9WK6ucf95zvKCfsRX");

// Price
export const PRICE_USDC = 100; // 0.0001 USDC
