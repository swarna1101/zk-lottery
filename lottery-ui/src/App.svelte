<script lang="ts">
import { onMount } from 'svelte';
import { userAddress, isOwner, roundInfo, errorMessage, isConnected, connectionType, currentRoundId, ticketPrice } from './lib/stores/contract';
import { initializeContract, connectWithPrivateKey, getContractInstance, startNewRound, buyTicket, endRound } from './lib/stores/contract';
import { ethers } from 'ethers';
import type { RoundInfo } from './lib/stores/contract';

let durationBlocks = 100;
let ticketCount = 1;
let loading = false;
let privateKey = '';
let showPrivateKey = false;
let currentBlock = 0;
let myTickets: Array<{roundId: string, index: number, commitment: string}> = [];
let showPrivateKeyInput = false;

$: connected = $isConnected;
$: round = $currentRoundId;
$: roundData = $roundInfo;
$: error = $errorMessage;
$: address = $userAddress;
$: price = $ticketPrice ? ethers.utils.parseEther($ticketPrice) : ethers.utils.parseEther("0");
$: owner = $isOwner;
$: connType = $connectionType;
$: totalPrice = price.mul(ticketCount);
$: blocksRemaining = roundData?.endBlock ? roundData.endBlock.sub(currentBlock).toNumber() : 0;

onMount(() => {
  // Load stored tickets
  const storedTickets = JSON.parse(localStorage.getItem('myTickets') || '[]');
  myTickets = storedTickets;
  
  // Initialize contract
  initializeContract();

  // Update current block number from localStorage
  const updateCurrentBlock = () => {
    const blockNum = localStorage.getItem('currentBlock');
    if (blockNum) {
      currentBlock = parseInt(blockNum);
    }
  };

  // Update block number every second
  updateCurrentBlock();
  const interval = setInterval(updateCurrentBlock, 1000);

  return () => clearInterval(interval);
});

function loadMyTickets() {
  const tickets = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('ticket_')) {
      const ticket = JSON.parse(localStorage.getItem(key) || '{}');
      tickets.push({
        roundId: ticket.roundId,
        index: ticket.index,
        commitment: ticket.commitment
      });
    }
  }
  myTickets = tickets;
}

async function handlePrivateKeyConnect() {
  if (!privateKey) return;
  loading = true;
  try {
    await connectWithPrivateKey(privateKey);
  } catch (e) {
    console.error(e);
  } finally {
    loading = false;
  }
}

async function handleStartNewRound() {
  if (!roundData) return;
  loading = true;
  try {
    const success = await startNewRound(durationBlocks);
    if (!success) {
      throw new Error('Failed to start new round');
    }
  } catch (err: any) {
    console.error(err);
    error = err?.message || 'Failed to start new round';
  } finally {
    loading = false;
  }
}

async function handleBuyTicket() {
  if (!roundData) return;
  loading = true;
  try {
    const commitment = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(Date.now().toString()));
    const success = await buyTicket(commitment);
    if (success) {
      // Store ticket info in local storage
      const storedTickets = JSON.parse(localStorage.getItem('myTickets') || '[]');
      storedTickets.push({
        roundId: round.toString(),
        commitment,
        index: roundData.ticketCount.toNumber()
      });
      localStorage.setItem('myTickets', JSON.stringify(storedTickets));
      myTickets = storedTickets;
    } else {
      throw new Error('Failed to buy ticket');
    }
  } catch (err: any) {
    console.error(err);
    error = err?.message || 'Failed to buy ticket';
  } finally {
    loading = false;
  }
}

async function handleEndRound() {
  if (!roundData) return;
  loading = true;
  try {
    const success = await endRound();
    if (!success) {
      throw new Error('Failed to end round');
    }
  } catch (err: any) {
    console.error(err);
    error = err?.message || 'Failed to end round';
  } finally {
    loading = false;
  }
}

async function handleClaimPrize() {
  if (!roundData) return;
  
  try {
    loading = true;
    // TODO: Implement ZK proof generation and prize claiming
    errorMessage.set('Prize claiming will be implemented in the next update');
  } finally {
    loading = false;
  }
}
</script>

<main class="container mx-auto p-4">
  <h1>Taiko Lottery</h1>

  <div class="card">
    {#if connected}
      <div class="wallet-status connected">
        <span class="dot"></span>
        {#if $userAddress !== null && $userAddress !== undefined}
          {$userAddress.slice(0, 6)}...{$userAddress.slice(-4)}
          {#if $isOwner}
            <span class="ml-2 text-green-500">(Owner)</span>
          {/if}
        {/if}
        <span class="connection-type">({connType})</span>
      </div>
    {:else}
      <div class="connect-section">
        <div class="wallet-status">
          <span class="dot"></span>
          Not Connected
        </div>
        
        <div class="private-key-input">
          <div class="input-group">
            <label for="privateKey">Private Key</label>
            <div class="key-input-wrapper">
              <input
                id="privateKey"
                type={showPrivateKey ? 'text' : 'password'}
                bind:value={privateKey}
                placeholder="Enter your private key"
                disabled={loading}
              />
              <button 
                class="icon-button" 
                on:click={() => showPrivateKey = !showPrivateKey}
                type="button"
                title={showPrivateKey ? 'Hide private key' : 'Show private key'}
              >
                {#if showPrivateKey}👁️{:else}👁️‍🗨️{/if}
              </button>
            </div>
            <button 
              class="primary"
              on:click={handlePrivateKeyConnect}
              disabled={loading || !privateKey}
            >
              {#if loading}Connecting...{:else}Connect with Private Key{/if}
            </button>
          </div>
        </div>
      </div>
    {/if}

    <div class="lottery-info">
      {#if roundData}
        <div class="info-item">
          <h3>End Block</h3>
          <p>{parseInt(roundData.endBlock)}</p>
        </div>
        <div class="info-item">
          <h3>Tickets Sold</h3>
          <p>{parseInt(roundData.ticketCount)}</p>
        </div>
        <div class="info-item">
          <h3>Prize Pool</h3>
          <p>{roundData.prizePool} ETH</p>
        </div>
        {#if roundData.isFinished}
          <div class="info-item">
            <h3>Winning Ticket</h3>
            <p>{parseInt(roundData.winningTicketIndex)}</p>
          </div>
        {/if}
      {:else}
        <p>Loading lottery information...</p>
      {/if}
    </div>

    <div class="actions">
      {#if $isOwner && !roundData.isActive}
        <button 
          on:click={() => handleStartNewRound()}
          disabled={loading}
          class="primary"
        >
          {loading ? 'Starting...' : 'Start New Round'}
        </button>
      {/if}

      {#if roundData.isActive}
        <button 
          on:click={() => handleBuyTicket()}
          disabled={loading}
          class="primary"
        >
          {loading ? 'Buying...' : 'Buy Ticket'}
        </button>
      {/if}

      {#if $isOwner && roundData.isActive}
        <button 
          on:click={() => handleEndRound()}
          disabled={loading}
          class="secondary"
        >
          {loading ? 'Ending...' : 'End Round'}
        </button>
      {/if}
    </div>

    {#if error}
      <div class="error">
        {error}
      </div>
    {/if}

    {#if myTickets.length > 0}
      <div class="my-tickets">
        <h3>My Tickets</h3>
        <div class="ticket-list">
          {#each myTickets as ticket}
            <div class="ticket">
              <span>Round #{ticket.roundId}</span>
              <span>Ticket #{ticket.index}</span>
              {#if roundData?.isFinished && roundData?.winningIndex?.toString() === ticket.index.toString()}
                <span class="winner">Winner! 🎉</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</main>

<style>
  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }

  .card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 2rem;
    backdrop-filter: blur(10px);
  }

  .wallet-status {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 20px;
    font-size: 0.9rem;
    margin-bottom: 2rem;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #e74c3c;
  }

  .connected .dot {
    background: #2ecc71;
  }

  .lottery-info {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .info-item {
    background: #f5f5f5;
    padding: 1rem;
    border-radius: 8px;
  }

  .info-item h3 {
    margin: 0;
    font-size: 0.9rem;
    color: #666;
  }

  .info-item p {
    margin: 0.5rem 0 0;
    font-size: 1.2rem;
    font-weight: bold;
  }

  .actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  button {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 4px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  button.primary {
    background: #3b82f6;
    color: white;
  }

  button.secondary {
    background: #ef4444;
    color: white;
  }

  .error {
    margin-top: 1rem;
    padding: 1rem;
    background: #fee2e2;
    border: 1px solid #ef4444;
    border-radius: 4px;
    color: #b91c1c;
  }

  .connect-section {
    margin-bottom: 2rem;
  }

  .private-key-input {
    margin-top: 1rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
  }

  .key-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .key-input-wrapper input {
    flex: 1;
    padding-right: 3rem;
  }

  .icon-button {
    position: absolute;
    right: 0.5rem;
    background: none;
    border: none;
    padding: 0.5rem;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s ease;
  }

  .icon-button:hover {
    opacity: 1;
    transform: none;
    box-shadow: none;
  }

  .connection-type {
    font-size: 0.8rem;
    opacity: 0.7;
    margin-left: 0.5rem;
  }

  .status {
    font-size: 0.8rem;
    padding: 0.2rem 0.5rem;
    border-radius: 12px;
    margin-top: 0.5rem;
  }

  .status.active {
    background: rgba(46, 204, 113, 0.2);
    color: #2ecc71;
  }

  .status.ended {
    background: rgba(231, 76, 60, 0.2);
    color: #e74c3c;
  }

  .blocks-remaining {
    font-size: 0.9rem;
    opacity: 0.8;
    text-align: center;
    margin-top: 1rem;
  }

  .no-round {
    text-align: center;
    padding: 2rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
  }

  .help-text {
    font-size: 0.8rem;
    opacity: 0.7;
    margin-top: 0.5rem;
  }

  .my-tickets {
    margin-top: 2rem;
    padding: 1.5rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
  }

  .ticket-list {
    display: grid;
    gap: 1rem;
    margin-top: 1rem;
  }

  .ticket {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
  }

  .winner {
    color: #f1c40f;
    font-weight: bold;
  }

  .highlight {
    background: #f1c40f;
    color: black;
  }

  button.highlight:hover:not(:disabled) {
    background: #f39c12;
    box-shadow: 0 5px 15px rgba(243, 156, 18, 0.4);
  }
</style>
