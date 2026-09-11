import { Sheet } from "./Sheet";
import { useTasks } from "../hooks/useTasks";
import { useSetTaskDependency } from "../hooks/useTasks";
import { pillStyle } from "../lib/theme";
import { useToast } from "../state/ToastContext";

export function DependencyPicker({ open, onClose, taskId }: { open: boolean; onClose: () => void; taskId: string }) {
  const { data: tasks } = useTasks();
  const setDependency = useSetTaskDependency();
  const { flash } = useToast();

  const candidates = (tasks || []).filter((t) => t.id !== taskId).slice(0, 30);

  async function pick(blockerId: string, owner: string) {
    await setDependency.mutateAsync({ id: taskId, blockedByTaskId: blockerId });
    onClose();
    flash(`Dependência registrada. ${owner || ""} será avisado ao concluir.`);
  }

  return (
    <Sheet open={open} onClose={onClose} top={150} title="Depende de qual item?" closeLabel="Cancelar">
      <p style={{ margin: "0 0 12px", font: "400 11.5px/1.55 var(--font-body)", color: "var(--ink-muted-3)" }}>
        Quem for responsável pelo item escolhido recebe um aviso quando ele for concluído, e este aqui é liberado na hora.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {candidates.map((c) => (
          <button
            key={c.id}
            onClick={() => pick(c.id, c.owner)}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "12px 13px",
              borderRadius: 11,
              border: "1px solid var(--border-2)",
              background: "var(--surface)",
              display: "flex",
              gap: 10,
              alignItems: "center",
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", font: "500 12.5px/1.35 var(--font-display)", color: "var(--ink)" }}>{c.title}</span>
              <span style={{ display: "block", font: "400 10.5px/1.4 var(--font-body)", color: "var(--ink-muted-3)", marginTop: 3 }}>{c.owner}</span>
            </span>
            <span style={pillStyle(c.status)}>{c.status}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
