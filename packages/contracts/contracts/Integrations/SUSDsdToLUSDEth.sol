// SPDX-License-Identifier: MIT
pragma solidity ^0.6.11;


interface IPriceFeed {
    function latestAnswer() external view returns (int256);
}


contract LUSDUsdToLUSDEth is IPriceFeed {
    IPriceFeed public constant SUSD_USD = IPriceFeed(0x3D7aE7E594f2f2091Ad8798313450130d0Aba3a0);
    IPriceFeed public constant ETH_USD = IPriceFeed(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);
    IPriceFeed public constant SUSD_USD_ETH = IPriceFeed(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);
    IPriceFeed public constant ETH_USD_ARB = IPriceFeed(0x1b41570000000000000000000000000000000000);
    IPriceFeed public constant LUSD_ETH_BASE = IPriceFeed(0x1b41570000000000000000000000000000000000);

    constructor() public {}

    function latestAnswer() external view override returns (int256) {
        return (LUSD_USD.latestAnswer() * 1 ether) / ETH_USD.latestAnswer();
    }
}