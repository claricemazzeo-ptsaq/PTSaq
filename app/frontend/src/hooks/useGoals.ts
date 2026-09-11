import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { enqueueEdit, isNetworkError } from "../lib/offlineQueue";
import type { Goal } from "../api/types";

function findCachedGoal(qc: QueryClient, id: string): Goal | null {
  const single = qc.getQueryData<Goal>(["goal", id]);
  if (single) return single;
  for (const [, data] of qc.getQueriesData<Goal[]>({ queryKey: ["goals"] })) {
    const found = data?.find((g) => g.id === id);
    if (found) return found;
  }
  return null;
}

export function useGoals(params: { department?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.department) qs.set("department", params.department);
  const query = qs.toString();
  return useQuery({
    queryKey: ["goals", params],
    queryFn: () => api.get<Goal[]>(`/goals${query ? `?${query}` : ""}`),
  });
}

export function useGoal(id: string | null) {
  return useQuery({
    queryKey: ["goal", id],
    queryFn: () => api.get<Goal>(`/goals/${id}`),
    enabled: !!id,
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { status?: Goal["status"]; note?: string | null } }) => {
      try {
        return await api.patch<Goal>(`/goals/${id}`, data);
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        await enqueueEdit("goal", id, data);
        const base = findCachedGoal(queryClient, id);
        return { ...(base as Goal), ...data, id, kind: "goal" as const };
      }
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["goal", updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["sync-status"] });
    },
  });
}

export function useGoalAudit(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ["goal-audit", id],
    queryFn: () => api.get<import("../api/types").AuditRow[]>(`/goals/${id}/audit`),
    enabled: !!id && enabled,
  });
}
