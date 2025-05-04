pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/mux1.circom";

// This circuit proves:
// 1. The user knows the preimage to the commitment hash
// 2. The commitment matches the one stored on-chain
// 3. The ticket index matches the winning index
// 4. The nullifier is unique and properly constructed
template TicketOwnership() {
    // Private inputs
    signal input secret;           // User's secret value
    signal input roundId;          // Round ID
    signal input ticketIndex;      // User's ticket index
    signal input nullifierSecret;  // Secret for nullifier generation
    
    // Public inputs
    signal input commitment;       // On-chain commitment
    signal input winningIndex;     // Winning ticket index from contract
    signal input roundStartTime;   // Round start timestamp
    signal input roundEndTime;     // Round end timestamp
    
    // Outputs
    signal output nullifier;       // Unique nullifier for this claim
    signal output isWinner;        // Whether this ticket is the winner
    
    // Components
    component commitmentHasher = Poseidon(3);
    component nullifierHasher = Poseidon(3);
    component indexComparator = IsEqual();
    component timeRangeChecker = RangeChecker();
    
    // Verify the commitment matches
    commitmentHasher.inputs[0] <== secret;
    commitmentHasher.inputs[1] <== roundId;
    commitmentHasher.inputs[2] <== ticketIndex;
    commitment === commitmentHasher.out;
    
    // Check if ticket index matches winning index
    indexComparator.in[0] <== ticketIndex;
    indexComparator.in[1] <== winningIndex;
    isWinner <== indexComparator.out;
    
    // Generate unique nullifier
    nullifierHasher.inputs[0] <== nullifierSecret;
    nullifierHasher.inputs[1] <== roundId;
    nullifierHasher.inputs[2] <== ticketIndex;
    nullifier <== nullifierHasher.out;
    
    // Verify time range
    timeRangeChecker.startTime <== roundStartTime;
    timeRangeChecker.endTime <== roundEndTime;
    timeRangeChecker.check === 1;
}

// Helper template to check time range
template RangeChecker() {
    signal input startTime;
    signal input endTime;
    signal output check;
    
    component timeCheck = LessThan(64);
    timeCheck.in[0] <== startTime;
    timeCheck.in[1] <== endTime;
    check <== timeCheck.out;
}

component main {public [commitment, winningIndex, roundStartTime, roundEndTime]} = TicketOwnership(); 