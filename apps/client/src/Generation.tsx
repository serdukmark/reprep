import React, { useEffect, useRef, useState } from "react";
import { api } from "./api";
type Job = {
  id: string;
  status: string;
  count: number;
  assignment_id: string | null;
};
export function Generation({
  material,
  open,
}: {
  material: string;
  open: (id: string) => void;
}) {
  const [jobs, setJobs] = useState<Job[]>([]),
    [count, setCount] = useState(3),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const pending = useRef<{ client_id: string; count: number } | null>(null);
  useEffect(() => {
    if (!expanded) return;
    let live = true;
    async function load() {
      try {
        const data = await api<Job[]>(`/materials/${material}/generations`);
        if (live) {
          setJobs(data);
          setLoaded(true);
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      }
    }
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [material, expanded]);
  return (
    <details onToggle={(e) => setExpanded(e.currentTarget.open)}>
      <summary>Создать задания из этого TXT</summary>
      <p>
        AI подготовит черновик из первых 16 000 символов. Проверьте все условия,
        эталоны и критерии перед назначением. Ученику ничего не публикуется
        автоматически.
      </p>
      {error && <p role="alert">{error}</p>}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (pending.current?.count !== count)
              pending.current = { client_id: crypto.randomUUID(), count };
            await api(
              `/materials/${material}/generations`,
              "POST",
              pending.current,
            );
            setJobs(await api(`/materials/${material}/generations`));
            pending.current = null;
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Количество заданий
          <input
            type="number"
            required
            min={1}
            max={5}
            value={count}
            disabled={busy}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </label>
        <button
          className="secondary"
          disabled={
            busy ||
            jobs.some((j) => ["queued", "processing"].includes(j.status))
          }
        >
          Подготовить AI-черновик
        </button>
      </form>
      {!loaded ? (
        <p>Загрузка истории генераций…</p>
      ) : (
        <ul>
          {jobs.map((j) => (
            <li key={j.id}>
              {j.status === "completed" && j.assignment_id ? (
                <button
                  className="text-button"
                  onClick={() => open(j.assignment_id!)}
                >
                  Открыть AI-черновик ({j.count} заданий)
                </button>
              ) : j.status === "failed" ? (
                <p>
                  AI не смог подготовить корректный черновик. Материал сохранён;
                  создайте работу вручную или повторите позже.
                </p>
              ) : (
                <p>Запрос сохранён, AI готовит {j.count} заданий…</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
