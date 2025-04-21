# Taiko ZK Lottery

A decentralized lottery system built on Taiko using zero-knowledge proofs for privacy.

## Project Structure

```
zk-lottery/
├── contracts/           # Smart contracts
│   ├── core/           # Main contract implementations
│   │   └── TaikoLottery.sol
│   └── interfaces/     # Contract interfaces
│       ├── IERC20.sol
│       └── IVerifier.sol
├── circuits/           # ZK circuit implementations
│   └── lottery/
│       └── ticket_ownership.circom
├── scripts/           # Deployment and test scripts
│   ├── deploy.js
│   └── test.js
├── test/             # Test files
├── hardhat.config.js # Hardhat configuration
├── .env              # Environment configuration
└── package.json      # Project dependencies
```

## Features

- Multi-round lottery system
- Private ticket ownership using ZK proofs
- Pyth VRF for random winner selection
- TAIKO token integration
- Anti-double-spending mechanism
- Time-based round management

## Prerequisites

- Node.js (v16 or later)
- Taiko testnet access
- TAIKO tokens for testing

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
- Copy `.env.example` to `.env`
- Add your private key
- Set Pyth Entropy contract address
- Set Pyth provider address
- Set fee recipient address

3. Compile and setup:
```bash
# Compile ZK circuits
npm run compile:circuits

# Setup ZK proving system
npm run setup:circuits

# Generate verifier contract
npm run generate:verifier

# Compile contracts
npm run compile
```

## Development

```bash
# Run tests
npm run test

# Deploy to Taiko testnet
npm run deploy

# Lint contracts
npm run lint

# Format contracts
npm run prettier

# Clean build files
npm run clean
```

## Smart Contract Architecture

1. **TaikoLottery.sol**
   - Multi-round lottery management
   - Ticket purchase handling
   - Prize distribution
   - ZK proof verification

2. **ZK Circuit (ticket_ownership.circom)**
   - Ticket ownership verification
   - Time window validation
   - Double-spending prevention

## Security Features

- Reentrancy protection
- Access control
- Nullifier system
- Time-based validations
- Commitment uniqueness

