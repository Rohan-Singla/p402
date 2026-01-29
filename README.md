# Privacy Cash x402 SDK

A privacy-preserving payment SDK for Solana implementing the HTTP 402 Payment Required protocol using [Privacy Cash](https://privacycash.org).

## What is This?

This SDK enables **private API monetization** on Solana. Users pay for API access through a privacy pool - the server receives payment but cannot link it to the user's identity.

```
User deposits SOL → Privacy Pool → Anonymous payment → API Access
```

## Quick Start

```bash
# Install
npm install

# Terminal 1: Start server
npm run example:server

# Terminal 2: Run client
npm run example:client
```

## How It Works

```
Client                              Server
  │                                   │
  ├─── GET /api/premium ─────────────►│
  │◄── 402 + Payment Quote ───────────┤
  │                                   │
  │ [Deposit to Privacy Pool]         │
  │ [Generate ZK Payment Proof]       │
  │                                   │
  ├─── GET /api + Payment Headers ───►│
  │                         [Verify]  │
  │                   [Check Balance] │
  │              [Prevent Double-Spend]│
  │◄────── 200 + Premium Content ─────┤
```

## Usage

### Server

```typescript
import express from 'express';
import { X402PaymentServer } from 'privacycash-x402';

const server = new X402PaymentServer({
  merchantWallet: 'YOUR_WALLET_ADDRESS',
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  apiPrice: 10_000_000, // 0.01 SOL
});

const app = express();
app.get('/premium', server.middleware(), (req, res) => {
  res.json({ data: 'Premium content!' });
});
```

### Client

```typescript
import { Keypair } from '@solana/web3.js';
import { X402PaymentClient } from 'privacycash-x402';

const client = new X402PaymentClient({
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  keypair: Keypair.fromSecretKey(yourKeypair),
  mockMode: false, // Set true for testing without real SOL
});

await client.initialize();
const result = await client.payForAccess('https://api.example.com/premium');
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MERCHANT_WALLET` | Wallet to receive payments | - |
| `API_PRICE` | Price in lamports | `10000000` |
| `RPC_URL` | Solana RPC endpoint | devnet |
| `WALLET_KEYPAIR` | Client keypair (JSON array) | - |
| `MOCK_MODE` | Enable mock mode | `true` |

## Project Structure

```
src/
├── index.ts           # Main exports
├── server/index.ts    # X402PaymentServer
├── client/index.ts    # X402PaymentClient
├── types/index.ts     # TypeScript types
├── errors/index.ts    # Error classes
└── utils/             # Encryption, constants
```

## Privacy Guarantees

- **Unlinkable**: Deposits and payments cannot be connected on-chain
- **Anonymous**: Server cannot identify who made the deposit
- **Zero-Knowledge**: Payment validity proven without revealing identity
- **Double-Spend Protected**: Each commitment can only be used once

## Limitations

- **Mainnet Only**: Privacy Cash is deployed only on Solana mainnet
- **Mock Mode**: Use `mockMode: true` for development/demos without real SOL

## License

ISC
