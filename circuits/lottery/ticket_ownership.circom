pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";

// This circuit proves:
// 1. The user knows the preimage to the commitment hash
// 2. The user has a valid ticket quantity
// 3. The ticket was purchased within the valid time window
// 4. The ticket hasn't been claimed before (nullifier)
template TicketOwnership() {
    // Private inputs
    signal input secret;           // The secret value known only to the ticket owner
    signal input ticketQuantity;   // Number of tickets owned
    signal input purchaseTime;     // Timestamp when ticket was purchased
    signal input nullifierSecret;  // Secret for nullifier generation
    
    // Public inputs
    signal input commitment;       // The commitment hash stored on-chain
    signal input ticketIndex;      // The winning ticket index
    signal input currentTime;      // Current timestamp
    signal input roundStartTime;   // Round start timestamp
    signal input roundEndTime;     // Round end timestamp
    signal input maxTicketsPerUser;// Maximum tickets allowed per user
    
    // Outputs
    signal output nullifier;       // Unique identifier for this ticket claim
    signal output validTimeWindow; // Whether ticket was purchased in valid time window
    
    // Components
    component hasher = Poseidon(1);
    component timeCheckerStart = LessThan(64);
    component timeCheckerEnd = LessThan(64);
    component quantityChecker = LessEqThan(64);
    component nullifierHasher = Poseidon(2);
    
    // Verify the commitment hash
    hasher.inputs[0] <== secret;
    hasher.out === commitment;
    
    // Verify ticket quantity is within limits
    quantityChecker.in[0] <== ticketQuantity;
    quantityChecker.in[1] <== maxTicketsPerUser;
    quantityChecker.out === 1;
    
    // Verify purchase time is within round window
    timeCheckerStart.in[0] <== purchaseTime;
    timeCheckerStart.in[1] <== roundStartTime;
    signal afterStart;
    afterStart <== timeCheckerStart.out;
    
    timeCheckerEnd.in[0] <== roundEndTime;
    timeCheckerEnd.in[1] <== purchaseTime;
    signal beforeEnd;
    beforeEnd <== timeCheckerEnd.out;
    
    validTimeWindow <== afterStart * beforeEnd;
    
    // Generate nullifier to prevent double-spending
    nullifierHasher.inputs[0] <== nullifierSecret;
    nullifierHasher.inputs[1] <== ticketIndex;
    nullifier <== nullifierHasher.out;
}

// Specify which signals are public inputs
component main { 
    public [commitment, ticketIndex, currentTime, roundStartTime, roundEndTime, maxTicketsPerUser] 
} = TicketOwnership(); 