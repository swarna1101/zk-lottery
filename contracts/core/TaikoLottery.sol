// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IEntropyConsumer} from "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import {IEntropy} from "@pythnetwork/entropy-sdk-solidity/IEntropy.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Timers.sol";
import "../interfaces/IERC20.sol";
import "../interfaces/IVerifier.sol";

contract TaikoLottery is IEntropyConsumer, Ownable, ReentrancyGuard, Pausable {
    using Timers for Timers.Timestamp;

    IERC20 public constant TAIKO_TOKEN = IERC20(0x88f6D29C94E933F7C9Abf8821B081e1804579283);
    uint256 public constant TICKET_PRICE = 1 ether;
    uint256 public constant MIN_ROUND_DURATION = 100; // blocks
    uint256 public constant MAX_ROUND_DURATION = 1000; // blocks
    uint256 public constant WINNER_SELECTION_DELAY = 10; // blocks

    IEntropy private immutable entropy;
    address private immutable entropyProvider;
    address public feeRecipient;
    uint256 public feePercent;
    address public verifier;

    struct Round {
        uint256 endBlock;
        uint256 ticketCount;
        bytes32[] ticketCommitments;
        mapping(bytes32 => bool) usedCommitments;
        mapping(bytes32 => bool) usedNullifiers;
        uint256 winningTicketIndex;
        uint256 prizePool;
        bool isActive;
        bool isFinished;
        uint256 startTime;
        uint256 endTime;
        uint256 winnerSelectionBlock;
    }

    uint256 public currentRoundId;
    mapping(uint256 => Round) public rounds;
    mapping(bytes32 => bool) public globalUsedCommitments;
    uint64 public entropySequenceNumber;
    Timers.Timestamp private roundTimer;

    event RoundStarted(uint256 indexed roundId, uint256 endBlock);
    event TicketPurchased(uint256 indexed roundId, uint256 indexed ticketId, bytes32 commitment);
    event RoundClosed(uint256 indexed roundId, uint256 winningIndex);
    event PrizeClaimed(uint256 indexed roundId, address indexed winner, uint256 amount);
    event FeesDistributed(uint256 indexed roundId, address indexed recipient, uint256 amount);
    event RoundReset(uint256 indexed roundId);

    modifier onlyEntropyProvider() {
        require(msg.sender == entropyProvider, "Only entropy provider");
        _;
    }

    constructor(
        address _entropy,
        address _entropyProvider,
        address _feeRecipient,
        uint256 _feePercent,
        address _verifier
    ) Ownable(msg.sender) {
        require(_feePercent <= 10000, "Fee percent too high");
        entropy = IEntropy(_entropy);
        entropyProvider = _entropyProvider;
        feeRecipient = _feeRecipient;
        feePercent = _feePercent;
        verifier = _verifier;
    }

    function startNewRound(uint256 durationBlocks) external onlyOwner whenNotPaused {
        require(durationBlocks >= MIN_ROUND_DURATION && durationBlocks <= MAX_ROUND_DURATION, "Invalid duration");
        require(rounds[currentRoundId].isFinished || currentRoundId == 0, "Current round not finished");

        currentRoundId++;
        Round storage round = rounds[currentRoundId];
        round.endBlock = block.number + durationBlocks;
        round.isActive = true;
        round.startTime = block.timestamp;
        round.endTime = block.timestamp + (durationBlocks * 12);
        round.winnerSelectionBlock = round.endBlock + WINNER_SELECTION_DELAY;

        roundTimer.setDeadline(uint64(round.endTime));

        emit RoundStarted(currentRoundId, round.endBlock);
    }

    function buyTicket(bytes32 commitment) external nonReentrant whenNotPaused {
        Round storage round = rounds[currentRoundId];
        require(round.isActive, "Round not active");
        require(block.number < round.endBlock, "Round ended");
        require(!round.usedCommitments[commitment], "Commitment already used in round");
        require(!globalUsedCommitments[commitment], "Commitment already used globally");
        require(TAIKO_TOKEN.transferFrom(msg.sender, address(this), TICKET_PRICE), "Payment failed");

        round.usedCommitments[commitment] = true;
        globalUsedCommitments[commitment] = true;
        round.ticketCommitments.push(commitment);
        round.ticketCount++;
        round.prizePool += TICKET_PRICE;

        emit TicketPurchased(currentRoundId, round.ticketCount - 1, commitment);
    }

    function endRound() external onlyOwner nonReentrant whenNotPaused {
        Round storage round = rounds[currentRoundId];
        require(round.isActive, "Round not active");
        require(block.number >= round.endBlock, "Round not ended");
        require(block.number >= round.winnerSelectionBlock, "Winner selection delay not passed");
        require(round.ticketCount > 0, "No tickets sold");

        uint256 fee = entropy.getFee(entropyProvider);
        require(address(this).balance >= fee, "Insufficient ETH in contract");

        round.isActive = false;
        entropySequenceNumber = entropy.requestWithCallback{value: fee}(entropyProvider, bytes32(0));
    }

    function entropyCallback(uint64 sequenceNumber, address, bytes32 randomNumber) internal override {
        require(sequenceNumber == entropySequenceNumber, "Invalid sequence");

        Round storage round = rounds[currentRoundId];
        require(!round.isActive && !round.isFinished, "Invalid round state");

        round.winningTicketIndex = uint256(randomNumber) % round.ticketCount;
        round.isFinished = true;

        emit RoundClosed(currentRoundId, round.winningTicketIndex);
    }

    function claimPrize(
        uint256 roundId,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[2] calldata input
    ) external nonReentrant whenNotPaused {
        Round storage round = rounds[roundId];
        require(round.isFinished, "Round not finished");
        require(roundId <= currentRoundId, "Invalid round");

        bytes32 nullifier = bytes32(input[1]);
        require(!round.usedNullifiers[nullifier], "Ticket already claimed");

        bytes memory zkProof = abi.encode(a, b, c);
        require(verifyZKProof(zkProof, round.winningTicketIndex, roundId, input), "Invalid proof");

        round.usedNullifiers[nullifier] = true;

        uint256 totalPrize = round.prizePool;
        round.prizePool = 0;
        uint256 feeAmount = (totalPrize * feePercent) / 10000;
        uint256 winnerAmount = totalPrize - feeAmount;

        require(TAIKO_TOKEN.transfer(feeRecipient, feeAmount), "Fee transfer failed");
        require(TAIKO_TOKEN.transfer(msg.sender, winnerAmount), "Prize transfer failed");

        emit FeesDistributed(roundId, feeRecipient, feeAmount);
        emit PrizeClaimed(roundId, msg.sender, winnerAmount);
    }

    function verifyZKProof(
        bytes memory zkProof,
        uint256 ticketIndex,
        uint256 roundId,
        uint256[2] calldata input
    ) internal view returns (bool) {
        Round storage round = rounds[roundId];
        bytes32 commitment = round.ticketCommitments[ticketIndex];

        require(block.timestamp >= round.startTime, "Round not started");
        require(block.timestamp <= round.endTime, "Round ended");

        (uint256[2] memory _a, uint256[2][2] memory _b, uint256[2] memory _c) =
            abi.decode(zkProof, (uint256[2], uint256[2][2], uint256[2]));

        return IVerifier(verifier).verifyProof(_a, _b, _c, input);
    }

    function resetRound(uint256 roundId) external onlyOwner {
        require(roundId < currentRoundId, "Cannot reset current round");
        Round storage round = rounds[roundId];
        require(round.isFinished, "Round not finished");
        
        // Clear round data but keep historical data
        round.isActive = false;
        round.isFinished = true;
        round.prizePool = 0;
        
        emit RoundReset(roundId);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid address");
        feeRecipient = _feeRecipient;
    }

    function setFeePercent(uint256 _feePercent) external onlyOwner {
        require(_feePercent <= 10000, "Fee percent too high");
        feePercent = _feePercent;
    }

    function getRoundInfo(uint256 roundId)
        external
        view
        returns (
            uint256 endBlock,
            uint256 ticketCount,
            uint256 winningTicketIndex,
            uint256 prizePool,
            bool isActive,
            bool isFinished
        )
    {
        Round storage round = rounds[roundId];
        return (
            round.endBlock,
            round.ticketCount,
            round.winningTicketIndex,
            round.prizePool,
            round.isActive,
            round.isFinished
        );
    }

    receive() external payable {}
}
