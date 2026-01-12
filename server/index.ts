import express from "express";
import { createEphemeralPaymentSession, getPaymentSession } from "./private-x402";
import { PRICE_USDC } from "../solana/config";

const app = express();
app.use(express.json());

app.get("/premium", async (req, res) => {
  const xPaymentHeader = req.header("X-Payment");

  if (!xPaymentHeader) {
    // No payment yet → generate ephemeral payment
    const sessionId = Math.random().toString(36).substring(2, 12);
    const session = await createEphemeralPaymentSession(sessionId);

    return res.status(402).json({
      sessionId,
      payment: {
        tokenAccount: session.tokenAccount.toBase58(),
        amount: PRICE_USDC,
        expiresIn: "5 minutes",
      },
      message: "Send USDC to this ephemeral token account",
    });
  }

  // TODO: verify payment (decode base64, check SPL token transfer, etc.)
  return res.json({ data: "Premium content - Payment verified!" });
});

app.listen(3001, () => console.log("Private x402 server running on port 3001"));
