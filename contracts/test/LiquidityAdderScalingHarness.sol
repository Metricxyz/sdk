// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.35;

import {MetricOmmPoolLiquidityAdder, LiquidityDelta} from "@metric/periphery/contracts/MetricOmmPoolLiquidityAdder.sol";

/// @notice Exposes the pinned adder's actual sizing implementation for SDK parity tests.
contract LiquidityAdderScalingHarness is MetricOmmPoolLiquidityAdder {
    constructor() MetricOmmPoolLiquidityAdder(address(1), address(2)) {}

    function scale(
        LiquidityDelta calldata weights,
        uint256 max0,
        uint256 max1,
        uint256 need0,
        uint256 need1
    ) external pure returns (LiquidityDelta memory) {
        return _scaleWeightsToShares(weights, max0, max1, need0, need1);
    }
}
