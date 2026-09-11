import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Availability, User } from "../api/types";
import { useAuth } from "../state/AuthContext";

export function useUpdateAvailability() {
  const { refresh } = useAuth();
  return useMutation({
    mutationFn: (availability: Availability) => api.patch<{ user: User }>("/me", { availability }),
    onSuccess: () => refresh(),
  });
}

export function useUpdateMePrefs() {
  const { refresh } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { notifyPush?: boolean; offlineCacheMb?: number }) => api.patch<{ user: User }>("/me", data),
    onSuccess: () => {
      refresh();
      queryClient.invalidateQueries({ queryKey: ["sync-status"] });
    },
  });
}
