/**
 * lib/contracts.js
 * Arc Testnet contract ABI and address management.
 * Addresses are read from .env.local / Vercel environment variables.
 */

export const ARC_TESTNET = {
  chainId:  parseInt(process.env.NEXT_PUBLIC_ARC_CHAIN_ID ?? "5042002"),
  rpc:      process.env.NEXT_PUBLIC_ARC_RPC_URL           ?? "https://rpc.testnet.arc.network",
  explorer: process.env.NEXT_PUBLIC_ARC_EXPLORER          ?? "https://testnet.arcscan.app",
  name:     "Arc Testnet",
  currency: "USDC",
  decimals: 18,
};

export const ADDRESSES = {
  simhashChecker: process.env.NEXT_PUBLIC_SIMHASH_CHECKER_ADDRESS ?? "0x0",
  cellularVault:  process.env.NEXT_PUBLIC_CELLULAR_VAULT_ADDRESS  ?? "0x0",
  usdc:           process.env.NEXT_PUBLIC_USDC_ADDRESS            ?? "0x3600000000000000000000000000000000000000",
};

export const SIMHASH_CHECKER_ABI = [
  "function checkAndRegister(uint64 fingerprint, uint64[] calldata neighbors) returns (bool)",
  "function publicHammingDistance(uint64 v1, uint64 v2) pure returns (uint8)",
  "function isRegistered(uint64 fingerprint) view returns (bool)",
  "function stats() view returns (uint256 accepted, uint256 rejected, uint256 total, uint256 spamRateBps)",
  "event FingerprintAccepted(uint64 indexed fingerprint, address indexed submitter, uint256 timestamp)",
  "event FingerprintRejected(uint64 indexed fingerprint, uint64 indexed collidingFingerprint, uint8 hammingDistance)",
];

export const CELLULAR_VAULT_ABI = [
  "function openCell(address recipient, uint256 amount, bytes32 secretHash, uint256 ttlSeconds, uint64 fingerprint, uint64[] calldata neighbors, uint256 nonce) returns (bytes32)",
  "function settleCell(bytes32 cellId, bytes32 secret)",
  "function refundCell(bytes32 cellId)",
  "function areCellsIndependent(bytes32 cellId1, bytes32 cellId2) view returns (bool)",
  "function getTriSyncState(bytes32 cellId) view returns (bool sequenced, bool verified, bool settled)",
  "function cells(bytes32 cellId) view returns (bool active, uint256 lockedAmount, address depositor, address recipient, bytes32 secretHash, uint256 deadline, uint64 fingerprint)",
  "function totalValueLocked() view returns (uint256)",
  "event CellOpened(bytes32 indexed cellId, address indexed depositor, address indexed recipient, uint256 amount, uint64 fingerprint)",
  "event CellSettled(bytes32 indexed cellId, address indexed recipient, uint256 amount)",
  "event CellRefunded(bytes32 indexed cellId, address indexed depositor, uint256 amount)",
];

export const USDC_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

/** MetaMask wallet_addEthereumChain params for Arc Testnet */
export const ARC_WALLET_PARAMS = {
  chainId:           "0x" + ARC_TESTNET.chainId.toString(16),
  chainName:         ARC_TESTNET.name,
  nativeCurrency:    { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls:           [ARC_TESTNET.rpc],
  blockExplorerUrls: [ARC_TESTNET.explorer],
};
