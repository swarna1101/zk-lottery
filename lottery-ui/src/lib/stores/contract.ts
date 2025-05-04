import { writable, type Writable } from 'svelte/store';
import { ethers, type BigNumber } from 'ethers';
import type { JsonRpcProvider, Web3Provider } from '@ethersproject/providers';
import type { Contract } from '@ethersproject/contracts';
import { contractAbi } from './contractAbi';

// Define contract interface
export interface TaikoLottery extends Contract {
    currentRound(): Promise<any>;
    TICKET_PRICE(): Promise<any>;
    getRoundInfo(roundId: number): Promise<any>;
    startNewRound(endBlock: number): Promise<any>;
    buyTicket(commitment: string): Promise<any>;
    endRound(): Promise<any>;
    claimPrize(roundId: number, ticket: string, secret: string): Promise<any>;
    owner(): Promise<string>;
}

// Add TTKO token interface
interface IERC20 extends ethers.Contract {
    approve(spender: string, amount: ethers.BigNumber, overrides?: ethers.Overrides): Promise<ethers.ContractTransaction>;
    allowance(owner: string, spender: string): Promise<ethers.BigNumber>;
    balanceOf(account: string): Promise<ethers.BigNumber>;
}

// Environment variables
const RPC_URL = import.meta.env.VITE_RPC_URL || 'https://rpc.test.taiko.xyz';
const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
const TTKO_ADDRESS = '0x7b1a3c8f1b1993f8c2ac5ca5d0e16eb0d127be11';

// Stores
export const userAddress = writable<string | null>(null);
export const isOwner = writable<boolean>(false);
export const errorMessage = writable<string | null>(null);
export const currentRoundId = writable<number>(0);
export const ticketPrice = writable<string>('0');
export const connectionType = writable<'metamask' | 'privateKey' | null>(null);
export const isConnected = writable<boolean>(false);

export interface RoundInfo {
  endBlock: string;
  ticketCount: string;
  prizePool: string;
  winningTicketIndex: string;
  isActive: boolean;
  isFinished: boolean;
}

export const roundInfo = writable<RoundInfo | null>(null);

let provider: JsonRpcProvider | Web3Provider | null = null;
let contractInstance: TaikoLottery | null = null;
let ttkoContract: IERC20 | null = null;

export async function initializeContract() {
    try {
        if (!window.ethereum) {
            throw new Error('MetaMask not installed');
        }

        // Clear any existing state
        disconnectWallet();

        // Initialize provider and request accounts
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send('eth_requestAccounts', []);
        
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        
        // Initialize TTKO contract
        ttkoContract = new ethers.Contract(
            TTKO_ADDRESS,
            [
                "function approve(address spender, uint256 amount) external returns (bool)",
                "function allowance(address owner, address spender) external view returns (uint256)",
                "function balanceOf(address account) external view returns (uint256)"
            ],
            signer
        ) as IERC20;

        // Initialize lottery contract
        contractInstance = new ethers.Contract(
            contractAddress,
            contractAbi,
            signer
        ) as TaikoLottery;

        // Update stores
        userAddress.set(address);
        const ownerAddress = await contractInstance.owner();
        isOwner.set(ownerAddress.toLowerCase() === address.toLowerCase());
        
        // Update contract state
        await updateContractState();
        
        // Set connection status
        connectionType.set('metamask');
        isConnected.set(true);
        errorMessage.set('');

        // Setup event listeners
        window.ethereum.on('accountsChanged', handleAccountChange);
        window.ethereum.on('chainChanged', handleChainChange);

        // Start polling for updates
        const interval = setInterval(updateContractState, 5000);
        window.addEventListener('beforeunload', () => clearInterval(interval));

        return true;
    } catch (error) {
        console.error('Contract initialization error:', error);
        errorMessage.set(formatError(error));
        isConnected.set(false);
        return false;
    }
}

async function updateContractState() {
    if (!contractInstance || !provider) {
        console.error('Contract or provider not initialized');
        return;
    }
    try {
        const [roundId, price, info, blockNumber] = await Promise.all([
            contractInstance.currentRound(),
            contractInstance.TICKET_PRICE(),
            contractInstance.getRoundInfo(await contractInstance.currentRound()),
            provider.getBlockNumber()
        ]);
        
        currentRoundId.set(roundId.toNumber());
        ticketPrice.set(ethers.utils.formatEther(price));
        roundInfo.set(info);

        // Update block number in localStorage
        window.localStorage.setItem('currentBlock', blockNumber.toString());
    } catch (error) {
        console.error('Error updating contract state:', error);
        errorMessage.set(formatError(error));
    }
}

async function handleAccountChange(accounts: string[]) {
    if (accounts.length === 0) {
        userAddress.set(null);
        isConnected.set(false);
        connectionType.set(null);
    } else {
        userAddress.set(accounts[0]);
        await initializeContract();
    }
}

function handleChainChange() {
    window.location.reload();
}

export function disconnectWallet() {
    errorMessage.set('');
    userAddress.set(null);
    currentRoundId.set(0);
    ticketPrice.set('0');
    roundInfo.set(null);
    isOwner.set(false);
    isConnected.set(false);
    connectionType.set(null);
    provider = null;
    contractInstance = null;
    ttkoContract = null;
}

// Contract interaction functions
export async function startNewRound(durationBlocks: number) {
    if (!contractInstance) throw new Error('Contract not initialized');
    
    try {
        const tx = await contractInstance.startNewRound(durationBlocks, {
            gasLimit: 500000  // Set appropriate gas limit
        });
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
    if (!contractInstance || !provider || !ttkoContract) {
        throw new Error('Contracts not initialized');
    }
    
    try {
        const signer = provider.getSigner();
        const userAddr = await signer.getAddress();
        
        // Get ticket price
        const price = await contractInstance.TICKET_PRICE();
        
        // Check current allowance
        const allowance = await ttkoContract.allowance(userAddr, contractAddress);
        
        // If allowance is insufficient, approve spending
        if (allowance.lt(price)) {
            console.log('Approving TTKO spend...');
            const approveTx = await ttkoContract.approve(contractAddress, price, {
                gasLimit: 100000
            });
            await approveTx.wait();
            console.log('TTKO approved');
        }
        
        // Buy ticket
        console.log('Buying ticket...');
        const tx = await contractInstance.buyTicket(commitment, {
            gasLimit: 500000
        });
        await tx.wait();
        console.log('Ticket bought');
        
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
        const tx = await contractInstance.endRound({
            gasLimit: 500000
        });
        await tx.wait();
        await updateContractState();
        return true;
    } catch (error: any) {
        console.error('Failed to end round:', error);
        errorMessage.set(formatError(error));
        return false;
    }
}

function formatError(error: any): string {
    if (error?.code === 4001) {
        return 'Transaction rejected by user';
    }
    if (error?.code === 'INVALID_ARGUMENT') {
        return 'Invalid input parameters';
    }
    if (error?.code === 'UNPREDICTABLE_GAS_LIMIT') {
        return 'Transaction may fail - check your TTKO balance and approval';
    }
    if (error?.data?.message) {
        return error.data.message;
    }
    if (error?.message) {
        return error.message;
    }
    return 'An unexpected error occurred';
}

// Export contract instance getter
export function getContractInstance(): TaikoLottery | null {
    return contractInstance;
}

export async function updateRoundInfo(): Promise<void> {
  try {
    if (!contractInstance) {
      throw new Error('Contract not initialized');
    }
    const currentRoundId = await contractInstance.currentRoundId();
    const [endBlock, ticketCount, winningTicketIndex, prizePool, isActive, isFinished] = await contractInstance.getRoundInfo(currentRoundId);
    
    roundInfo.set({
      endBlock: endBlock.toString(),
      ticketCount: ticketCount.toString(),
      winningTicketIndex: winningTicketIndex.toString(),
      prizePool: prizePool.toString(),
      isActive,
      isFinished
    });
  } catch (error) {
    console.error('Error updating round info:', error);
    errorMessage.set(formatError(error));
    roundInfo.set(null);
  }
}

export async function connectWithPrivateKey(privateKey: string) {
  try {
    if (!contractAddress) {
      throw new Error('Contract address not configured');
    }

    provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(privateKey);
    const signer = wallet.connect(provider);
    
    contractInstance = new ethers.Contract(
      contractAddress,
      contractAbi,
      signer
    ) as TaikoLottery;

    userAddress.set(await signer.getAddress());
    connectionType.set('privateKey');
    
    const owner = await contractInstance.owner();
    isOwner.set(owner.toLowerCase() === (await signer.getAddress()).toLowerCase());

    await updateRoundInfo();
  } catch (error) {
    console.error('Failed to connect with private key:', error);
    errorMessage.set(error instanceof Error ? error.message : 'Failed to connect');
    throw error;
  }
} 