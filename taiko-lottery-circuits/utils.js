const circomlibjs = require("circomlibjs");
const { groth16 } = require("snarkjs");
const fs = require("fs");

// Generate commitment from a secret
async function generateCommitment(secret) {
  const poseidon = await circomlibjs.buildPoseidon();
  const secretBigInt = BigInt(secret);
  const hash = poseidon([secretBigInt]);
  const decimalCommitment = poseidon.F.toString(hash);

  let hexValue = BigInt(decimalCommitment).toString(16);
  if (hexValue.length % 2 !== 0) {
    hexValue = "0" + hexValue;
  }

  hexValue = hexValue.padStart(64, "0");
  const hexCommitment = "0x" + hexValue;

  return {
    decimal: decimalCommitment,
    hex: hexCommitment,
  };
}

async function generateProof(secret, commitment, ticketIndex) {
  const commitmentValue =
    typeof commitment === "object" ? commitment.decimal : commitment;

  const input = {
    secret: secret,
    commitment: commitmentValue,
    ticketIndex: ticketIndex,
  };

  console.log("Generating proof with inputs:", input);

  try {
    const { proof, publicSignals } = await groth16.fullProve(
      input,
      "build/ticket_ownership_js/ticket_ownership.wasm",
      "build/ticket_ownership_0001.zkey"
    );

    console.log("Proof generated successfully!");

    const formattedProof = await formatProofForContract(proof, publicSignals);

    return {
      rawProof: proof,
      rawPublicSignals: publicSignals,
      formatted: formattedProof,
    };
  } catch (error) {
    console.error("Error generating proof:", error);
    throw error;
  }
}

// Format proof for the Solidity contract
async function formatProofForContract(proof, publicSignals) {
  const calldata = await groth16.exportSolidityCallData(proof, publicSignals);

  const calldataArray = calldata.split(",").map((x) => x.trim());

  return {
    a: [calldataArray[0], calldataArray[1]],
    b: [
      [calldataArray[2], calldataArray[3]],
      [calldataArray[4], calldataArray[5]],
    ],
    c: [calldataArray[6], calldataArray[7]],
    input: [calldataArray[8], calldataArray[9]],
  };
}

async function runWithParams(secret, ticketIndex) {
  try {
    console.log("Secret:", secret);
    console.log("Using ticket index:", ticketIndex);

    // Generate commitment
    const commitment = await generateCommitment(secret);
    console.log("Commitment (decimal):", commitment.decimal);
    console.log("Commitment (hex):", commitment.hex);

    if (!fs.existsSync("build/verification_key.json")) {
      console.error("Verification key not found. Run the setup script first.");
      return;
    }

    if (!fs.existsSync("build/ticket_ownership_js/ticket_ownership.wasm")) {
      console.error("WASM file not found. Run the setup script first.");
      return;
    }

    const proofData = await generateProof(secret, commitment, ticketIndex);
    console.log("Raw proof data:", JSON.stringify(proofData.rawProof));
    console.log("Public signals:", JSON.stringify(proofData.rawPublicSignals));
    console.log(
      "Formatted proof for contract:",
      JSON.stringify(proofData.formatted)
    );
    const { a, b, c } = proofData.formatted;
    console.log("a:", a);
    console.log("b:", b);
    console.log("c:", c);

    // Verify proof locally to confirm it works
    const vKey = JSON.parse(fs.readFileSync("build/verification_key.json"));

    const isValid = await groth16.verify(
      vKey,
      proofData.rawPublicSignals,
      proofData.rawProof
    );
    console.log("Proof verification result:", isValid);

    return {
      commitment,
      proof: proofData.formatted,
      verified: isValid,
    };
  } catch (error) {
    console.error("Example failed:", error);
    console.error(error);
  }
}

// Example usage
async function runExample() {
  const secret = "98236878"; // For testing; use a secure random value in production
  const ticketIndex = 0;
  return runWithParams(secret, ticketIndex);
}

// Parse command line arguments if running directly
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length >= 2) {
    const secret = args[0];
    const ticketIndex = parseInt(args[1], 10);

    if (isNaN(ticketIndex)) {
      console.error("Error: Ticket index must be a number");
      console.log("Usage: node utils.js <secret> <ticketIndex>");
      process.exit(1);
    }

    runWithParams(secret, ticketIndex).catch(console.error);
  } else {
    console.log("No parameters provided, running with default values");
    runExample().catch(console.error);
  }
}

module.exports = {
  generateCommitment,
  generateProof,
  formatProofForContract,
  runExample,
  runWithParams,
};
