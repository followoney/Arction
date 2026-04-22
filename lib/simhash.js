/**
 * lib/simhash.js
 * Off-chain Simhash Engine — Browser & Node.js compatible (BigInt-based)
 *
 * Mathematical basis:
 *   V = sign( Σ w_i · h_i )   [L = 64 bit]
 *   d_H(V1, V2) = popcount(V1 XOR V2)
 *   P(collision) ≈ 1 / 2^64 ≈ 5.4 × 10⁻²⁰
 */

const MASK64 = (1n << 64n) - 1n;
const EPSILON = 3;

/**
 * FNV-1a 64-bit hash (BigInt)
 * @param {string} str
 * @returns {bigint}
 */
export function fnv1a64(str) {
  const FNV_OFFSET = 14695981039346656037n;
  const FNV_PRIME  = 1099511628211n;
  let h = FNV_OFFSET;
  for (let i = 0; i < str.length; i++) {
    h ^= BigInt(str.charCodeAt(i));
    h  = (h * FNV_PRIME) & MASK64;
  }
  return h;
}

/**
 * Tokenize transaction object into bigrams + unigrams.
 * @param {object} tx
 * @returns {string[]}
 */
export function tokenizeTx(tx) {
  const raw = [
    `from:${tx.from?.toLowerCase() ?? ""}`,
    `to:${tx.to?.toLowerCase() ?? ""}`,
    `amount:${tx.amount ?? "0"}`,
    `token:${tx.token?.toLowerCase() ?? "usdc"}`,
    `chainId:${tx.chainId ?? ""}`,
    `nonce:${tx.nonce ?? "0"}`
  ].join("|");

  const tokens = [];
  for (let i = 0; i < raw.length - 1; i++) tokens.push(raw.slice(i, i + 2));
  for (const ch of raw) tokens.push(ch);
  return tokens;
}

/**
 * Compute Simhash fingerprint.
 * @param {object} tx  - { from, to, amount, token, chainId }
 * @returns {{ fingerprint: bigint, hex: string, tokenCount: number }}
 */
export function computeSimhash(tx) {
  const tokens = tokenizeTx(tx);
  const W = new Array(64).fill(0);

  const freq = new Map();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);

  for (const [token, weight] of freq.entries()) {
    const h = fnv1a64(token);
    for (let bit = 0; bit < 64; bit++) {
      W[bit] += ((h >> BigInt(bit)) & 1n) === 1n ? weight : -weight;
    }
  }

  let fingerprint = 0n;
  for (let bit = 0; bit < 64; bit++) {
    if (W[bit] > 0) fingerprint |= 1n << BigInt(bit);
  }

  return {
    fingerprint,
    hex: "0x" + fingerprint.toString(16).padStart(16, "0"),
    tokenCount: tokens.length,
  };
}

/**
 * Hamming Distance: d_H = popcount(V1 XOR V2)
 */
export function hammingDistance(v1, v2) {
  let xor = v1 ^ v2;
  let dist = 0;
  while (xor > 0n) { xor &= xor - 1n; dist++; }
  return dist;
}

/**
 * Spam check: d_H < EPSILON => spam
 */
export function checkSpam(fingerprint, registry) {
  if (!registry.length) return { isSpam: false, distance: 64, nearest: null };
  let nearest = null;
  let minDist = 64;
  for (const fp of registry) {
    const d = hammingDistance(fingerprint, fp);
    if (d < minDist) { minDist = d; nearest = fp; }
  }
  return { isSpam: minDist < EPSILON, distance: minDist, nearest };
}

/**
 * Convert BigInt fingerprint to uint64 string (for contract calls).
 */
export function fingerprintToUint64(fp) {
  return (fp & MASK64).toString();
}

/**
 * Convert 64-bit fingerprint to bitmap array (for visualization).
 */
export function fingerprintToBitmap(fp) {
  return Array.from({ length: 64 }, (_, i) => Number((fp >> BigInt(i)) & 1n));
}
