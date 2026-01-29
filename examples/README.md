# Privacy Cash x402 Examples

This directory contains working examples of the Privacy Cash x402 SDK.

## Quick Start

### 1. Start the Server

```bash
npm run example:server
```

The server will start on `http://localhost:3001` with:
- `/premium` - Protected endpoint (requires x402 payment)
- `/health` - Health check
- `/admin/stats` - Server statistics

### 2. Run the Client

In another terminal:

```bash
npm run example:client
```

The client will:
1. Initialize the Privacy Cash SDK
2. Request a payment quote from the server
3. Generate a privacy-preserving payment proof
4. Access the premium content

## Environment Variables

### Server (`examples/server-example.ts`)

| Variable | Description | Default |
|----------|-------------|---------|
| `MERCHANT_WALLET` | Solana wallet to receive payments | Demo wallet |
| `MERCHANT_KEYPAIR` | JSON array of keypair bytes | None (simulated withdrawals) |
| `API_PRICE` | Price in lamports | `10000000` (0.01 SOL) |
| `RPC_URL` | Solana RPC endpoint | `https://api.devnet.solana.com` |
| `PORT` | Server port | `3001` |

### Client (`examples/client-example.ts`)

| Variable | Description | Default |
|----------|-------------|---------|
| `WALLET_KEYPAIR` | JSON array of keypair bytes | Mock wallet |
| `RPC_URL` | Solana RPC endpoint | `https://api.devnet.solana.com` |
| `SERVER_URL` | x402 server URL | `http://localhost:3001` |

## Getting Devnet SOL

For testing on devnet, you'll need SOL. Get some from:
- https://faucet.solana.com/

## Example `.env` File

```bash
# Server
MERCHANT_WALLET=YourWalletAddressHere
API_PRICE=10000000

# Client (generate with: solana-keygen new --outfile keypair.json)
WALLET_KEYPAIR=[1,2,3,4...64 bytes]
RPC_URL=https://api.devnet.solana.com
```

## Payment Flow

```
Client                          Server
  |                               |
  |-------- GET /premium -------->|
  |<------- 402 + Quote ----------|
  |                               |
  | [Deposit to Privacy Pool]     |
  | [Generate Payment Proof]      |
  |                               |
  |--- GET /premium + Headers --->|
  |                               |
  |       [Verify Payment]        |
  |       [Check Double-Spend]    |
  |       [Verify Balance Proof]  |
  |                               |
  |<------ 200 + Content ---------|
  |                               |
  |       [Queue Withdrawal]      |
  |       [Every 5 min: Withdraw] |
```

## Privacy Guarantees

1. **Unlinkable Payments**: Deposits and payments cannot be linked on-chain
2. **Anonymous Sender**: Server cannot identify who deposited the funds
3. **Mixed Pool**: Funds are mixed with others in the Privacy Cash pool
4. **Zero-Knowledge Proofs**: Payment validity verified without revealing identity

## Troubleshooting

### "Insufficient balance"
Deposit SOL into the Privacy Cash pool first:
```typescript
await client.deposit(10_000_000); // 0.01 SOL
```

### "Connection refused"
Make sure the server is running on the expected port.

### "Balance proof expired"
Balance proofs are valid for 5 minutes. Generate a new payment.

### "Commitment already used"
Each commitment can only be used once. Generate a new payment.
