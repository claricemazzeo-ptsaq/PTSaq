import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Document } from "../api/types";

export function useDocuments(params: { scope?: string; type?: string; q?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.scope) qs.set("scope", params.scope);
  if (params.type) qs.set("type", params.type);
  if (params.q) qs.set("q", params.q);
  const query = qs.toString();
  return useQuery({
    queryKey: ["documents", params],
    queryFn: () => api.get<Document[]>(`/documents${query ? `?${query}` : ""}`),
  });
}

export function useDocument(id: string | null) {
  return useQuery({
    queryKey: ["document", id],
    queryFn: () => api.get<Document>(`/documents/${id}`),
    enabled: !!id,
  });
}

export function useTogglePin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pin }: { id: string; pin: boolean }) => (pin ? api.post(`/documents/${id}/pin`) : api.delete(`/documents/${id}/pin`)),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["document", vars.id] });
    },
  });
}

export function useRefreshDocuments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ ok: boolean; mock: boolean }>("/documents/refresh"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });
}
