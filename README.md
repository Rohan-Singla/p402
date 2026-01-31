# p402 - Private x402 SDK

[![npm version](https://img.shields.io/npm/v/privacycash-x402.svg)](https://www.npmjs.com/package/privacycash-x402)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A privacy-preserving payment SDK for Solana implementing the HTTP 402 Payment Required protocol using [Privacy Cash](https://privacycash.org).

## Installation

```bash
npm install privacycash-x402
```

## What is This?

This SDK enables **private API monetization** on Solana. Users deposit SOL into a privacy pool, then pay for API access with unlinkable payments - the server receives payment but cannot trace it back to the depositor.

```
User deposits SOL → Privacy Pool (unlinkable) → Anonymous payment → API Access
```

## Current Status

| Feature | Status | Description |
|---------|--------|-------------|
| Private Deposits | **Working** | Deposits via Privacy Cash are unlinkable on-chain |
| x402 Payment Flow | **Working** | Full HTTP 402 protocol implementation |
| Merchant Withdrawals | **Working** | Batch withdrawals every 5 minutes |
| Mock Mode | **Working** | Test without real SOL |
| ZK Balance Proofs | *Planned* | Currently uses commitment-based verification |

> **Note:** Privacy Cash operates on **Solana Mainnet only**. Use `mockMode: true` for development.

## Quick Start

```bash
npm install privacycash-x402
```

### Server Setup

```typescript
import express from 'express';
import { X402PaymentServer } from 'privacycash-x402';

const server = new X402PaymentServer({
  merchantWallet: 'YOUR_WALLET_ADDRESS',
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  apiPrice: 10_000_000, // 0.01 SOL in lamports
});

const app = express();

// Protect any endpoint with payment middleware
app.get('/premium', server.middleware(), (req, res) => {
  res.json({ data: 'Premium content!' });
});

app.listen(3001);
```

### Client Setup

```typescript
import { Keypair } from '@solana/web3.js';
import { X402PaymentClient } from 'privacycash-x402';

const client = new X402PaymentClient({
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  keypair: Keypair.fromSecretKey(yourSecretKey),
  mockMode: false, // Set true for testing
});

await client.initialize();

// Deposit to privacy pool (one-time, unlinkable)
await client.deposit(0.1); // 0.1 SOL

// Pay for API access (anonymous)
const result = await client.payForAccess('https://api.example.com/premium');
console.log(result.data);
```

## How It Works

```
Client                              Server
  │                                   │
  ├─── GET /api/premium ─────────────►│
  │◄── 402 + Payment Quote ───────────┤
  │                                   │
  │ [Deposit to Privacy Pool]         │
  │ [Generate Payment Commitment]     │
  │                                   │
  ├─── GET /api + Payment Headers ───►│
  │                    [Verify Hash]  │
  │                  [Check Balance]  │
  │           [Prevent Double-Spend]  │
  │◄────── 200 + Premium Content ─────┤
```

### Payment Headers

| Header | Purpose |
|--------|---------|
| `X-Payment` | Base64-encoded payment payload |
| `X-Privacy-Commitment` | Unique commitment (double-spend prevention) |
| `X-Wallet-Address` | Payer's wallet address |

## Use Cases

| User Type | Example | Why p402? |
|-----------|---------|-----------|
| **Backend Services** | AI API paying for data APIs | Privacy between service providers |
| **CLI Tools** | Developer payment utilities | Programmatic private payments |
| **Bots/Automation** | Trading bots, monitoring | Automated payments without linking activity |
| **B2B Integrations** | Service-to-service payments | Hide business relationships on-chain |
| **Privacy-first Apps** | VPN providers, privacy tools | Users wanting unlinkable payments |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MERCHANT_WALLET` | Wallet to receive payments | Required |
| `API_PRICE` | Price in lamports | `10000000` (0.01 SOL) |
| `RPC_URL` | Solana RPC endpoint | Mainnet |
| `WALLET_KEYPAIR` | Client keypair (JSON array) | Required for client |
| `MOCK_MODE` | Enable mock mode for testing | `true` |

## Run Examples

### Using the npm package (recommended)

```bash
git clone https://github.com/Rohan-Singla/p402
cd p402/examples-npm
npm install

# Quick demo (server + client in one file)
npx ts-node simple.ts

# Or run separately:
# Terminal 1: npx ts-node server.ts
# Terminal 2: npx ts-node client.ts
```

### From source

```bash
git clone https://github.com/Rohan-Singla/p402
cd p402
npm install

# Terminal 1: Start example server
npm run example:server

# Terminal 2: Run example client
npm run example:client
```

## Privacy Model

**What's private now:**
- Deposits to Privacy Cash pool are unlinkable on-chain
- Server cannot trace payment back to original deposit transaction
- Each payment uses a unique commitment (no replay attacks)

**Current limitations:**
- Balance verification uses client-reported proofs (not ZK)
- Wallet address is included in payment headers
- Double-spend tracking is in-memory (not persistent)

## Roadmap

- [x] Privacy Cash integration for unlinkable deposits
- [x] HTTP 402 payment protocol
- [x] Express middleware for easy server integration
- [x] Mock mode for development
- [ ] ZK balance proof generation (pending Privacy Cash SDK support)
- [ ] Server-side ZK proof verification
- [ ] On-chain nullifier verification for double-spend
- [ ] Remove wallet address from headers (full anonymity)

## Architecture

```
src/
├── index.ts           # Main exports
├── server/index.ts    # X402PaymentServer + middleware
├── client/index.ts    # X402PaymentClient
├── types/index.ts     # TypeScript interfaces
├── errors/index.ts    # Custom error classes
├── models/
│   ├── utxo.ts        # UTXO model (Tornado Cash Nova design)
│   └── keypair.ts     # Keypair with Poseidon hashing
└── utils/
    ├── encryption.ts  # AES-256-GCM encryption
    ├── constants.ts   # Program IDs, token config
    └── utils.ts       # Merkle proofs, serialization
```

## Contributing

Contributions welcome! Areas of interest:
- ZK proof integration when Privacy Cash SDK exposes these functions
- Persistent double-spend tracking (Redis/database)
- Additional token support

## License

MIT
