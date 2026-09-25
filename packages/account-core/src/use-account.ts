import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
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
