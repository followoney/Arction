// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SimhashChecker
 * @notice Arc Testnet (Chain ID: 5042002) — Simhash-based transaction spam filter.
 *
 * MATHEMATICAL BASIS:
 *   V = sign( Σ w_i · h_i )   [i=1..n, L=64 bit]
 *   Hamming Distance: d_H(V1, V2) = popcount(V1 XOR V2)
 *   Collision Probability: P(collision) ≈ 1 / 2^64 ≈ 5.4 × 10⁻²⁰
 *
 * HYBRID MODEL:
 *   Full Simhash pipeline is computed off-chain (lib/simhash.js).
 *   The contract only validates the 64-bit fingerprint and Hamming distance.
 */

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SimhashChecker is Ownable, ReentrancyGuard {

    uint8 public constant EPSILON          = 3;
    uint8 public constant FINGERPRINT_BITS = 64;
    uint256 public constant MAX_NEIGHBORS  = 20;

    mapping(uint64 => uint256) public fingerprintRegistry;

    uint256 public totalAccepted;
    uint256 public totalRejected;

    event FingerprintAccepted(uint64 indexed fingerprint, address indexed submitter, uint256 timestamp);
    event FingerprintRejected(uint64 indexed fingerprint, uint64 indexed collidingFingerprint, uint8 hammingDistance);

    error RedundantTransaction(uint64 fingerprint, uint8 hammingDistance);
    error InvalidFingerprint();
    error TooManyNeighbors();

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Registers an incoming transaction's Simhash fingerprint.
     * @param fingerprint  64-bit Simhash: V = sign(Σ w_i·h_i)
     * @param neighbors    Nearby fingerprints (provided off-chain)
     */
    function checkAndRegister(
        uint64 fingerprint,
        uint64[] calldata neighbors
    ) external nonReentrant returns (bool) {
        if (fingerprint == 0) revert InvalidFingerprint();
        if (neighbors.length > MAX_NEIGHBORS) revert TooManyNeighbors();

        if (fingerprintRegistry[fingerprint] != 0) {
            totalRejected++;
            emit FingerprintRejected(fingerprint, fingerprint, 0);
            revert RedundantTransaction(fingerprint, 0);
        }

        for (uint256 i = 0; i < neighbors.length; i++) {
            uint8 dist = _hammingDistance(fingerprint, neighbors[i]);
            if (dist < EPSILON) {
                totalRejected++;
                emit FingerprintRejected(fingerprint, neighbors[i], dist);
                revert RedundantTransaction(fingerprint, dist);
            }
        }

        fingerprintRegistry[fingerprint] = block.timestamp;
        totalAccepted++;
        emit FingerprintAccepted(fingerprint, msg.sender, block.timestamp);
        return true;
    }

    /**
     * @notice d_H(V1, V2) = popcount(V1 XOR V2) — Brian Kernighan's algorithm
     */
    function _hammingDistance(uint64 v1, uint64 v2) internal pure returns (uint8 dist) {
        uint64 xorVal = v1 ^ v2;
        while (xorVal != 0) {
            xorVal &= (xorVal - 1);
            dist++;
        }
    }

    function publicHammingDistance(uint64 v1, uint64 v2) external pure returns (uint8) {
        return _hammingDistance(v1, v2);
    }

    function isRegistered(uint64 fingerprint) external view returns (bool) {
        return fingerprintRegistry[fingerprint] != 0;
    }

    function stats() external view returns (
        uint256 accepted, uint256 rejected, uint256 total, uint256 spamRateBps
    ) {
        accepted    = totalAccepted;
        rejected    = totalRejected;
        total       = accepted + rejected;
        spamRateBps = total > 0 ? (rejected * 10_000) / total : 0;
    }
}
