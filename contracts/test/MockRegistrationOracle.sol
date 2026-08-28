// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.35;

/// @notice Minimal faithful stand-in for the abuse-protected providers oracle's registration surface
///         (smart-contracts-poc OracleBase): the pieces the SDK's registerPool/status helpers touch.
///         Mirrors OracleBase.register's checks (fee, approved factory, isPool, blacklist-clear).
interface IPoolFactoryLike {
    function isPool(address pool) external view returns (bool);
}

contract MockRegistrationOracle {
    mapping(address => bool) public blacklisted;
    mapping(bytes32 => mapping(address => bool)) public registeredPool;
    uint256 public registrationFee;
    mapping(address => bool) public approvedFactory;

    event PoolRegistered(bytes32 indexed feedId, address indexed pool, address indexed payer, uint256 fee);
    event BlacklistUpdated(address indexed account, bool blacklisted);

    error InsufficientFee(uint256 sent, uint256 required);
    error FactoryNotApproved(address factory);
    error NotAPool(address pool);

    // ── Test setup ────────────────────────────────────────────────────────
    function setRegistrationFee(uint256 fee) external {
        registrationFee = fee;
    }

    function setApprovedFactory(address factory, bool approved) external {
        approvedFactory[factory] = approved;
    }

    function setBlacklist(address account, bool value) external {
        blacklisted[account] = value;
        emit BlacklistUpdated(account, value);
    }

    // ── Registration (mirrors OracleBase.register) ──────────────────────────
    function register(bytes32 feedId, address pool, address factory) external payable {
        require(msg.value >= registrationFee, InsufficientFee(msg.value, registrationFee));
        require(pool != address(0));
        require(approvedFactory[factory], FactoryNotApproved(factory));
        require(IPoolFactoryLike(factory).isPool(pool), NotAPool(pool));

        if (blacklisted[pool]) {
            blacklisted[pool] = false;
            emit BlacklistUpdated(pool, false);
        }

        registeredPool[feedId][pool] = true;
        emit PoolRegistered(feedId, pool, msg.sender, msg.value);
    }
}

/// @notice Minimal pool factory recognized by the oracle's `isPool` gate.
contract MockPoolFactory {
    mapping(address => bool) public pools;

    function setPool(address pool, bool value) external {
        pools[pool] = value;
    }

    function isPool(address pool) external view returns (bool) {
        return pools[pool];
    }
}
