# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Run Commands

```bash
npm run server    # Start x402 payment server on port 3001 (with nodemon)
npm run client    # Start payment client (with nodemon)
npm run example   # Run SDK demo (examples/sdk-demo.ts)
npm run dev       # Run server and client concurrently
```

## Architecture

This is a **Privacy Cash x402 Payment System** - a privacy-preserving payment gateway for API access built on Solana blockchain.

### Core Components

| Component | Path | Purpose |
|-----------|------|---------|
| Server | `server/index.ts` | Express server implementing HTTP 402 payment verification |
| Client | `client/index.ts` | Privacy Cash SDK wrapper for making private payments |
| EncryptionService | `utils/encryption.ts` | AES-256-GCM encryption with signature-derived keys |
| UTXO Model | `models/utxo.ts` | Unspent transaction output (Tornado Cash Nova design) |
| Keypair Model | `models/keypair.ts` | Cryptographic keypair using Poseidon hashing |
| Constants | `utils/constants.ts` | Program IDs, token metadata, Merkle tree config |
| Utils | `utils/utils.ts` | Merkle proofs, fee calculation, serialization |

### Payment Flow

1. Client requests protected endpoint → Server returns 402 with payment quote
2. Client deposits SOL into Privacy Cash pool (unlinkable)
3. Client generates commitment hash and x402 payment proof
4. Server validates commitment, checks double-spend, verifies balance
5. Server grants access and queues payment for merchant withdrawal (every 5 min)

### Key Headers for Payment Requests
- `X-Payment` - Base64-encoded x402 payload
- `X-Privacy-Commitment` - Unique commitment for double-spend prevention
- `X-Wallet-Address` - User's wallet address

## Encryption Patterns

Two encryption versions exist for UTXO data (`amount|blinding|index|mintAddress`):

- **V1 (legacy)**: AES-128-CTR + HMAC-SHA256, key from SHA256(signature[0:31])
- **V2 (current)**: AES-256-GCM, key from Keccak256(full signature)

Format: `[version(8)] + [IV(12)] + [authTag(16)] + [encryptedData]`

Sign message for key derivation: `"Privacy Money account sign in"`

## Token Configuration

Tokens defined in `utils/constants.ts` with different decimal units:
- SOL: 1e9, USDC/USDT: 1e6, ZEC: 1e8, ORE/STORE: 1e11

## External Dependencies

- Privacy Cash SDK (`privacycash`) - Core privacy protocol
- Light Protocol (`@lightprotocol/hasher.rs`) - Poseidon hashing for ZK proofs
- Solana Web3.js - Blockchain interaction
- Borsh - Serialization matching Rust program structures

## Network

Default: Solana Devnet. Relayer API provides fees and Merkle proofs at runtime.
