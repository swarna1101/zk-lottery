"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { PrivyProvider } from "@privy-io/react-auth";
// Make sure to import these from `@privy-io/wagmi`, not `wagmi`
import { WagmiProvider, createConfig } from "@privy-io/wagmi";

import { taikoHekla } from "viem/chains";
import { http } from "wagmi";

// Replace these with your app's chains

export const config = createConfig({
  chains: [taikoHekla],
  transports: {
    [taikoHekla.id]: http(),
  },
});

const queryClient = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId="cm927gixt01tcjr0kldbdowy3"
      clientId="client-WY5iiWaXDF4igZUj7gdBWmLV3Kj58LtMCMz4ikGYNCsbK"
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
