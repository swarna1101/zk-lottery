const { ethers } = require("hardhat");

async function main() {
  // Deploy the verifier contract first
  const Verifier = await ethers.getContractFactory("Verifier");
  const verifier = await Verifier.deploy();
  await verifier.deployed();
  console.log("Verifier deployed to:", verifier.address);

  // Deploy the lottery contract
  const TaikoLottery = await ethers.getContractFactory("TaikoLottery");
  
  // These are example values - replace with actual values for your deployment
  const entropyAddress = "0x..."; // Pyth Entropy contract address
  const entropyProvider = "0x..."; // Pyth Entropy provider address
  const feeRecipient = "0x..."; // Address to receive fees
  const feePercent = 500; // 5% fee (500 basis points)
  
  const lottery = await TaikoLottery.deploy(
    entropyAddress,
    entropyProvider,
    feeRecipient,
    feePercent,
    verifier.address
  );
  
  await lottery.deployed();
  console.log("TaikoLottery deployed to:", lottery.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 