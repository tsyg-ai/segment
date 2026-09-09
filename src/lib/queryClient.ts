import { QueryClient } from "@tanstack/react-query";

/**
 * One QueryClient for the app. This is a local, instant SQLite-backed app:
 * data only changes through our own mutations, so refetch-on-focus and
 * network-style retries are off. Mutations invalidate via `qk.*` keys.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: 5 * 60_000,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export const queryClient = makeQueryClient();
