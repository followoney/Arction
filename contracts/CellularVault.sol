// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title CellularVault
 * @notice Arc Testnet (Chain ID: 5042002) — Cellular parallel execution vault.
 *
 * Independence Condition:
 *   Independent(T_i, T_j) ⟺ {A_i, B_i} ∩ {A_j, B_j} = ∅
 *
 * Security: CEI Pattern (Check → Effect → Interact)
 *   1. CHECK:   Preconditions are validated.
 *   2. EFFECT:  State is updated.
 *   3. INTERACT: ERC-20 transfer is executed.
 *
 * ⚠ HYPOTHESIS: Proof mechanism uses keccak256 pre-image.
 *   For production, replace with ZK-SNARK or Circle Attestation.
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./SimhashChecker.sol";

contract CellularVault is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    struct Cell {
        bool    active;
        uint256 lockedAmount;
        address depositor;
        address recipient;
        bytes32 secretHash;
        uint256 deadline;
        uint64  fingerprint;
    }

    struct TriSyncState {
        bool sequenced;
        bool verified;
        bool settled;
    }

    IERC20         public immutable USDC;
    SimhashChecker public immutable checker;

    mapping(bytes32 => Cell)         public cells;
    mapping(bytes32 => TriSyncState) public triSyncStates;
    mapping(address => bytes32[])    public userCells;

    uint256 public totalValueLocked;

    event CellOpened(bytes32 indexed cellId, address indexed depositor, address indexed recipient, uint256 amount, uint64 fingerprint);
    event CellSettled(bytes32 indexed cellId, address indexed recipient, uint256 amount);
    event CellRefunded(bytes32 indexed cellId, address indexed depositor, uint256 amount);
    event TriSyncProgressed(bytes32 indexed cellId, bool sequenced, bool verified, bool settled);

    error CellAlreadyExists(bytes32 cellId);
    error CellNotFound(bytes32 cellId);
    error CellExpired(bytes32 cellId);
    error CellNotExpired(bytes32 cellId);
    error InvalidSecret(bytes32 cellId);
    error InsufficientAmount();
    error UnauthorizedCaller();
    error TriSyncIncomplete(bytes32 cellId);

    constructor(address _usdc, address _checker) Ownable(msg.sender) {
        USDC    = IERC20(_usdc);
        checker = SimhashChecker(_checker);
    }

    /**
     * @notice Opens a cell, locks USDC. Simhash validation is automatic.
     * @param recipient   Recipient address
     * @param amount      USDC amount (18 decimals native)
     * @param secretHash  keccak256(secret)
     * @param ttlSeconds  Cell time-to-live
     * @param fingerprint 64-bit Simhash (computed off-chain via lib/simhash.js)
     * @param neighbors   Nearby fingerprints
     * @param nonce       Unique nonce
     */
    function openCell(
        address   recipient,
        uint256   amount,
        bytes32   secretHash,
        uint256   ttlSeconds,
        uint64    fingerprint,
        uint64[]  calldata neighbors,
        uint256   nonce
    ) external nonReentrant returns (bytes32 cellId) {
        // CHECK
        if (amount == 0) revert InsufficientAmount();
        if (recipient == address(0) || recipient == msg.sender) revert UnauthorizedCaller();

        cellId = keccak256(abi.encodePacked(msg.sender, recipient, amount, nonce));
        if (cells[cellId].active) revert CellAlreadyExists(cellId);

        checker.checkAndRegister(fingerprint, neighbors);

        // EFFECT
        cells[cellId] = Cell({
            active:       true,
            lockedAmount: amount,
            depositor:    msg.sender,
            recipient:    recipient,
            secretHash:   secretHash,
            deadline:     block.timestamp + ttlSeconds,
            fingerprint:  fingerprint
        });
        triSyncStates[cellId] = TriSyncState({ sequenced: true, verified: true, settled: false });
        userCells[msg.sender].push(cellId);
        totalValueLocked += amount;

        // INTERACT
        USDC.safeTransferFrom(msg.sender, address(this), amount);

        emit CellOpened(cellId, msg.sender, recipient, amount, fingerprint);
        emit TriSyncProgressed(cellId, true, true, false);
    }

    /** @notice Settles a cell, sends funds to recipient (TriSync Step 3). */
    function settleCell(bytes32 cellId, bytes32 secret) external nonReentrant {
        // CHECK
        Cell storage cell = cells[cellId];
        if (!cell.active) revert CellNotFound(cellId);
        if (block.timestamp > cell.deadline) revert CellExpired(cellId);
        if (msg.sender != cell.recipient) revert UnauthorizedCaller();
        if (keccak256(abi.encodePacked(secret)) != cell.secretHash) revert InvalidSecret(cellId);

        TriSyncState storage ts = triSyncStates[cellId];
        if (!ts.sequenced || !ts.verified) revert TriSyncIncomplete(cellId);

        // EFFECT
        uint256 amt       = cell.lockedAmount;
        address rcpt      = cell.recipient;
        cell.active       = false;
        cell.lockedAmount = 0;
        ts.settled        = true;
        totalValueLocked -= amt;

        // INTERACT
        USDC.safeTransfer(rcpt, amt);

        emit CellSettled(cellId, rcpt, amt);
        emit TriSyncProgressed(cellId, true, true, true);
    }

    /** @notice Refunds an expired cell back to depositor. */
    function refundCell(bytes32 cellId) external nonReentrant {
        // CHECK
        Cell storage cell = cells[cellId];
        if (!cell.active) revert CellNotFound(cellId);
        if (block.timestamp <= cell.deadline) revert CellNotExpired(cellId);
        if (msg.sender != cell.depositor) revert UnauthorizedCaller();

        // EFFECT
        uint256 amt     = cell.lockedAmount;
        address dep     = cell.depositor;
        cell.active     = false;
        cell.lockedAmount = 0;
        totalValueLocked -= amt;

        // INTERACT
        USDC.safeTransfer(dep, amt);
        emit CellRefunded(cellId, dep, amt);
    }

    /** @notice Independence check: {A_i,B_i} ∩ {A_j,B_j} = ∅ */
    function areCellsIndependent(bytes32 c1, bytes32 c2) external view returns (bool) {
        Cell storage a = cells[c1];
        Cell storage b = cells[c2];
        return (
            a.depositor != b.depositor &&
            a.depositor != b.recipient &&
            a.recipient != b.depositor &&
            a.recipient != b.recipient
        );
    }

    function getUserCells(address user) external view returns (bytes32[] memory) {
        return userCells[user];
    }

    function getTriSyncState(bytes32 id) external view returns (bool, bool, bool) {
        TriSyncState storage ts = triSyncStates[id];
        return (ts.sequenced, ts.verified, ts.settled);
    }
}
