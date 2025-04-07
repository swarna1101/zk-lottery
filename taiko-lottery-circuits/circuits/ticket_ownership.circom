pragma circom 2.0.0;

// Import poseidon from the correct location in latest circomlib
include "../node_modules/circomlib/circuits/poseidon.circom";

// This circuit proves that a user knows the preimage to the commitment hash
// of the winning ticket without revealing the actual preimage
template TicketOwnership() {
    // Private inputs
    signal input secret; // The secret value known only to the ticket owner
    
    // Public inputs
    signal input commitment; // The commitment hash stored on-chain
    signal input ticketIndex; // The winning ticket index
    
    // Compute the hash of the secret and verify it matches the commitment
    component hasher = Poseidon(1);
    hasher.inputs[0] <== secret;
    
    // Verify the computed hash matches the commitment
    hasher.out === commitment;
    
    // Note: ticketIndex is just passed through as a public input
    // to identify which ticket we're proving ownership of
}

// Specify which signals are public inputs
component main { public [commitment, ticketIndex] } = TicketOwnership();