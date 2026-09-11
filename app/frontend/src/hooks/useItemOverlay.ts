import { useSearchParams } from "react-router-dom";

/** Reads/writes the `?open=task:ID` or `?open=goal:ID` query param that drives ItemDetailSheet across every page. */
export function useItemOverlay() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("open");
  const [kind, id] = raw ? (raw.split(":") as ["task" | "goal", string]) : [null, null];

  function openItem(k: "task" | "goal", itemId: string) {
    const next = new URLSearchParams(params);
    next.set("open", `${k}:${itemId}`);
    setParams(next);
  }
  function closeItem() {
    const next = new URLSearchParams(params);
    next.delete("open");
    setParams(next);
  }

  return { kind: kind as "task" | "goal" | null, id, openItem, closeItem };
}
