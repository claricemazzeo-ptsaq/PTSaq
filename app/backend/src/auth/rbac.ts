import type { User } from "@prisma/client";

/**
 * Mirrors the prototype's canEdit(): admins edit everything, leads edit
 * everything in their own department, contributors edit only rows where
 * they appear (by first name) in the free-text owner field. Everyone reads
 * everything — the lock is on write, never on visibility.
 */
export function canEditRow(user: Pick<User, "role" | "departmentId" | "name">, rowDepartmentId: string, ownerName: string | null | undefined): boolean {
  if (user.role === "admin") return true;
  if (user.departmentId !== rowDepartmentId) return false;
  if (user.role === "contrib") {
    const firstName = user.name.split(" ")[0];
    return (ownerName || "").includes(firstName);
  }
  return true; // lead
}

export function readOnlyReason(user: Pick<User, "role" | "departmentId" | "name">, rowDepartmentId: string, ownerName: string | null | undefined, departmentShort: string): string {
  if (user.role === "contrib" && user.departmentId === rowDepartmentId) {
    return `Somente leitura. Este item é de ${ownerName || "outra pessoa"}; você edita os itens em que aparece como responsável.`;
  }
  return `Somente leitura. Esta tarefa pertence a ${departmentShort}; você acompanha, mas quem edita é a liderança dela.`;
}
