// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @dev The part of Uniswap's SwapRouter02 (IV3SwapRouter) we use. No deadline field in this version.
interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/**
 * @notice One per charity. Stakes use this contract as their donation_address, so a late
 * withdraw from WakeStake lands here in whatever token was staked. `donate` then swaps it on
 * Uniswap into the token the charity wants and forwards it.
 *
 * The slash and the swap are deliberately separate: if a swap can't happen (no liquidity,
 * weird token), the slash still goes through and the tokens wait here until it can.
 */
contract DonationRouter {
    using SafeERC20 for IERC20;

    ISwapRouter02 public immutable swapRouter;
    /// @notice receives the donations
    address public immutable charity;
    /// @notice the token the charity wants to receive
    address public immutable donationToken;

    event Donated(address indexed tokenIn, uint256 amountIn, uint256 amountOut);

    constructor(address _swapRouter, address _charity, address _donationToken) {
      require(_charity != address(0), "charity cannot be zero");
      swapRouter = ISwapRouter02(_swapRouter);
      charity = _charity;
      donationToken = _donationToken;
    }

    /**
     * @notice Swaps this contract's whole `_tokenIn` balance into `donationToken` and sends it to the charity.
     * Anyone can call it. `_amountOutMinimum` is the caller's slippage limit.
     * @dev hackathon trust model: the caller picks the minimum, so a malicious caller could let a sandwich
     * take a cut from the charity. For mainnet, derive the minimum from a price oracle / Uniswap TWAP instead.
     * @param _poolFee fee tier of the Uniswap v3 pool to swap through (500, 3000, 10000)
     */
    function donate(address _tokenIn, uint24 _poolFee, uint256 _amountOutMinimum) external returns (uint256 amountOut) {
      uint256 amountIn = IERC20(_tokenIn).balanceOf(address(this));
      require(amountIn > 0, "nothing to donate");

      if (_tokenIn == donationToken) {
        // already the right token, nothing to swap
        IERC20(_tokenIn).safeTransfer(charity, amountIn);
        emit Donated(_tokenIn, amountIn, amountIn);
        return amountIn;
      }

      IERC20(_tokenIn).forceApprove(address(swapRouter), amountIn);
      amountOut = swapRouter.exactInputSingle(
        ISwapRouter02.ExactInputSingleParams({
          tokenIn: _tokenIn,
          tokenOut: donationToken,
          fee: _poolFee,
          recipient: charity,
          amountIn: amountIn,
          amountOutMinimum: _amountOutMinimum,
          sqrtPriceLimitX96: 0
        })
      );
      emit Donated(_tokenIn, amountIn, amountOut);
    }
}
