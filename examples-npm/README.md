# p402 Examples (npm package)

These examples demonstrate how to use the `privacycash-x402` package after installing it from npm.

## Setup

```bash
cd examples-npm
npm install
```

## Examples

### 1. Simple Demo (Quickest)

Run a complete server + client demo in one file:

```bash
npx ts-node simple.ts
```

This runs in mock mode - no real SOL needed.

### 2. Separate Server & Client

**Terminal 1 - Start Server:**
```bash
# Create .env
echo "MERCHANT_WALLET=YourSolanaWalletAddress" > .env

# Run server
npx ts-node server.ts
```

**Terminal 2 - Run Client:**
```bash
# Add wallet keypair to .env
# (Get keypair from: solana-keygen new -o wallet.json)
echo "WALLET_KEYPAIR=[...bytes...]" >> .env

# Run client
npx ts-node client.ts
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MERCHANT_WALLET` | Solana wallet for receiving payments | Server |
| `WALLET_KEYPAIR` | Client keypair as JSON array | Client |
| `MOCK_MODE` | Set to `false` for real payments | No (default: true) |
| `SERVER_URL` | API server URL | No (default: localhost:3001) |
| `API_PRICE` | Price in lamports | No (default: 10000000) |

## Mock Mode vs Live Mode

**Mock Mode (default):** No real SOL needed. Great for development and testing.

**Live Mode:** Set `MOCK_MODE=false`. Requires:
- SOL in your wallet
- Privacy Cash operates on Solana mainnet only
