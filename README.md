# ZK Lottery

A decentralized lottery system built on Taiko using zero-knowledge proofs for privacy.

## Overview

This project implements a privacy-preserving lottery system on the Taiko network. It uses zero-knowledge proofs to allow users to participate in lotteries while keeping their ticket numbers private until the reveal phase.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js and npm
- [Circom](https://docs.circom.io/getting-started/installation/) (for ZK circuit compilation)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/zk-lottery.git
cd zk-lottery
```

2. Install dependencies:
```bash
npm install
forge install
```

3. Copy the environment file and configure it:
```bash
cp .env.example .env
```

## Development

### Build
```bash
forge build
```

### Test
```bash
forge test
```

### Deploy
```bash
forge script script/Deploy.s.sol:DeployScript --rpc-url $TAIKO_RPC_URL --broadcast --verify
```

### Circuit Development

1. Compile the circuits:
```bash
npm run compile:circuits
```

2. Setup the circuits:
```bash
npm run setup:circuits
```

3. Generate the Solidity verifier:
```bash
npm run generate:verifier
```

## Contract Addresses

- TaikoLottery: [0x6DBe6f02628BeaB47c4d7f648BD8b10269bb8ad3](https://hekla.taikoscan.io/address/0x6dbe6f02628beab47c4d7f648bd8b10269bb8ad3)
- Entropy Provider: [0x52DeaA1c84233F7bb8C8A45baeDE41091c616506](https://hekla.taikoscan.io/address/0x52DeaA1c84233F7bb8C8A45baeDE41091c616506)

## License

MIT
