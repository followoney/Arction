// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SimhashChecker is Ownable, ReentrancyGuard {
    mapping(uint64 => uint256) public fingerprintRegistry;
    address public authorizedVault;
    
    uint256 public totalChecks;
    uint256 public totalRejected;

    event FingerprintRegistered(uint64 indexed fingerprint, uint256 timestamp);
    event FingerprintRejected(uint64 indexed fingerprint, uint64 indexed neighbor, uint256 distance);
    event VaultAuthorized(address indexed vault);

    constructor() Ownable(msg.sender) {}

    function setAuthorizedVault(address _vault) external onlyOwner {
        authorizedVault = _vault;
        emit VaultAuthorized(_vault);
    }

    function checkAndRegister(
        uint64 fingerprint,
        uint64[] calldata neighbors
    ) external nonReentrant returns (bool) {
        // Vault veya Owner çağırabilir
        require(msg.sender == owner() || msg.sender == authorizedVault, "Unauthorized: Only Vault or Owner");
        
        if (fingerprint == 0) return false;
        
        totalChecks++;

        // 1. Redundancy Check
        if (fingerprintRegistry[fingerprint] != 0) {
            totalRejected++;
            emit FingerprintRejected(fingerprint, fingerprint, 0);
            revert("Redundant Transaction");
        }

        // 2. Similarity Check (Distance < 3 is suspicious)
        for (uint256 i = 0; i < neighbors.length; i++) {
            uint256 dist = hammingDistance(fingerprint, neighbors[i]);
            if (dist < 3) {
                totalRejected++;
                emit FingerprintRejected(fingerprint, neighbors[i], dist);
                revert("Spam Detected: Too similar");
            }
        }

        fingerprintRegistry[fingerprint] = block.timestamp;
        emit FingerprintRegistered(fingerprint, block.timestamp);
        return true;
    }

    function hammingDistance(uint64 x, uint64 y) public pure returns (uint256) {
        uint64 val = x ^ y;
        uint256 dist = 0;
        while (val > 0) {
            if (val & 1 == 1) dist++;
            val >>= 1;
        }
        return dist;
    }
}
