const { ethers } = require("hardhat");
const { buildPoseidon } = require("circomlibjs");

async function main() {
  // Connect to the deployed contract
  const lotteryAddress = "0x..."; // Replace with your deployed contract address
  const TaikoLottery = await ethers.getContractFactory("TaikoLottery");
  const lottery = await TaikoLottery.attach(lotteryAddress);

  // Example of how to buy a ticket
  async function buyTicket(secret) {
    const poseidon = await buildPoseidon();
    const commitment = poseidon.F.toString(poseidon([secret]));
    
    // Approve TAIKO token transfer
    const taikoToken = await ethers.getContractAt("IERC20", await lottery.TAIKO_TOKEN());
    const ticketPrice = await lottery.TICKET_PRICE();
    await taikoToken.approve(lotteryAddress, ticketPrice);
    
    // Buy ticket
    const tx = await lottery.buyTicket(commitment);
    await tx.wait();
    console.log("Ticket purchased with commitment:", commitment);
  }

  // Example of how to start a new round
  async function startNewRound() {
    const durationBlocks = 100; // 100 blocks duration
    const tx = await lottery.startNewRound(durationBlocks);
    await tx.wait();
    console.log("New round started");
  }

  // Example of how to end a round
  async function endRound() {
    const tx = await lottery.endRound();
    await tx.wait();
    console.log("Round ended");
  }

  // Example of how to claim prize (this would be done by the winner)
  async function claimPrize(roundId, secret, ticketIndex) {
    // This is a simplified example. In reality, you would need to:
    // 1. Generate the ZK proof using the circuit
    // 2. Generate the nullifier
    // 3. Call the contract with the proof and nullifier
    
    const poseidon = await buildPoseidon();
    const nullifierSecret = ethers.utils.randomBytes(32);
    const nullifier = poseidon.F.toString(poseidon([nullifierSecret, ticketIndex]));
    
    // This is a placeholder for the actual ZK proof
    const proof = {
      a: [0, 0],
      b: [[0, 0], [0, 0]],
      c: [0, 0],
      input: [0, nullifier]
    };
    
    const tx = await lottery.claimPrize(
      roundId,
      proof.a,
      proof.b,
      proof.c,
      proof.input
    );
    await tx.wait();
    console.log("Prize claimed");
  }

  // Example usage
  try {
    // Start a new round
    await startNewRound();
    
    // Buy some tickets
    const secret1 = ethers.utils.randomBytes(32);
    const secret2 = ethers.utils.randomBytes(32);
    await buyTicket(secret1);
    await buyTicket(secret2);
    
    // End the round
    await endRound();
    
    // Note: In a real scenario, you would need to wait for the entropy callback
    // and then the winner would claim their prize using the claimPrize function
    
    console.log("Test completed successfully");
  } catch (error) {
    console.error("Error during test:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 