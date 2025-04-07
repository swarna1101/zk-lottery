// utils.js
import * as snarkjs from "snarkjs";

// For client-side only
let poseidon;
let poseidonInitialized = false;

// Initialize poseidon (should be called client-side)
async function initPoseidon() {
  if (typeof window === "undefined") return; // Skip on server-side

  if (!poseidonInitialized) {
    // Dynamic import circomlibjs only on client side
    const circomlibjs = await import("circomlibjs");
    poseidon = await circomlibjs.buildPoseidon();
    poseidonInitialized = true;
  }
  return poseidon;
}

// Generate commitment from a secret
export async function generateCommitment(secret: any) {
  // Ensure poseidon is initialized
  if (!poseidonInitialized) {
    await initPoseidon();
  }

  // Convert secret to BigInt
  const secretBigInt = BigInt(secret);

  // Calculate the Poseidon hash
  const hash = poseidon([secretBigInt]);

  // Convert to a string representation that can be used in the contract
  const decimalCommitment = poseidon.F.toString(hash);

  // Convert to hex string (prefixed with 0x) and ensure it's a proper 32-byte (64 character) hex string
  let hexValue = BigInt(decimalCommitment).toString(16);
  // Pad with leading zeros if necessary to ensure even length
  if (hexValue.length % 2 !== 0) {
    hexValue = "0" + hexValue;
  }
  // Pad to 64 characters (32 bytes)
  hexValue = hexValue.padStart(64, "0");
  const hexCommitment = "0x" + hexValue;

  return {
    decimal: decimalCommitment,
    hex: hexCommitment,
  };
}

// Generate a proof that you know the secret corresponding to the commitment
export async function generateProof(secret, commitment, ticketIndex) {
  // If commitment is an object with decimal property, use that
  const commitmentValue =
    typeof commitment === "object" ? commitment.decimal : commitment;

  // Create witness input
  const input = {
    secret: secret,
    commitment: commitmentValue,
    ticketIndex: ticketIndex,
  };

  console.log("Generating proof with inputs:", input);

  try {
    // Generate the proof
    // Note: In Next.js you should store wasm and zkey files in the public directory
    // and reference them with absolute URLs
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      "/ticket_ownership.wasm", // Update path to your public directory
      "/ticket_ownership_0001.zkey" // Update path to your public directory
    );

    console.log("Proof generated successfully!");

    // We'll return both the raw proof (for verification) and the formatted proof (for the contract)
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
// In your utils.js file, update the formatProofForContract function:

async function formatProofForContract(proof, publicSignals) {
  // Format the proof for the Solidity contract
  const calldata = await snarkjs.groth16.exportSolidityCallData(
    proof,
    publicSignals
  );

  // Parse the calldata
  const calldataArray = calldata.split(",").map((x) => x.trim());

  // Format as contract expects - crucial to clean up the data properly
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

// Run with custom parameters
export async function runWithParams(secret, ticketIndex) {
  try {
    console.log("Secret:", secret);
    console.log("Using ticket index:", ticketIndex);

    // Generate commitment
    const commitment = await generateCommitment(secret);
    console.log("Commitment (decimal):", commitment.decimal);
    console.log("Commitment (hex):", commitment.hex);

    // Generate proof for specified ticket index
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

    // Verify proof locally to confirm it works (optional in browser environment)
    try {
      // Fetch verification key from public directory
      const vKeyResponse = await fetch("/verification_key.json");
      const vKey = await vKeyResponse.json();

      // Use the raw proof and public signals for verification
      const isValid = await snarkjs.groth16.verify(
        vKey,
        proofData.rawPublicSignals,
        proofData.rawProof
      );
      console.log("Proof verification result:", isValid);

      // Output clean formatted values for UI
      console.log("\n\n========= FORMATTED FOR CONTRACT =========");
      console.log("a parameter:");
      console.log(JSON.stringify([a[0], a[1]]));
      console.log("\nb parameter:");
      console.log(
        JSON.stringify([
          [b[0][0], b[0][1]],
          [b[1][0], b[1][1]],
        ])
      );
      console.log("\nc parameter:");
      console.log(JSON.stringify([c[0], c[1]]));
      console.log("========================================\n");

      return {
        commitment,
        proof: proofData.formatted,
        verified: isValid,
      };
    } catch (verifyError) {
      console.warn("Couldn't verify proof locally:", verifyError);
      // Continue without verification
      return {
        commitment,
        proof: proofData.formatted,
        verified: null,
      };
    }
  } catch (error) {
    console.error("Process failed:", error);
    throw error;
  }
}

// Example usage
export async function runExample() {
  const secret = "98236878"; // For testing; use a secure random value in production
  const ticketIndex = 0;
  return runWithParams(secret, ticketIndex);
}

// Export a function to initialize everything
export async function initializeUtils() {
  if (typeof window !== "undefined") {
    await initPoseidon();
    return true;
  }
  return false;
}
