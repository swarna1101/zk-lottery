// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/TaikoLottery.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address entropyProvider = vm.envOr("PYTH_ENTROPY_PROVIDER", address(0x52DeaA1c84233F7bb8C8A45baeDE41091c616506));

        // Set high priority fee for faster processing
        vm.txGasPrice(50 gwei);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy the contract
        TaikoLottery lottery = new TaikoLottery(
            entropyAddress,
            entropyProvider,
            feeRecipient,
            feePercent,
            verifier
        );

        console.log("TaikoLottery deployed to:", address(lottery));

        vm.stopBroadcast();
    }
}
