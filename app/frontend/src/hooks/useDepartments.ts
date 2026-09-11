import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Department } from "../api/types";

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: () => api.get<Department[]>("/departments"),
  });
}
