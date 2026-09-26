import { useQuery, useSuspenseQuery, type UseQueryOptions } from "@tanstack/react-query";
import { getAccount, type Account } from "./api";

export const accountQueryKey = ["account"] as const;

export type AccountQueryOptions<TData = Account> = Omit<
  UseQueryOptions<Account, Error, TData, typeof accountQueryKey>,
  "queryKey" | "queryFn"
>;

export function useAccount<TData = Account>(options?: AccountQueryOptions<TData>) {
  return useQuery({
    queryKey: accountQueryKey,
    queryFn: getAccount,
    ...options,
  });
}

/**
 * The same query for a component that leaves waiting and failing to whoever
 * mounts it: it suspends until the account is there, and throws to the nearest
 * error boundary when it cannot be loaded.
 */
export function useSuspenseAccount() {
  return useSuspenseQuery({ queryKey: accountQueryKey, queryFn: getAccount });
}
