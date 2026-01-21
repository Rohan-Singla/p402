import { PublicKey } from "@solana/web3.js";
import { demoPayWithPrivacyCash } from "../client";

const mockWallet = {
  publicKey: new PublicKey("4tMdV9E1vsFP2WFnzD3iBmrFz7hHJxR4qkT44tK7J9ET"),
  signMessage: async (message: Uint8Array) => {
    console.log("✍️  Mock signMessage called");
    return new Uint8Array(64); // fake signature for demo
  },
};

async function main() {
  console.log("\n🧪 Running Privacy x402 SDK demo\n");
  await demoPayWithPrivacyCash(mockWallet);
}

main().catch((err) => {
  console.error("❌ Demo failed:", err);
  process.exit(1);
});
