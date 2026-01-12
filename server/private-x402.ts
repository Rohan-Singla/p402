import { Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

interface PaymentSession {
  tokenAccount: PublicKey;
  expiresAt: number;
}

// Simple in-memory store (replace with Redis in production)
export const paymentSessions: Record<string, PaymentSession> = {};

export async function createEphemeralPaymentSession(sessionId: string) {
  const ephemeralWallet = Keypair.generate();
  const tokenAccount = await getAssociatedTokenAddress(
    // USDC mint
    new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
    ephemeralWallet.publicKey
  );

  const session: PaymentSession = {
    tokenAccount,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 min expiry
  };

  paymentSessions[sessionId] = session;
  return session;
}

export function getPaymentSession(sessionId: string) {
  const session = paymentSessions[sessionId];
  if (!session) throw new Error("Session not found");
  if (Date.now() > session.expiresAt) throw new Error("Session expired");
  return session;
}
