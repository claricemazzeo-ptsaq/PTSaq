import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { enqueueEdit, isNetworkError } from "../lib/offlineQueue";
import type { Task } from "../api/types";

function findCachedTask(qc: QueryClient, id: string): Task | null {
  const single = qc.getQueryData<Task>(["task", id]);
  if (single) return single;
  for (const [, data] of qc.getQueriesData<Task[]>({ queryKey: ["tasks"] })) {
    const found = data?.find((t) => t.id === id);
    if (found) return found;
  }
  return null;
}

export function useTasks(params: { department?: string; mine?: boolean } = {}) {
  const qs = new URLSearchParams();
  if (params.department) qs.set("department", params.department);
  if (params.mine) qs.set("mine", "true");
  const query = qs.toString();
  return useQuery({
    queryKey: ["tasks", params],
    queryFn: () => api.get<Task[]>(`/tasks${query ? `?${query}` : ""}`),
  });
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () => api.get<Task>(`/tasks/${id}`),
    enabled: !!id,
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { status?: Task["status"]; note?: string | null } }) => {
      try {
        return await api.patch<Task>(`/tasks/${id}`, data);
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        await enqueueEdit("task", id, data);
        const base = findCachedTask(queryClient, id);
        return { ...(base as Task), ...data, id, kind: "task" as const };
      }
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["task", updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}

export function useSetTaskDependency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, blockedByTaskId }: { id: string; blockedByTaskId: string | null }) =>
      blockedByTaskId ? api.post(`/tasks/${id}/dependency`, { blockedByTaskId }) : api.delete(`/tasks/${id}/dependency`),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["task", vars.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useResolveConflict() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, keep }: { id: string; keep: "mine" | "sheet" }) => api.post<Task>(`/tasks/${id}/resolve-conflict`, { keep }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["task", updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-audit", updated.id] });
    },
  });
}

export function useTaskAudit(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ["task-audit", id],
    queryFn: () => api.get<import("../api/types").AuditRow[]>(`/tasks/${id}/audit`),
    enabled: !!id && enabled,
  });
}
