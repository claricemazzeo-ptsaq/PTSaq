import type { DocumentStatus, GoalStatus, TaskStatus } from "@prisma/client";

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  nao_iniciado: "Não iniciado",
  em_execucao: "Em execução",
  executado: "Executado",
  justificada: "Justificada",
};
export const TASK_STATUS_FROM_LABEL: Record<string, TaskStatus> = {
  "Não iniciado": "nao_iniciado",
  "Em execução": "em_execucao",
  "Executado": "executado",
  "Justificada": "justificada",
};

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  a_iniciar: "A iniciar",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  justificada: "Justificada",
};
export const GOAL_STATUS_FROM_LABEL: Record<string, GoalStatus> = {
  "A iniciar": "a_iniciar",
  "Em andamento": "em_andamento",
  "Concluída": "concluida",
  "Justificada": "justificada",
};

export const GOAL_STATUS_PCT: Record<GoalStatus, number> = {
  concluida: 100,
  em_andamento: 50,
  a_iniciar: 0,
  justificada: 0,
};

export const DOC_STATUS_LABEL: Record<DocumentStatus, string> = {
  aprovado: "Aprovado",
  em_revisao: "Em revisão",
  aguardando_assinatura: "Aguardando assinatura",
};
export const DOC_STATUS_FROM_LABEL: Record<string, DocumentStatus> = {
  "Aprovado": "aprovado",
  "Em revisão": "em_revisao",
  "Aguardando assinatura": "aguardando_assinatura",
};
