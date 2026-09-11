import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { PendingAccountRequest } from "../api/types";

export function usePendingAccounts(enabled: boolean) {
  return useQuery({
    queryKey: ["pending-accounts"],
    queryFn: () => api.get<PendingAccountRequest[]>("/admin/pending-accounts"),
    enabled,
  });
}

export function useApproveAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/admin/pending-accounts/${id}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pending-accounts"] }),
  });
}
