# Arction

> **Corporate-grade DApp on Arc — Simhash spam filter + CellularVault parallel execution with USDC settlement.**

📄 **[Read the Whitepaper →](WHITEPAPER.md)**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/followoney/Arction)

---

## Live Demo

**Vercel:** `https://arction.vercel.app` *(update after deploy)*  
**Explorer:** https://testnet.arcscan.app  
**Faucet:** https://faucet.circle.com

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                    Arction                        │
│                                                   │
│  [Browser/MetaMask]                               │
│       │                                           │
│       ▼                                           │
│  [Next.js 14 Frontend]  ─── /api/simhash ──► off-chain Simhash  │
│       │                                           │
│       ▼                                           │
│  [Arc Testnet EVM — Chain ID: 5042002]            │
│    ├── SimhashChecker.sol  (spam filter)          │
│    └── CellularVault.sol   (CEI + TriSync)        │
│                                                   │
│  Settlement: Circle USDC · Gas: USDC (native)     │
└──────────────────────────────────────────────────┘
```

### Mathematical Models

| Layer | Formula | Purpose |
|-------|---------|---------|
| Simhash | `V = sign(Σ wᵢ·hᵢ)` | Spam filter |
| Hamming | `d_H = popcount(V1 XOR V2)` | Similarity measure |
| Independence | `{Aᵢ,Bᵢ} ∩ {Aⱼ,Bⱼ} = ∅` | Parallel execution |
| Security | `P(collision) ≈ 1/2^64` | Collision resistance |
| Liveness | `T_final < 1s` | Arc sub-second finality |

---

## Quick Start

### Prerequisites

- **Node.js** v18+ → https://nodejs.org
- **MetaMask** → https://metamask.io

### 1. Clone & Install

```bash
git clone https://github.com/followoney/Arction.git
cd Arction
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Source |
|----------|--------|
| `DEPLOYER_PRIVATE_KEY` | MetaMask → Account Details → Export Private Key |
| `NEXT_PUBLIC_USDC_ADDRESS` | `0x3600000000000000000000000000000000000000` (already set) |

### 3. Add Arc Testnet to MetaMask

| Field | Value |
|-------|-------|
| Network Name | Arc Testnet |
| RPC URL | `https://rpc.testnet.arc.network` |
| Chain ID | `5042002` |
| Currency | `USDC` |
| Explorer | `https://testnet.arcscan.app` |

### 4. Get Test USDC

Visit https://faucet.circle.com and request USDC for your address.

### 5. Deploy Contracts

```bash
npm run deploy:testnet
```

Copy the output addresses into `.env.local` and Vercel environment variables.

### 6. Run Locally

```bash
npm run dev
# → http://localhost:3000
```

### 7. Deploy to Vercel

1. Push to GitHub
2. https://vercel.com → New Project → Select repo
3. Add environment variables from `.env.example`
4. ⚠ **Never add `DEPLOYER_PRIVATE_KEY` to Vercel**
5. Deploy

---

## Project Structure

```
Arction/
├── app/
│   ├── layout.jsx                  # Root layout + SEO
│   ├── page.jsx                    # Main dashboard
│   ├── globals.css                 # Premium design system
│   ├── components/
│   │   ├── Header.jsx              # Glassmorphism navbar
│   │   ├── Hero.jsx                # Animated hero + KPIs
│   │   ├── VaultPanel.jsx          # Open / Settle / Refund
│   │   ├── NetworkStatus.jsx       # Live block + latency
│   │   ├── ProtocolFlow.jsx        # TriSync 3-step flow
│   │   ├── WalletButton.jsx        # MetaMask connection
│   │   └── Footer.jsx              # Links + branding
│   └── api/simhash/route.js        # POST /api/simhash
├── contracts/
│   ├── SimhashChecker.sol          # On-chain spam filter
│   └── CellularVault.sol           # Cellular vault (CEI)
├── lib/
│   ├── simhash.js                  # Off-chain Simhash engine
│   └── contracts.js                # ABI + address config
├── scripts/deploy.js               # Hardhat deploy
├── hardhat.config.cjs
├── next.config.mjs
├── vercel.json
└── .env.example
```

---

## API Reference

### `POST /api/simhash`

```json
{
  "transaction": { "from": "0xAlice", "to": "0xBob", "amount": "100", "token": "USDC", "chainId": 5042002 },
  "registry": ["12345678901234567"]
}
```

Response:
```json
{
  "fingerprint": "12345678901234567",
  "hex": "0xabcdef1234567890",
  "isSpam": false,
  "distance": 18,
  "tokenCount": 142,
  "epsilon": 3
}
```

---

## Security Notes

1. **ZK Proof:** `settleCell` currently uses `keccak256(secret)`. For production, replace with ZK-SNARK or Circle Attestation.
2. **CEI Pattern:** All state changes follow Check → Effect → Interact to prevent reentrancy.
3. **Gas Limits:** `SimhashChecker` limits neighbors array to 20 entries to prevent gas griefing.
4. **SafeERC20:** All token transfers use OpenZeppelin SafeERC20.

---

## Resources

- [Arc Docs](https://docs.arc.network)
- [Circle Developer Portal](https://developers.circle.com)
- [Arc Explorer](https://testnet.arcscan.app)
- [Circle Faucet](https://faucet.circle.com)

---

*Built with Arc Testnet · Circle SDK · ethers.js v6 · Next.js 14*
