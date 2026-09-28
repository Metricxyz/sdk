// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

interface IExternalSwapTestToken {
  function transferFrom(address from, address to, uint256 amount) external returns (bool);
  function transfer(address to, uint256 amount) external returns (bool);
}

contract MockExternalSwapTarget {
  function swapTo(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, address recipient) external {
    require(IExternalSwapTestToken(tokenIn).transferFrom(msg.sender, address(this), amountIn));
    require(IExternalSwapTestToken(tokenOut).transfer(recipient, amountOut));
  }

  function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut) external {
    require(IExternalSwapTestToken(tokenIn).transferFrom(msg.sender, address(this), amountIn));
    require(IExternalSwapTestToken(tokenOut).transfer(msg.sender, amountOut));
  }
}
