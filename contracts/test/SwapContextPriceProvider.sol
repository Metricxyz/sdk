// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.35;

interface ISwapContextPool {
    function inSwap() external view returns (address);
}

/// @notice Models OracleBase's read gate as observed through an attributed price provider:
///         zero-origin eth_call reads, or a registered pool actively swapping with this provider.
contract SwapContextPriceProvider {
    address public immutable token0;
    address public immutable token1;
    mapping(address => bool) public registeredPool;

    error InvalidInSwap();
    error NotRegistered();

    constructor(address token0_, address token1_) {
        token0 = token0_;
        token1 = token1_;
    }

    function setRegisteredPool(address pool, bool registered) external {
        registeredPool[pool] = registered;
    }

    function getQuote() external view returns (uint128 bid, uint128 ask, uint128 referencePrice) {
        if (tx.origin != address(0)) {
            require(ISwapContextPool(msg.sender).inSwap() == address(this), InvalidInSwap());
            require(registeredPool[msg.sender], NotRegistered());
        }
        referencePrice = uint128(1 << 64);
        bid = referencePrice - referencePrice / 10_000;
        ask = referencePrice + referencePrice / 10_000;
    }
}
