<![CDATA[<div align="center">

# ARCTION

### Cellular Parallel Execution Protocol on Arc Network

**Whitepaper v2.0 — April 2026**

*A next-generation decentralized application leveraging Simhash-based spam detection,*
*cellular vault architecture, and TriSync consensus for trustless USDC settlement*
*on the Arc Testnet with sub-second deterministic finality.*

---

**Live:** [arction-pi.vercel.app](https://arction-pi.vercel.app)  
**Explorer:** [testnet.arcscan.app](https://testnet.arcscan.app)  
**Network:** Arc Testnet · Chain ID `5042002`

</div>

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Problem](#2-the-problem)
3. [The Solution — Arction Protocol](#3-the-solution--arction-protocol)
4. [System Architecture](#4-system-architecture)
5. [Core Components](#5-core-components)
   - 5.1 [Simhash Anti-Spam Engine](#51-simhash-anti-spam-engine)
   - 5.2 [CellularVault Smart Contract](#52-cellularvault-smart-contract)
   - 5.3 [TriSync Settlement Protocol](#53-trisync-settlement-protocol)
6. [Mathematical Foundations](#6-mathematical-foundations)
7. [Security Model](#7-security-model)
8. [Transaction Lifecycle](#8-transaction-lifecycle)
9. [Technology Stack](#9-technology-stack)
10. [Smart Contract Reference](#10-smart-contract-reference)
11. [Deployment & Infrastructure](#11-deployment--infrastructure)
12. [Future Roadmap](#12-future-roadmap)

---

## 1. Executive Summary

**Arction** is a corporate-grade decentralized application built on the **Arc Network** — a high-performance EVM-compatible blockchain featuring sub-second deterministic finality through **Arc Malachite BFT consensus**.

The protocol introduces a novel **Cellular Parallel Execution** model where individual USDC transfers are encapsulated in independent "cells." Each cell operates as an atomic, self-contained unit of value transfer — enabling trustless peer-to-peer payments with built-in spam protection, cryptographic security, and deterministic settlement guarantees.

### Key Innovations

| Feature | Description |
|---------|-------------|
| **Simhash Spam Filter** | Locality-sensitive hashing detects and rejects duplicate/spam transactions before on-chain execution |
| **Cellular Architecture** | Each transfer is an independent cell with its own lifecycle, enabling parallel processing |
| **TriSync Protocol** | Three-phase deterministic settlement: Sequencing → Verification → Settlement |
| **CEI Security Pattern** | Check → Effect → Interact pattern prevents reentrancy across all contract operations |
| **Sub-Second Finality** | Arc Malachite BFT delivers `T_final < 1s` for instant settlement confirmation |

---

## 2. The Problem

Current decentralized payment protocols face three critical challenges:

### 2.1 Spam & Replay Attacks
Traditional blockchain networks have no built-in mechanism to detect and prevent spam transactions at the protocol level. Attackers can flood the network with near-identical transactions, consuming block space and increasing fees for legitimate users.

### 2.2 Sequential Processing Bottleneck
Most EVM chains process transactions sequentially within blocks. When two independent transfers share no state overlap, there is no reason they cannot execute in parallel — yet legacy architectures force them into a single execution thread.

### 2.3 Trust & Settlement Latency
Existing P2P payment solutions either require a trusted intermediary (centralized risk) or suffer from high settlement latency due to probabilistic finality models (multiple block confirmations).

---

## 3. The Solution — Arction Protocol

Arction addresses all three challenges through a unified architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   SPAM PROBLEM           PARALLELISM PROBLEM                │
│   ─────────────          ──────────────────                 │
│   Simhash Engine         Cellular Independence              │
│   d_H(V1,V2) < ε        {Aᵢ,Bᵢ} ∩ {Aⱼ,Bⱼ} = ∅           │
│        │                        │                           │
│        └──────────┬─────────────┘                           │
│                   │                                         │
│           CellularVault.sol                                 │
│           (On-Chain Engine)                                  │
│                   │                                         │
│           TriSync Settlement                                │
│           Sequenced → Verified → Settled                    │
│                   │                                         │
│          TRUST & LATENCY SOLVED                             │
│          Arc BFT < 1s Finality                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. System Architecture

```
                    ┌──────────────────────┐
                    │   User's Browser     │
                    │   (MetaMask/Opera)   │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   Next.js 14 App     │
                    │   ┌───────────────┐  │
                    │   │ VaultPanel.jsx│  │ ◄── Send / Claim / Refund UI
                    │   └───────┬───────┘  │
                    │           │          │
                    │   ┌───────▼───────┐  │
                    │   │ lib/simhash.js│  │ ◄── Off-chain fingerprint
                    │   └───────┬───────┘  │
                    └───────────┼──────────┘
                               │ ethers.js v6
                    ┌──────────▼───────────┐
                    │  Arc Testnet (EVM)    │
                    │  Chain ID: 5042002   │
                    │                      │
                    │  ┌────────────────┐  │
                    │  │SimhashChecker  │  │ ◄── On-chain spam filter
                    │  │  0x102F…308E   │  │
                    │  └───────┬────────┘  │
                    │          │           │
                    │  ┌───────▼────────┐  │
                    │  │CellularVault   │  │ ◄── USDC lock/release
                    │  │  0x35eF…B376   │  │
                    │  └───────┬────────┘  │
                    │          │           │
                    │  ┌───────▼────────┐  │
                    │  │  USDC Token    │  │ ◄── Native currency
                    │  │  0x3600…0000   │  │
                    │  └────────────────┘  │
                    └──────────────────────┘
```

---

## 5. Core Components

### 5.1 Simhash Anti-Spam Engine

The **Simhash** algorithm is a locality-sensitive hashing technique originally developed by Moses Charikar (2002). Arction adapts it for blockchain transaction fingerprinting.

#### How It Works

1. **Tokenization**: Each transaction is decomposed into a set of character bigrams and unigrams from its canonical representation:
   ```
   from:0xabc…|to:0xdef…|amount:100|token:usdc|chainId:5042002|nonce:…
   ```

2. **FNV-1a Hashing**: Each token is hashed to a 64-bit value using FNV-1a:
   ```
   h = FNV_OFFSET
   for each byte b: h = (h XOR b) * FNV_PRIME mod 2^64
   ```

3. **Weighted Accumulation**: A 64-dimensional weight vector `W` is computed:
   ```
   W[bit] += (hash[bit] == 1) ? weight : -weight
   ```

4. **Fingerprint Extraction**: The final fingerprint is the sign of each dimension:
   ```
   V[bit] = (W[bit] > 0) ? 1 : 0
   ```

#### Spam Detection

Two transactions are considered "similar" (potential spam) if their **Hamming distance** is below threshold `ε = 3`:

```
d_H(V1, V2) = popcount(V1 XOR V2)
if d_H < 3 → REJECT (spam detected)
```

The collision probability for legitimate transactions is astronomically low:
```
P(false positive) ≈ 1 / 2^64 ≈ 5.4 × 10⁻²⁰
```

#### Two-Layer Architecture

| Layer | Location | Purpose |
|-------|----------|---------|
| **Off-chain** | `lib/simhash.js` | Compute fingerprint before transaction submission |
| **On-chain** | `SimhashChecker.sol` | Verify uniqueness and register fingerprint permanently |

---

### 5.2 CellularVault Smart Contract

The **CellularVault** is the heart of the Arction protocol. It implements a Hash Time-Locked Contract (HTLC) pattern enhanced with Simhash verification and the CEI security model.

#### Cell Structure

Each cell represents an independent unit of value transfer:

```solidity
struct Cell {
    bool    active;        // Cell lifecycle state
    uint256 lockedAmount;  // USDC locked in this cell
    address depositor;     // Sender (who locked funds)
    address recipient;     // Designated receiver
    bytes32 secretHash;    // keccak256(secret) for verification
    uint256 deadline;      // Expiration timestamp (TTL)
    uint64  fingerprint;   // Simhash anti-spam fingerprint
}
```

#### Independence Condition

Two cells `Tᵢ` and `Tⱼ` are **independent** if and only if their participant sets are disjoint:

```
Independent(Tᵢ, Tⱼ) ⟺ {Aᵢ, Bᵢ} ∩ {Aⱼ, Bⱼ} = ∅
```

Where `A` = depositor and `B` = recipient. Independent cells can be processed in parallel without state conflicts.

#### Cell Operations

| Operation | Caller | Condition | Action |
|-----------|--------|-----------|--------|
| `openCell` | Depositor | Valid amount, unique fingerprint | Lock USDC, create cell |
| `settleCell` | Recipient | Correct secret, not expired, TriSync complete | Release USDC to recipient |
| `refundCell` | Depositor | Cell expired (past deadline) | Return USDC to depositor |

---

### 5.3 TriSync Settlement Protocol

TriSync is a three-phase deterministic settlement mechanism that ensures every cell reaches a final state:

```
     ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
     │  PHASE 1     │      │  PHASE 2     │      │  PHASE 3     │
     │  SEQUENCING  │ ───► │ VERIFICATION │ ───► │ SETTLEMENT   │
     │              │      │              │      │              │
     │ Arc Malachite│      │ Simhash +    │      │ CellularVault│
     │ BFT orders   │      │ Nullifier    │      │ releases     │
     │ the tx       │      │ Registry     │      │ USDC via CEI │
     └─────────────┘      └─────────────┘      └─────────────┘
           ✓                     ✓                    ✓
       < 1 second          On-chain check        Atomic transfer
```

**Phase 1 — Sequencing**: Arc Malachite BFT consensus sequences the transaction with sub-second deterministic finality. The transaction order is permanent and irreversible.

**Phase 2 — Verification**: The `SimhashChecker` contract verifies that the transaction fingerprint is unique (Hamming distance ≥ ε from all registered fingerprints). The fingerprint is added to the nullifier registry, preventing replay.

**Phase 3 — Settlement**: The `CellularVault` atomically releases USDC to the designated recipient using the CEI (Check → Effect → Interact) pattern, ensuring reentrancy protection.

---

## 6. Mathematical Foundations

### Simhash Fingerprint Generation

```
V = sign( Σ wᵢ · hᵢ )    where L = 64 bits
```

- `wᵢ` = frequency weight of token `i`
- `hᵢ` = FNV-1a 64-bit hash of token `i`
- `sign()` maps positive weights to 1, non-positive to 0

### Hamming Distance

```
d_H(V1, V2) = popcount(V1 XOR V2)
```

The number of bit positions where two fingerprints differ.

### Spam Detection Threshold

```
if d_H(V_new, V_registered) < ε    where ε = 3
    → REJECT as spam/duplicate
```

### Cell ID Generation

```
cellId = keccak256(abi.encodePacked(sender, recipient, amount, nonce))
```

Deterministic and unique per transaction parameters.

### Secret Verification

```
stored:   secretHash = keccak256(encodeBytes32String(password))
verified: keccak256(abi.encodePacked(secret_bytes32)) == secretHash
```

### Key Metrics

| Metric | Value |
|--------|-------|
| Fingerprint space | 2^64 ≈ 1.8 × 10^19 |
| Collision probability | ≈ 5.4 × 10^-20 |
| Finality time | < 1 second |
| Gas per openCell | ~300,000 |
| Max neighbors (spam check) | 20 |

---

## 7. Security Model

### 7.1 CEI Pattern (Check → Effect → Interact)

All `CellularVault` functions follow strict CEI ordering:

```
1. CHECK    — Validate preconditions (active cell, correct caller, valid secret)
2. EFFECT   — Update state (deactivate cell, zero balance, update TVL)
3. INTERACT — External calls (USDC safeTransfer)
```

This eliminates reentrancy attack vectors. Additionally, all functions use OpenZeppelin's `nonReentrant` modifier as a defense-in-depth measure.

### 7.2 SafeERC20

All token transfers use `SafeERC20.safeTransfer` and `SafeERC20.safeTransferFrom`, which handle both standard-compliant and non-standard ERC20 tokens (tokens that don't return a boolean value).

### 7.3 Secret Hash Security

The current implementation uses `keccak256` pre-image as proof of knowledge:

```
openCell:   store H = keccak256(S)
settleCell: verify keccak256(S') == H
```

> **⚠ Production Note:** For production deployment, replace with ZK-SNARK proofs or Circle Attestation for enhanced privacy (the secret is revealed on-chain during settlement).

### 7.4 Time-Lock Guarantee

Each cell has a hard deadline (`block.timestamp + TTL`). After expiration:
- **Recipient** can no longer claim (settlement reverts with `CellExpired`)
- **Depositor** can reclaim funds via `refundCell`

Before expiration:
- Only the designated **recipient** can settle (with correct secret)
- Depositor cannot withdraw (refund reverts with `CellNotExpired`)

### 7.5 Access Control Matrix

| Function | Authorized Caller | Time Constraint |
|----------|-------------------|-----------------|
| `openCell` | Anyone (becomes depositor) | None |
| `settleCell` | `cell.recipient` only | Before deadline |
| `refundCell` | `cell.depositor` only | After deadline |

---

## 8. Transaction Lifecycle

### Complete Flow: Send → Claim

```
SENDER (Alice)                              RECIPIENT (Bob)
─────────────────                           ─────────────────

1. Enter: Bob's address,
   amount, secret "mykey123"
        │
2. Off-chain Simhash computed
   fingerprint = 0xABCD…
        │
3. USDC approved to Vault
        │
4. openCell(Bob, 100, H("mykey123"),
   3600s, fingerprint, [], nonce)
        │
5. Contract locks 100 USDC
   Returns cellId = 0x1234…
        │
6. Alice shares cellId +                   7. Bob receives cellId +
   secret "mykey123" with Bob     ──────►      secret "mykey123"
                                                    │
                                            8. settleCell(0x1234…,
                                               "mykey123")
                                                    │
                                            9. Contract verifies:
                                               ✓ Cell active
                                               ✓ Not expired
                                               ✓ Bob == recipient
                                               ✓ keccak(secret) == hash
                                               ✓ TriSync complete
                                                    │
                                            10. 100 USDC released to Bob ✓
```

### Refund Flow (Expired Cell)

```
SENDER (Alice)

1. Cell TTL expires (e.g., 1 hour)
        │
2. refundCell(cellId)
        │
3. Contract verifies:
   ✓ Cell active
   ✓ Past deadline
   ✓ Alice == depositor
        │
4. USDC returned to Alice ✓
```

---

## 9. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Blockchain** | Arc Testnet (EVM) | Sub-second BFT finality |
| **Smart Contracts** | Solidity ^0.8.24 | CellularVault + SimhashChecker |
| **Security** | OpenZeppelin 5.x | ReentrancyGuard, SafeERC20, Ownable |
| **Frontend** | Next.js 14 (App Router) | Server/client hybrid rendering |
| **Wallet** | RainbowKit + Wagmi | Multi-wallet connection |
| **Blockchain SDK** | ethers.js v6 | Contract interaction |
| **Styling** | Custom CSS | Glassmorphism, animations |
| **Settlement** | Circle USDC | Native stablecoin on Arc |
| **Deployment** | Vercel | Edge network, auto-deploy from GitHub |
| **Contract Deploy** | Hardhat | Compilation, testing, deployment |

---

## 10. Smart Contract Reference

### Deployed Addresses (Arc Testnet)

| Contract | Address |
|----------|---------|
| **CellularVault** | `0x35eF6b0CF36ec0aE213F23FB40Ceb1A79f23B376` |
| **SimhashChecker** | `0x102F0F2b5c0c15D127E5D0806A5a5f5523Ed308E` |
| **USDC (Native)** | `0x3600000000000000000000000000000000000000` |

### ABI Summary

```
── CellularVault ──────────────────────────────────────────────
openCell(recipient, amount, secretHash, ttl, fingerprint,
         neighbors, nonce) → cellId
settleCell(cellId, secret)
refundCell(cellId)
cells(cellId) → (active, amount, depositor, recipient, …)
getTriSyncState(cellId) → (sequenced, verified, settled)
areCellsIndependent(cellId1, cellId2) → bool
totalValueLocked() → uint256

── SimhashChecker ─────────────────────────────────────────────
checkAndRegister(fingerprint, neighbors) → bool
isRegistered(fingerprint) → bool
publicHammingDistance(v1, v2) → uint8
stats() → (accepted, rejected, total, spamRateBps)
```

### Events

| Event | Emitted When |
|-------|-------------|
| `CellOpened(cellId, depositor, recipient, amount, fingerprint)` | New cell created |
| `CellSettled(cellId, recipient, amount)` | Funds claimed by recipient |
| `CellRefunded(cellId, depositor, amount)` | Funds returned to depositor |
| `TriSyncProgressed(cellId, sequenced, verified, settled)` | TriSync state change |
| `FingerprintAccepted(fingerprint, submitter, timestamp)` | Unique fingerprint registered |
| `FingerprintRejected(fingerprint, colliding, distance)` | Spam fingerprint rejected |

### Custom Errors

| Error | Meaning |
|-------|---------|
| `CellAlreadyExists(cellId)` | Duplicate cell (same sender+recipient+amount+nonce) |
| `CellNotFound(cellId)` | Cell doesn't exist or already settled/refunded |
| `CellExpired(cellId)` | TTL exceeded — can only refund |
| `CellNotExpired(cellId)` | TTL not yet reached — cannot refund yet |
| `InvalidSecret(cellId)` | Wrong secret provided during settlement |
| `InsufficientAmount()` | Zero amount not allowed |
| `UnauthorizedCaller()` | Wrong caller (not recipient/depositor) |
| `TriSyncIncomplete(cellId)` | TriSync phases not complete |

---

## 11. Deployment & Infrastructure

### Prerequisites

- Node.js v18+
- MetaMask or Opera Crypto Wallet
- Arc Testnet USDC (via [Circle Faucet](https://faucet.circle.com))

### Local Development

```bash
git clone https://github.com/followoney/Arction.git
cd Arction && npm install
cp .env.example .env.local    # Configure addresses
npm run dev                    # → http://localhost:3000
```

### Production (Vercel)

```bash
git push origin main           # Auto-deploys via Vercel
```

### Arc Testnet Configuration

| Parameter | Value |
|-----------|-------|
| Network Name | Arc Testnet |
| RPC URL | `https://rpc.testnet.arc.network` |
| Chain ID | `5042002` |
| Native Currency | USDC |
| Block Explorer | `https://testnet.arcscan.app` |

---

## 12. Future Roadmap

| Phase | Milestone | Status |
|-------|-----------|--------|
| **v1.0** | CellularVault + SimhashChecker deployment | ✅ Complete |
| **v1.5** | TriSync integration + premium UI | ✅ Complete |
| **v2.0** | ABI hardening + error decoding + dynamic decimals | ✅ Complete |
| **v2.5** | ZK-SNARK secret verification | 🔜 Planned |
| **v3.0** | Multi-token support (beyond USDC) | 🔜 Planned |
| **v3.5** | Cross-chain cellular bridges | 🔜 Planned |
| **v4.0** | Arc Mainnet deployment | 🔜 Planned |

---

<div align="center">

### Built with ❤️ on Arc Network

**Arc Testnet** · **Circle USDC** · **ethers.js v6** · **Next.js 14** · **OpenZeppelin**

[Live App](https://arction-pi.vercel.app) · [Explorer](https://testnet.arcscan.app) · [GitHub](https://github.com/followoney/Arction)

*© 2026 Arction Protocol. All rights reserved.*

</div>
]]>
