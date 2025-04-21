import { writable, get } from 'svelte/store';
import { ethers } from 'ethers';

// Define contract interface
interface TaikoLottery extends ethers.Contract {
    currentRound(): Promise<ethers.BigNumber>;
    TICKET_PRICE(): Promise<ethers.BigNumber>;
    getRoundInfo(roundId: ethers.BigNumber): Promise<[ethers.BigNumber, ethers.BigNumber, ethers.BigNumber, ethers.BigNumber, boolean]>;
    startNewRound(durationBlocks: number): Promise<ethers.ContractTransaction>;
    buyTicket(commitment: string): Promise<ethers.ContractTransaction>;
    endRound(): Promise<ethers.ContractTransaction>;
    claimPrize(
        roundId: number,
        a: number[],
        b: number[][],
        c: number[],
        input: number[]
    ): Promise<ethers.ContractTransaction>;
    owner(): Promise<string>;
}

// Contract ABI
export const contractAbi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_entropy",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_entropyProvider",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_feeRecipient",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_feePercent",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_verifier",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "FeesDistributed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "winner",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "PrizeClaimed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "winningIndex",
        "type": "uint256"
      }
    ],
    "name": "RoundClosed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      }
    ],
    "name": "RoundReset",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "endBlock",
        "type": "uint256"
      }
    ],
    "name": "RoundStarted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "roundId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "ticketId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "commitment",
        "type": "bytes32"
      }
    ],
    "name": "TicketPurchased",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "TAIKO_TOKEN",
    "outputs": [
      {
        "internalType": "contract IERC20",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "TICKET_PRICE",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_commitment",
        "type": "bytes32"
      }
    ],
    "name": "buyTicket",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_roundId",
        "type": "uint256"
      },
      {
        "internalType": "uint256[2]",
        "name": "a",
        "type": "uint256[2]"
      },
      {
        "internalType": "uint256[2][2]",
        "name": "b",
        "type": "uint256[2][2]"
      },
      {
        "internalType": "uint256[2]",
        "name": "c",
        "type": "uint256[2]"
      },
      {
        "internalType": "uint256[2]",
        "name": "input",
        "type": "uint256[2]"
      }
    ],
    "name": "claimPrize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "currentRound",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "endRound",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "entropy",
    "outputs": [
      {
        "internalType": "contract IEntropy",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "entropyProvider",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "feePercent",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "feeRecipient",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_roundId",
        "type": "uint256"
      }
    ],
    "name": "getRoundInfo",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "endBlock",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "ticketCount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "prizePool",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "winningIndex",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "isEnded",
            "type": "bool"
          }
        ],
        "internalType": "struct TaikoLottery.Round",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_roundId",
        "type": "uint256"
      }
    ],
    "name": "resetRound",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_durationBlocks",
        "type": "uint256"
      }
    ],
    "name": "startNewRound",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "tickets",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "verifier",
    "outputs": [
      {
        "internalType": "contract IVerifier",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const RPC_URL = import.meta.env.VITE_TAIKO_RPC_URL || 'https://rpc.hekla.taiko.xyz';

if (!CONTRACT_ADDRESS) {
    console.error('Contract address not set in environment variables');
}

// Store for contract state
export const provider = writable<ethers.providers.JsonRpcProvider | ethers.providers.Web3Provider | null>(null);
export const signer = writable<ethers.Signer | null>(null);
export const contract = writable<TaikoLottery | null>(null);
export const currentRound = writable<{
    id: ethers.BigNumber;
    endBlock: ethers.BigNumber;
    ticketCount: ethers.BigNumber;
    winningIndex: ethers.BigNumber;
    prizePool: ethers.BigNumber;
    isEnded: boolean;
} | null>(null);
export const ticketPrice = writable<string>('0');
export const isConnected = writable<boolean>(false);
export const errorMessage = writable<string>('');
export const userAddress = writable<string>('');
export const isOwner = writable<boolean>(false);
export const connectionType = writable<'metamask' | 'privateKey'>('metamask');

let web3Provider: ethers.providers.JsonRpcProvider | ethers.providers.Web3Provider | null = null;
let contractInstance: TaikoLottery | null = null;

// Initialize contract state
export async function initializeContract() {
    try {
        if (!window.ethereum) {
            throw new Error('MetaMask not installed');
        }

        if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
            throw new Error('Contract address not set or invalid');
        }

        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const currentAccount = accounts[0];
        
        // Create Web3Provider and get network
        web3Provider = new ethers.providers.Web3Provider(window.ethereum);
        const network = await web3Provider.getNetwork();
        
        // Check if we're on Taiko Hekla testnet (chain ID: 167009)
        if (network.chainId !== 167009) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0x28c31' }], // 167009 in hex
                });
            } catch (switchError: any) {
                // If the chain hasn't been added to MetaMask
                if (switchError.code === 4902) {
                    try {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [{
                                chainId: '0x28c31',
                                chainName: 'Taiko Hekla Testnet',
                                nativeCurrency: {
                                    name: 'ETH',
                                    symbol: 'ETH',
                                    decimals: 18
                                },
                                rpcUrls: ['https://rpc.hekla.taiko.xyz'],
                                blockExplorerUrls: ['https://explorer.hekla.taiko.xyz']
                            }]
                        });
                    } catch (addError) {
                        throw new Error('Failed to add Taiko network to MetaMask');
                    }
                } else {
                    throw new Error('Failed to switch to Taiko network');
                }
            }
            
            // Refresh provider after network switch
            web3Provider = new ethers.providers.Web3Provider(window.ethereum);
        }
        
        const web3Signer = web3Provider.getSigner();
        
        // Create contract instance
        contractInstance = new ethers.Contract(CONTRACT_ADDRESS, contractAbi, web3Signer) as TaikoLottery;

        // Update stores
        provider.set(web3Provider);
        signer.set(web3Signer);
        contract.set(contractInstance);
        userAddress.set(currentAccount);
        connectionType.set('metamask');

        // Check if user is contract owner
        const ownerAddress = await contractInstance.owner();
        isOwner.set(ownerAddress.toLowerCase() === currentAccount.toLowerCase());
        
        // Get contract state
        await updateContractState();

        // Setup event listeners for account and chain changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        isConnected.set(true);
        errorMessage.set('');
    } catch (error: any) {
        console.error('Failed to initialize contract:', error);
        isConnected.set(false);
        errorMessage.set(formatError(error));
        throw error;
    }
}

function formatError(error: any): string {
    if (error.code === 'CALL_EXCEPTION') {
        return 'Contract interaction failed. Please make sure you are on the correct network.';
    }
    if (error.code === 'NETWORK_ERROR') {
        return 'Network error. Please check your connection and try again.';
    }
    if (error.message.includes('user rejected')) {
        return 'Transaction was rejected by user.';
    }
    return error.reason || error.message || 'An unknown error occurred';
}

async function updateContractState() {
    if (!contractInstance) return;
    
    try {
        const roundId = await contractInstance.currentRound();
        const price = await contractInstance.TICKET_PRICE();
        const roundInfo = await contractInstance.getRoundInfo(roundId);
        
        currentRound.set({
            id: roundId,
            endBlock: roundInfo[0],
            ticketCount: roundInfo[1],
            winningIndex: roundInfo[2],
            prizePool: roundInfo[3],
            isEnded: roundInfo[4]
        });
        
        ticketPrice.set(ethers.utils.formatEther(price));
    } catch (error: any) {
        console.error('Failed to update contract state:', error);
        errorMessage.set(formatError(error));
    }
}

function handleAccountsChanged(accounts: string[]) {
    if (accounts.length === 0) {
        disconnectWallet();
    } else {
        initializeContract();
    }
}

function handleChainChanged(_chainId: string) {
    window.location.reload();
}

export function disconnectWallet() {
    isConnected.set(false);
    provider.set(null);
    signer.set(null);
    contract.set(null);
    userAddress.set('');
    currentRound.set(null);
    ticketPrice.set('0');
    isOwner.set(false);
    errorMessage.set('');
    web3Provider = null;
    contractInstance = null;
}

// Contract interaction functions
export async function startNewRound(durationBlocks: number) {
    if (!contractInstance) throw new Error('Contract not initialized');
    
    try {
        const tx = await contractInstance.startNewRound(durationBlocks);
        await tx.wait();
        await updateContractState();
        return true;
    } catch (error: any) {
        console.error('Failed to start new round:', error);
        errorMessage.set(formatError(error));
        return false;
    }
}

export async function buyTicket(commitment: string) {
    if (!contractInstance) throw new Error('Contract not initialized');
    
    try {
        const tx = await contractInstance.buyTicket(commitment);
        await tx.wait();
        await updateContractState();
        return true;
    } catch (error: any) {
        console.error('Failed to buy ticket:', error);
        errorMessage.set(formatError(error));
        return false;
    }
}

export async function endRound() {
    if (!contractInstance) throw new Error('Contract not initialized');
    
    try {
        const tx = await contractInstance.endRound();
        await tx.wait();
        await updateContractState();
        return true;
    } catch (error: any) {
        console.error('Failed to end round:', error);
        errorMessage.set(formatError(error));
        return false;
    }
}

export async function claimPrize(
    roundId: number,
    proof: { a: number[], b: number[][], c: number[], input: number[] }
) {
    if (!contractInstance) throw new Error('Contract not initialized');
    
    try {
        const tx = await contractInstance.claimPrize(
            roundId,
            proof.a,
            proof.b,
            proof.c,
            proof.input
        );
        await tx.wait();
        await updateContractState();
        return true;
    } catch (error: any) {
        console.error('Failed to claim prize:', error);
        errorMessage.set(formatError(error));
        return false;
    }
}

export async function connectWithPrivateKey(privateKey: string) {
    try {
        if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
            throw new Error('Contract address not set or invalid');
        }

        // Create provider and wallet
        web3Provider = new ethers.providers.JsonRpcProvider(RPC_URL);
        
        // Check network
        const network = await web3Provider.getNetwork();
        if (network.chainId !== 167009) {
            throw new Error('RPC is not connected to Taiko Hekla testnet');
        }
        
        const wallet = new ethers.Wallet(privateKey, web3Provider);
        
        // Create contract instance
        contractInstance = new ethers.Contract(CONTRACT_ADDRESS, contractAbi, wallet) as TaikoLottery;

        // Update stores
        provider.set(web3Provider);
        signer.set(wallet);
        contract.set(contractInstance);
        userAddress.set(wallet.address);
        connectionType.set('privateKey');

        // Check if user is contract owner
        const ownerAddress = await contractInstance.owner();
        isOwner.set(ownerAddress.toLowerCase() === wallet.address.toLowerCase());
        
        // Get contract state
        await updateContractState();

        isConnected.set(true);
        errorMessage.set('');
    } catch (error: any) {
        console.error('Failed to connect with private key:', error);
        isConnected.set(false);
        errorMessage.set(formatError(error));
        throw error;
    }
} 