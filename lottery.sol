// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IEntropyConsumer } from "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import { IEntropy } from "@pythnetwork/entropy-sdk-solidity/IEntropy.sol";

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

interface IVerifier {
    function verifyProof(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[2] calldata input
    ) external view returns (bool);
}

contract TaikoLottery is IEntropyConsumer {
    IERC20 public constant TAIKO_TOKEN = IERC20(0x88f6D29C94E933F7C9Abf8821B081e1804579283);
    uint256 public constant TICKET_PRICE = 1 ether;

    IEntropy private entropy;
    address private entropyProvider; 
    address public feeRecipient;
    uint256 public feePercent;
    uint256 public endBlock;
    address public verifier;

    enum State { OPEN, CLOSED, FINISHED }
    State public state;
    uint256 public ticketCount;
    bytes32[] public ticketCommitments;
    uint256 public winningTicketIndex;
    uint256 public prizePool;
    uint64 public entropySequenceNumber;

    event TicketPurchased(uint256 indexed ticketId, bytes32 commitment);
    event LotteryClosed(uint256 winningIndex);
    event PrizeClaimed(address indexed winner, uint256 amount);
    event FeesDistributed(address indexed recipient, uint256 amount);

    constructor(
        address _entropy,
        address _entropyProvider,
        address _feeRecipient,
        uint256 _feePercent,
        uint256 durationBlocks,
        address _verifier
    ) {
        require(_feePercent <= 10000, "Fee percent too high");
        entropy = IEntropy(_entropy);
        entropyProvider = _entropyProvider; // Set provider explicitly
        feeRecipient = _feeRecipient;
        feePercent = _feePercent;
        endBlock = block.number + durationBlocks;
        verifier = _verifier;
        state = State.OPEN;
    }

    function buyTicket(bytes32 commitment) external {
        require(state == State.OPEN, "Lottery not open");
        require(block.number < endBlock, "Lottery ended");
        require(TAIKO_TOKEN.transferFrom(msg.sender, address(this), TICKET_PRICE), "Payment failed");

        ticketCommitments.push(commitment);
        ticketCount++;
        prizePool += TICKET_PRICE;
        emit TicketPurchased(ticketCount - 1, commitment);
    }

    function endLottery(bytes32 userRandomness) external {
        require(state == State.OPEN, "Lottery not open");
        require(block.number >= endBlock, "Lottery not ended");
        require(ticketCount > 0, "No tickets sold");

        uint256 fee = entropy.getFee(entropyProvider);
        require(address(this).balance >= fee, "Insufficient ETH in contract");

        state = State.CLOSED;
        entropySequenceNumber = entropy.requestWithCallback{value: fee}(entropyProvider, userRandomness);
    }

    function entropyCallback(uint64 sequenceNumber, address, bytes32 randomNumber) internal override {
        require(sequenceNumber == entropySequenceNumber, "Invalid sequence");
        require(state == State.CLOSED, "Lottery not closed");

        winningTicketIndex = uint256(randomNumber) % ticketCount;
        state = State.FINISHED;
        emit LotteryClosed(winningTicketIndex);
    }

    function claimPrize(uint[2] calldata a, uint[2][2] calldata b, uint[2] calldata c) external {
        require(state == State.FINISHED, "Lottery not finished");
        bytes memory zkProof = abi.encode(a, b, c);
        require(verifyZKProof(zkProof, winningTicketIndex), "Invalid proof");

        uint256 totalPrize = prizePool;
        prizePool = 0;
        uint256 feeAmount = (totalPrize * feePercent) / 10000;
        uint256 winnerAmount = totalPrize - feeAmount;

        require(TAIKO_TOKEN.transfer(feeRecipient, feeAmount), "Fee transfer failed");
        require(TAIKO_TOKEN.transfer(msg.sender, winnerAmount), "Prize transfer failed");

        emit FeesDistributed(feeRecipient, feeAmount);
        emit PrizeClaimed(msg.sender, winnerAmount);
    }

    function verifyZKProof(bytes memory zkProof, uint256 ticketIndex) internal view returns (bool) {
        bytes32 commitment = ticketCommitments[ticketIndex];
        (uint[2] memory _a, uint[2][2] memory _b, uint[2] memory _c) = 
            abi.decode(zkProof, (uint[2], uint[2][2], uint[2]));
        return IVerifier(verifier).verifyProof(_a, _b, _c, [uint256(commitment), ticketIndex]);
    }

    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {}
}