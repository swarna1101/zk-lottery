<script lang="ts">
import { onMount } from 'svelte';
import { currentRound, ticketPrice, isConnected, errorMessage, initializeContract, startNewRound, buyTicket, endRound, userAddress, isOwner, connectWithPrivateKey, connectionType } from './lib/stores/contract';
import { utils } from 'ethers';

let durationBlocks = 100;
let ticketCount = 1;
let loading = false;
let privateKey = '';
let showPrivateKey = false;
  
$: connected = $isConnected;
$: price = $ticketPrice;
$: round = $currentRound;
$: error = $errorMessage;
$: address = $userAddress;
$: owner = $isOwner;
$: connType = $connectionType;

onMount(async () => {
  if (typeof window.ethereum !== 'undefined') {
    try {
      await initializeContract();
    } catch (error) {
      // Error is already handled in the contract store
    }
  }
});

async function handleConnectWithPrivateKey() {
  if (!privateKey) {
    errorMessage.set('Please enter a private key');
    return;
  }
  
  try {
    loading = true;
    await connectWithPrivateKey(privateKey);
  } finally {
    loading = false;
  }
}

async function handleStartNewRound() {
  if (!connected) {
    try {
      loading = true;
      await initializeContract();
    } catch (error) {
      return;
    } finally {
      loading = false;
    }
  }
  
  if (!owner) {
    errorMessage.set('Only owner can start a new round');
    return;
  }
  
  try {
    loading = true;
    await startNewRound(durationBlocks);
  } finally {
    loading = false;
  }
}

async function handleBuyTicket() {
  if (!connected) {
    try {
      loading = true;
      await initializeContract();
    } catch (error) {
      return;
    } finally {
      loading = false;
    }
  }
  
  if (!round || round.isEnded) {
    errorMessage.set('No active round available');
    return;
  }
  
  try {
    loading = true;
    const randomValue = utils.randomBytes(32);
    const commitment = utils.keccak256(randomValue);
    
    const ticketData = {
      roundId: round.id.toString(),
      randomValue: utils.hexlify(randomValue),
      commitment
    };
    
    const success = await buyTicket(commitment);
    if (success) {
      localStorage.setItem(`ticket_${round.id}_${commitment}`, JSON.stringify(ticketData));
    }
  } finally {
    loading = false;
  }
}

async function handleEndRound() {
  if (!connected) {
    try {
      loading = true;
      await initializeContract();
    } catch (error) {
      return;
    } finally {
      loading = false;
    }
  }
  
  if (!round || round.isEnded) {
    errorMessage.set('No active round to end');
    return;
  }
  
  try {
    loading = true;
    await endRound();
  } finally {
    loading = false;
  }
}
</script>

<main class="container">
  <h1>Taiko Lottery</h1>

  <div class="card">
    {#if connected}
      <div class="wallet-status connected">
        <span class="dot"></span>
        {address.slice(0, 6)}...{address.slice(-4)}
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
              on:click={handleConnectWithPrivateKey}
              disabled={loading || !privateKey}
            >
              {#if loading}Connecting...{:else}Connect with Private Key{/if}
            </button>
          </div>
        </div>
      </div>
    {/if}

    <div class="lottery-info">
      {#if round}
        <div class="info-grid">
          <div class="info-item">
            <h3>Round</h3>
            <p>{round.id?.toString() || '0'}</p>
          </div>
          <div class="info-item">
            <h3>Price</h3>
            <p>{price || '0'} ETH</p>
          </div>
          <div class="info-item">
            <h3>Tickets</h3>
            <p>{round.ticketCount?.toString() || '0'}</p>
          </div>
          <div class="info-item">
            <h3>Prize Pool</h3>
            <p>{utils.formatEther(round.prizePool || '0')} ETH</p>
          </div>
        </div>
        <div class="status-bar">
          <div class="status-indicator {round.isEnded ? 'ended' : 'active'}">
            {round.isEnded ? 'Round Ended' : 'Round Active'}
          </div>
          {#if round.isEnded}
            <div class="winning-number">
              Winning Index: {round.winningIndex?.toString()}
            </div>
          {/if}
        </div>
      {:else}
        <div class="info-grid">
          <div class="info-item">
            <h3>Round</h3>
            <p>-</p>
          </div>
          <div class="info-item">
            <h3>Price</h3>
            <p>-</p>
          </div>
          <div class="info-item">
            <h3>Tickets</h3>
            <p>-</p>
          </div>
          <div class="info-item">
            <h3>Prize Pool</h3>
            <p>-</p>
          </div>
        </div>
      {/if}
    </div>

    <div class="controls">
      {#if owner}
        <div class="control-section">
          <h3>Admin Controls</h3>
          <div class="input-group">
            <label for="duration">Round Duration (blocks)</label>
            <input
              id="duration"
              type="number"
              bind:value={durationBlocks}
              min="1"
              disabled={loading}
            />
            <button 
              class="primary" 
              on:click={handleStartNewRound}
              disabled={loading || (round && !round.isEnded)}
            >
              {#if loading}Starting...{:else}Start New Round{/if}
            </button>
          </div>
        </div>
      {/if}

      <div class="control-section">
        <h3>Lottery Controls</h3>
        <div class="input-group">
          <label for="tickets">Number of Tickets</label>
          <input
            id="tickets"
            type="number"
            bind:value={ticketCount}
            min="1"
            disabled={loading || !round || round.isEnded}
          />
          <button 
            class="primary"
            on:click={handleBuyTicket}
            disabled={loading || !round || round.isEnded}
          >
            {#if loading}Buying...{:else}Buy Tickets{/if}
          </button>
        </div>
        <button 
          class="secondary"
          on:click={handleEndRound}
          disabled={loading || !round || round.isEnded}
        >
          {#if loading}Ending...{:else}End Round{/if}
        </button>
      </div>
    </div>

    {#if error}
      <div class="error" role="alert">
        {error}
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
    margin-bottom: 2rem;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .info-item {
    background: rgba(255, 255, 255, 0.05);
    padding: 1rem;
    border-radius: 12px;
    text-align: center;
  }

  .info-item h3 {
    font-size: 0.9rem;
    opacity: 0.7;
    margin-bottom: 0.5rem;
  }

  .info-item p {
    font-size: 1.2rem;
    font-weight: 600;
  }

  .status-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1rem;
  }

  .status-indicator {
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-weight: 500;
    font-size: 0.9rem;
  }

  .status-indicator.active {
    background: rgba(46, 204, 113, 0.2);
    color: #2ecc71;
  }

  .status-indicator.ended {
    background: rgba(231, 76, 60, 0.2);
    color: #e74c3c;
  }

  .winning-number {
    font-size: 0.9rem;
    opacity: 0.8;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .control-section {
    background: rgba(255, 255, 255, 0.05);
    padding: 1.5rem;
    border-radius: 12px;
  }

  .control-section h3 {
    margin-bottom: 1rem;
    font-size: 1.1rem;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  input {
    padding: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    color: white;
    font-size: 1rem;
  }

  input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  button {
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  button.primary {
    background: #ff1493;
    color: white;
    border: none;
  }

  button.secondary {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(255, 20, 147, 0.4);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
  }

  .error {
    margin-top: 1rem;
    padding: 1rem;
    border-radius: 8px;
    background: rgba(255, 20, 147, 0.1);
    border: 1px solid rgba(255, 20, 147, 0.3);
    color: #ff69b4;
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
</style>
