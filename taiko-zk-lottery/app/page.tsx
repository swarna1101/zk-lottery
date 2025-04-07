"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { generateCommitment, generateProof } from "./utils";
import { formatEther, parseEther } from "viem";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Type definitions
interface TicketData {
  txHash: string;
  secret: string;
  commitment: {
    decimal: string;
    hex: string;
  };
  ticketIndex: number;
  timestamp: number;
  claimed?: boolean;
  claimTxHash?: string;
}

// Contract details
const LOTTERY_ADDRESS = "0xDE24d810aF04a7f7CE8196d844E358902a55a52d";
const TAIKO_TOKEN_ADDRESS = "0x88f6D29C94E933F7C9Abf8821B081e1804579283";

const TOKEN_ABI = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const LOTTERY_ABI = [
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "commitment",
        type: "bytes32",
      },
    ],
    name: "buyTicket",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "ticketId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "bytes32",
        name: "commitment",
        type: "bytes32",
      },
    ],
    name: "TicketPurchased",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "uint[2]",
        name: "a",
        type: "uint[2]",
      },
      {
        internalType: "uint[2][2]",
        name: "b",
        type: "uint[2][2]",
      },
      {
        internalType: "uint[2]",
        name: "c",
        type: "uint[2]",
      },
    ],
    name: "claimPrize",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "winningTicketIndex",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "state",
    outputs: [
      {
        internalType: "uint8",
        name: "",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "prizePool",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "ticketCount",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "endBlock",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "TICKET_PRICE",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "feePercent",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "userRandomness",
        type: "bytes32",
      },
    ],
    name: "endLottery",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export default function Home() {
  const { login } = usePrivy();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [hasWinningTicket, setHasWinningTicket] = useState<boolean>(false);
  const [currentBlockNumber, setCurrentBlockNumber] = useState<number | null>(
    null
  );

  // Read contract data
  const { data: winningTicketIndex } = useReadContract({
    address: LOTTERY_ADDRESS,
    abi: LOTTERY_ABI,
    functionName: "winningTicketIndex",
  });

  const { data: lotteryState } = useReadContract({
    address: LOTTERY_ADDRESS,
    abi: LOTTERY_ABI,
    functionName: "state",
  });

  const { data: prizePool } = useReadContract({
    address: LOTTERY_ADDRESS,
    abi: LOTTERY_ABI,
    functionName: "prizePool",
  });

  const { data: ticketCount } = useReadContract({
    address: LOTTERY_ADDRESS,
    abi: LOTTERY_ABI,
    functionName: "ticketCount",
  });

  const { data: endBlock } = useReadContract({
    address: LOTTERY_ADDRESS,
    abi: LOTTERY_ABI,
    functionName: "endBlock",
  });

  const { data: ticketPrice } = useReadContract({
    address: LOTTERY_ADDRESS,
    abi: LOTTERY_ABI,
    functionName: "TICKET_PRICE",
  });

  const { data: feePercent } = useReadContract({
    address: LOTTERY_ADDRESS,
    abi: LOTTERY_ABI,
    functionName: "feePercent",
  });

  // Load tickets from localStorage when the component mounts
  useEffect(() => {
    const storedTickets = getStoredTickets();
    setTickets(storedTickets);
  }, []);

  // Check if the user has the winning ticket when winningTicketIndex changes
  useEffect(() => {
    if (winningTicketIndex !== undefined && tickets.length > 0) {
      const indexValue = Number(winningTicketIndex);
      const hasWinning = tickets.some(
        (ticket) => ticket.ticketIndex === indexValue
      );
      setHasWinningTicket(hasWinning);
    }
  }, [winningTicketIndex, tickets]);

  // Fetch current block number periodically
  useEffect(() => {
    const fetchBlockNumber = async () => {
      try {
        // You'll need to implement this based on your web3 provider
        // For example, using viem:
        // const client = createPublicClient({...});
        // const blockNumber = await client.getBlockNumber();
        // setCurrentBlockNumber(Number(blockNumber));

        // Mock implementation:
        const mockBlockNumber = Math.floor(Date.now() / 15000); // Roughly simulates 15-second blocks
        setCurrentBlockNumber(mockBlockNumber);
      } catch (error) {
        console.error("Error fetching block number:", error);
      }
    };

    fetchBlockNumber();
    const interval = setInterval(fetchBlockNumber, 15000); // Update every 15 seconds

    return () => clearInterval(interval);
  }, []);

  const approveTokens = async (): Promise<string | undefined> => {
    if (!address) {
      console.log("Error: Wallet not connected");
      return;
    }

    console.log("Starting token approval process...");
    setIsApproving(true);

    try {
      // Amount to approve - 1 TTKO or your ticket price
      const approvalAmount = parseEther("1");

      console.log("Approving token spending...");
      console.log("Token address:", TAIKO_TOKEN_ADDRESS);
      console.log("Spender (lottery contract):", LOTTERY_ADDRESS);
      console.log("Approval amount:", approvalAmount.toString());

      // Execute the approve transaction
      const hash = await writeContractAsync({
        address: TAIKO_TOKEN_ADDRESS,
        abi: TOKEN_ABI,
        functionName: "approve",
        args: [LOTTERY_ADDRESS, approvalAmount],
      });

      console.log("Approval transaction hash:", hash);
      return hash;
    } catch (error) {
      console.error("Error approving tokens:", error);
      console.error("Error details:", {
        message: (error as Error).message,
        name: (error as Error).name,
        stack: (error as Error).stack,
      });
      throw error;
    } finally {
      setIsApproving(false);
    }
  };

  const buyTicket = async (): Promise<TicketData | undefined> => {
    if (!address) {
      console.log("Error: Wallet not connected");
      return;
    }

    console.log("Starting ticket purchase process...");
    setIsLoading(true);

    try {
      // First approve the tokens
      console.log("Checking for token approval...");
      await approveTokens();
      console.log("Token approval complete, now buying ticket...");

      // Generate a random secret (8-digit number for simplicity)
      const secretNumber = Math.floor(10000000 + Math.random() * 90000000);
      const secret = secretNumber.toString();
      console.log("Generated secret:", secret);

      // Generate commitment from the secret
      console.log("Generating commitment...");
      const commitment = await generateCommitment(secret);
      console.log("Generated commitment:", commitment);
      console.log(
        "Commitment hex format:",
        commitment.hex,
        "Length:",
        commitment.hex.length
      );

      // Log wallet and transaction details
      console.log("Wallet address:", address);
      console.log("Contract address:", LOTTERY_ADDRESS);
      console.log("Transaction parameters:", {
        address: LOTTERY_ADDRESS,
        functionName: "buyTicket",
        args: [commitment.hex as `0x${string}`],
      });

      // Execute transaction to buy ticket
      console.log("Sending transaction...");
      const hash = await writeContractAsync({
        address: LOTTERY_ADDRESS,
        abi: LOTTERY_ABI,
        functionName: "buyTicket",
        args: [commitment.hex as `0x${string}`],
      });

      console.log("Transaction hash:", hash);

      // Get the actual ticket index from the contract (using total ticket count)
      const actualTicketIndex = tickets.length;
      console.log("Assigned ticket index:", actualTicketIndex);

      // Create ticket data
      const ticketData: TicketData = {
        txHash: hash,
        secret: secret,
        commitment: commitment,
        ticketIndex: actualTicketIndex,
        timestamp: Date.now(),
      };

      // Update state and localStorage
      console.log("Updating local storage with new ticket data...");
      const updatedTickets = [...tickets, ticketData];
      setTickets(updatedTickets);
      localStorage.setItem("lotteryTickets", JSON.stringify(updatedTickets));
      console.log("Ticket purchase complete!");

      return ticketData;
    } catch (error) {
      console.error("Error buying ticket:", error);
      console.error("Error details:", {
        message: (error as Error).message,
        name: (error as Error).name,
        stack: (error as Error).stack,
      });
      throw error;
    } finally {
      setIsLoading(false);
      console.log("Ticket purchase process ended.");
    }
  };

  const claimPrize = async (): Promise<string | undefined> => {
    if (!address) {
      return;
    }

    if (winningTicketIndex === undefined) {
      return;
    }

    setIsClaiming(true);
    try {
      const indexValue = Number(winningTicketIndex);

      // Find if we have the winning ticket
      const winningTicket = tickets.find(
        (ticket) => ticket.ticketIndex === indexValue
      );

      if (!winningTicket) {
        return;
      }

      console.log("Found winning ticket:", winningTicket);

      // Generate proof that we know the secret for the winning ticket
      const proofData = await generateProof(
        winningTicket.secret,
        winningTicket.commitment,
        winningTicket.ticketIndex
      );

      console.log("Generated proof:", proofData);

      // Extract parameters and clean up any string formatting issues
      const cleanStringValue = (str) => {
        // If it's already a clean string, return it
        if (
          typeof str === "string" &&
          !str.includes("[") &&
          !str.includes('"')
        ) {
          return str;
        }

        // If it's a string that has quotes, brackets, etc., clean it up
        if (typeof str === "string") {
          // Remove brackets, quotes, and extra whitespace
          return str.replace(/[\[\]'"\s]/g, "");
        }

        // If it's already something else, return it as is
        return str;
      };

      // Clean up a, b, c arrays
      const a = Array.isArray(proofData.formatted.a)
        ? proofData.formatted.a.map(cleanStringValue)
        : [cleanStringValue(proofData.formatted.a)];

      // Handle the 2D array for b
      const b = [];
      if (Array.isArray(proofData.formatted.b)) {
        b.push(
          Array.isArray(proofData.formatted.b[0])
            ? proofData.formatted.b[0].map(cleanStringValue)
            : [cleanStringValue(proofData.formatted.b[0])]
        );

        b.push(
          Array.isArray(proofData.formatted.b[1])
            ? proofData.formatted.b[1].map(cleanStringValue)
            : [cleanStringValue(proofData.formatted.b[1])]
        );
      }

      const c = Array.isArray(proofData.formatted.c)
        ? proofData.formatted.c.map(cleanStringValue)
        : [cleanStringValue(proofData.formatted.c)];

      console.log("Cleaned proof parameters:");
      console.log("a:", a);
      console.log("b:", b);
      console.log("c:", c);

      // Call the claimPrize function on the smart contract
      const hash = await writeContractAsync({
        address: LOTTERY_ADDRESS,
        abi: LOTTERY_ABI,
        functionName: "claimPrize",
        args: [a, b, c],
      });

      console.log("Prize claim transaction hash:", hash);

      // Update ticket as claimed in state and localStorage
      const updatedTickets = tickets.map((ticket) => {
        if (ticket.ticketIndex === indexValue) {
          return {
            ...ticket,
            claimed: true,
            claimTxHash: hash,
          };
        }
        return ticket;
      });

      setTickets(updatedTickets);
      localStorage.setItem("lotteryTickets", JSON.stringify(updatedTickets));

      return hash;
    } catch (error) {
      console.error("Error claiming prize:", error);
      console.error("Error details:", {
        message: (error as Error).message,
        name: (error as Error).name,
        stack: (error as Error).stack,
      });
      throw error;
    } finally {
      setIsClaiming(false);
    }
  };
  // const claimPrize = async (): Promise<string | undefined> => {
  //   if (!address) {
  //     return;
  //   }

  //   if (winningTicketIndex === undefined) {
  //     return;
  //   }

  //   setIsClaiming(true);
  //   try {
  //     const indexValue = Number(winningTicketIndex);

  //     // Find if we have the winning ticket
  //     const winningTicket = tickets.find(
  //       (ticket) => ticket.ticketIndex === indexValue
  //     );

  //     if (!winningTicket) {
  //       return;
  //     }

  //     console.log("Found winning ticket:", winningTicket);

  //     // Generate proof that we know the secret for the winning ticket
  //     const proofData = await generateProof(
  //       winningTicket.secret,
  //       winningTicket.commitment,
  //       winningTicket.ticketIndex
  //     );

  //     console.log("Generated proof:", proofData);

  //     // Extract proof parameters for the contract
  //     const { a, b, c } = proofData.formatted;

  //     // Call the claimPrize function on the smart contract
  //     const hash = await writeContractAsync({
  //       address: LOTTERY_ADDRESS,
  //       abi: LOTTERY_ABI,
  //       functionName: "claimPrize",
  //       args: [a as any, b as any, c as any],
  //     });

  //     console.log("Prize claim transaction hash:", hash);

  //     // Update ticket as claimed in state and localStorage
  //     const updatedTickets = tickets.map((ticket) => {
  //       if (ticket.ticketIndex === indexValue) {
  //         return {
  //           ...ticket,
  //           claimed: true,
  //           claimTxHash: hash,
  //         };
  //       }
  //       return ticket;
  //     });

  //     setTickets(updatedTickets);
  //     localStorage.setItem("lotteryTickets", JSON.stringify(updatedTickets));

  //     return hash;
  //   } catch (error) {
  //     console.error("Error claiming prize:", error);
  //     throw error;
  //   } finally {
  //     setIsClaiming(false);
  //   }
  // };

  const endLottery = async (): Promise<string | undefined> => {
    if (!address) {
      return;
    }

    if (lotteryState === undefined || Number(lotteryState) !== 0) {
      return;
    }

    if (
      endBlock &&
      currentBlockNumber &&
      Number(endBlock) > currentBlockNumber
    ) {
      return;
    }

    try {
      // Generate a random value for user randomness
      const randomBytes = new Uint8Array(32);
      window.crypto.getRandomValues(randomBytes);
      const userRandomness =
        "0x" +
        Array.from(randomBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

      // Call the endLottery function
      const hash = await writeContractAsync({
        address: LOTTERY_ADDRESS,
        abi: LOTTERY_ABI,
        functionName: "endLottery",
        args: [userRandomness as `0x${string}`],
      });

      console.log("End lottery transaction hash:", hash);

      return hash;
    } catch (error) {
      console.error("Error ending lottery:", error);

      throw error;
    }
  };

  const getStoredTickets = (): TicketData[] => {
    if (typeof window === "undefined") return [];
    return JSON.parse(localStorage.getItem("lotteryTickets") || "[]");
  };

  const clearStoredTickets = (): void => {
    localStorage.removeItem("lotteryTickets");
    setTickets([]);
  };

  // Helper function to get lottery state as string
  const getLotteryStateString = (): string => {
    if (lotteryState === undefined) return "Loading...";

    const states = ["OPEN", "CLOSED", "FINISHED"];
    return states[Number(lotteryState)] || "Unknown";
  };

  // Helper function to calculate time remaining until end block
  const getTimeRemainingString = (): string => {
    if (!endBlock || !currentBlockNumber) return "Loading...";

    const blocksRemaining = Number(endBlock) - currentBlockNumber;

    if (blocksRemaining <= 0) return "Ended";

    // Assuming ~15 seconds per block on Taiko
    const secondsRemaining = blocksRemaining * 15;
    const hours = Math.floor(secondsRemaining / 3600);
    const minutes = Math.floor((secondsRemaining % 3600) / 60);

    return `~${hours}h ${minutes}m (${blocksRemaining} blocks)`;
  };

  // Helper to format prize amount
  const formatPrize = (amount: bigint | undefined): string => {
    if (amount === undefined) return "Loading...";
    return `${formatEther(amount)} TTKO`;
  };

  // Calculate winning prize after fees
  const calculateWinningPrize = (): string => {
    if (prizePool === undefined || feePercent === undefined)
      return "Loading...";

    const totalPrize = BigInt(prizePool);
    const fees = (totalPrize * BigInt(feePercent)) / BigInt(10000);
    const winnerAmount = totalPrize - fees;

    return `${formatEther(winnerAmount)} TTKO`;
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <h1 className="text-3xl font-bold mb-8 text-center">Taiko Lottery</h1>

      {!address ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle> Wallet</CardTitle>
            <CardDescription>
              Connect your wallet to participate in the lottery
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={login} className="w-full">
              Connect Wallet
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Lottery Status</CardTitle>
              <CardDescription>Current lottery information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Connected Address</p>
                  <p className="text-sm truncate">{address}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Lottery State</p>
                  <p className="text-sm">{getLotteryStateString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Prize Pool</p>
                  <p className="text-sm">
                    {prizePool ? formatPrize(prizePool) : "Loading..."}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Winning Prize</p>
                  <p className="text-sm">{calculateWinningPrize()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Ticket Price</p>
                  <p className="text-sm">
                    {ticketPrice
                      ? formatEther(ticketPrice) + " TTKO"
                      : "Loading..."}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Total Tickets</p>
                  <p className="text-sm">
                    {ticketCount !== undefined
                      ? Number(ticketCount)
                      : "Loading..."}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Time Remaining</p>
                  <p className="text-sm">{getTimeRemainingString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Winning Ticket</p>
                  <p className="text-sm">
                    {lotteryState !== undefined && Number(lotteryState) === 1
                      ? "Drawing..."
                      : lotteryState !== undefined && Number(lotteryState) === 0
                      ? "Not drawn yet"
                      : winningTicketIndex !== undefined
                      ? Number(winningTicketIndex)
                      : "Loading..."}
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Button
                onClick={() => buyTicket()}
                disabled={
                  isLoading ||
                  isApproving ||
                  (lotteryState !== undefined && Number(lotteryState) !== 0)
                }
                className="flex-1"
              >
                {isApproving
                  ? "Approving..."
                  : isLoading
                  ? "Buying..."
                  : "Buy Ticket"}
              </Button>

              <Button
                onClick={() => endLottery()}
                disabled={
                  lotteryState === undefined ||
                  Number(lotteryState) !== 0 ||
                  (endBlock &&
                    currentBlockNumber &&
                    Number(endBlock) > currentBlockNumber)
                }
                className="flex-1"
                variant="outline"
              >
                End Lottery
              </Button>

              <Button
                onClick={() => claimPrize()}
                disabled={
                  isClaiming ||
                  !hasWinningTicket ||
                  lotteryState === undefined ||
                  Number(lotteryState) !== 2
                }
                className="flex-1"
                variant={
                  hasWinningTicket &&
                  lotteryState !== undefined &&
                  Number(lotteryState) === 2
                    ? "default"
                    : "outline"
                }
              >
                {isClaiming ? "Claiming..." : "Claim Prize"}
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Tickets</CardTitle>
              <CardDescription>
                You have {tickets.length} tickets
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tickets.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">
                  You don't have any tickets yet
                </p>
              ) : (
                <div className="space-y-4">
                  {tickets.map((ticket, index) => (
                    <div
                      key={index}
                      className={`p-4 border rounded-lg ${
                        winningTicketIndex !== undefined &&
                        ticket.ticketIndex === Number(winningTicketIndex)
                          ? "bg-green-50 border-green-200"
                          : ""
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">
                          Ticket #{ticket.ticketIndex}
                        </span>
                        {winningTicketIndex !== undefined &&
                          ticket.ticketIndex === Number(winningTicketIndex) && (
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                              Winner! 🎉
                            </span>
                          )}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Secret: {ticket.secret}</p>
                        <p>
                          Commitment: {ticket.commitment.hex.substring(0, 10)}
                          ...{ticket.commitment.hex.substring(58)}
                        </p>
                        <p>
                          Purchased:{" "}
                          {new Date(ticket.timestamp).toLocaleString()}
                        </p>
                        {ticket.claimed && (
                          <p className="text-green-600">Claimed: Yes</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                onClick={clearStoredTickets}
                className="w-full"
                disabled={tickets.length === 0}
              >
                Clear All Tickets
              </Button>
            </CardFooter>
          </Card>

          <div className="mt-6 text-sm text-gray-500">
            <h3 className="font-medium mb-2">How It Works</h3>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Buy a ticket while the lottery is open</li>
              <li>Your secret is stored securely in your browser</li>
              <li>
                After the lottery ends, a random winning ticket is selected
              </li>
              <li>
                If you have the winning ticket, claim your prize with
                zero-knowledge proof
              </li>
              <li>
                Your prize will be transferred to your wallet automatically
              </li>
            </ol>
            <p className="mt-2">
              This lottery uses zero-knowledge proofs to ensure winners can
              claim prizes without revealing their secrets.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
