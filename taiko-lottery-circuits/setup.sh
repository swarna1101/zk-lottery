#!/bin/bash

mkdir -p build

echo "Step 1: Compiling circuit..."
circom circuits/ticket_ownership.circom --r1cs --wasm --sym -o build -l node_modules

echo "Step 2: Performing Powers of Tau ceremony (Phase 1)..."
snarkjs powersoftau new bn128 14 build/pot12_0000.ptau -v

echo "Step 3: Contributing to Powers of Tau ceremony..."
snarkjs powersoftau contribute build/pot12_0000.ptau build/pot12_0001.ptau --name="First contribution" -v -e="random entropy"

echo "Step 4: Preparing for Phase 2..."
snarkjs powersoftau prepare phase2 build/pot12_0001.ptau build/pot12_final.ptau -v

echo "Step 5: Generating zKey file (Phase 2)..."
snarkjs groth16 setup build/ticket_ownership.r1cs build/pot12_final.ptau build/ticket_ownership_0000.zkey

echo "Step 6: Contributing to Phase 2 ceremony..."
snarkjs zkey contribute build/ticket_ownership_0000.zkey build/ticket_ownership_0001.zkey --name="Second contribution" -e="more random entropy"

echo "Step 7: Exporting verification key..."
snarkjs zkey export verificationkey build/ticket_ownership_0001.zkey build/verification_key.json

echo "Step 8: Generating Solidity verifier..."
snarkjs zkey export solidityverifier build/ticket_ownership_0001.zkey build/TicketVerifier.sol

echo "Setup complete! Files are in the build directory."