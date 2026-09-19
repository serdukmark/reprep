import { useEffect, useState } from "react";
import { api, date, Assignment, Submission } from "./api";
import { Badge } from "./components";

type Entry = { id: string; attempt: number; status: string; submitted: string };
type Page = { items: Entry[]; next_offset: number | null };
export function AttemptHistory({
  assignment,
  tutor,
}: {
  assignment: Assignment;
  tutor: boolean;
}) {
  const [opened, setOpened] = useState(false),
    [items, setItems] = useState<Entry[]>([]),
    [next, setNext] = useState<number | null>(0),
    [selected, setSelected] = useState<Submission | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load(offset: number) {
    setBusy(true);
    setError("");
    try {
      const data = await api<Page>(
        "/assignments/" + assignment.id + "/attempts?offset=" + offset,
      );
      setItems((old) => (offset ? [...old, ...data.items] : data.items));
      setNext(data.next_offset);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (opened) {
      setSelected(null);
      load(0);
    }
  }, [opened, assignment.submission?.id, assignment.submission?.status]);
  async function view(id: string) {
    setSelected(null);
    setBusy(true);
    setError("");
    try {
      setSelected(await api<Submission>("/submissions/" + id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card attempt-history">
      <button
        className="text-button"
        aria-expanded={opened}
        onClick={() => setOpened(!opened)}
      >
        История попыток{opened ? " · Свернуть" : ""}
      </button>
      {opened && (
        <>
          <p>
            Отправленные ответы сохраняются неизменными. Эти ответы видны только
            ученику и его преподавателю.
          </p>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {busy && <p role="status">Загружаем историю…</p>}
          {items.map((entry) => (
            <button
              className="assignment-row"
              disabled={busy}
              key={entry.id}
              onClick={() => view(entry.id)}
            >
              <strong>Попытка {entry.attempt}</strong>
              <span>{date(entry.submitted)}</span>
              <Badge state={entry.status} />
            </button>
          ))}
          {next !== null && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => load(next)}
            >
              {busy ? "Загружаем…" : "Показать ещё"}
            </button>
          )}
          {selected && (
            <div className="attempt-detail">
              <h3>Попытка {selected.attempt} · Отправленный оригинал</h3>
              {selected.review?.note && (
                <div className="notice">
                  Комментарий преподавателя: {selected.review.note}
                </div>
              )}
              {assignment.tasks.map((task, index) => {
                const reviewed = selected.review?.tasks.find(
                  (t) => t.task_id === task.id,
                );
                const analysis = selected.analysis?.tasks.find(
                  (t) => t.task_id === task.id,
                );
                return (
                  <div key={task.id} className="work-task">
                    <strong>
                      Задание {index + 1}. {task.prompt}
                    </strong>
                    <div className="original">
                      <p>{selected.answers[task.id]}</p>
                    </div>
                    {reviewed && (
                      <div className="reviewed-feedback">
                        <Badge state={reviewed.correctness} />
                        <p>{reviewed.feedback}</p>
                      </div>
                    )}
                    {tutor && analysis && (
                      <details>
                        <summary>
                          Предварительный AI-разбор этой попытки
                        </summary>
                        <Badge state={analysis.correctness} />
                        <p>{analysis.summary_for_tutor}</p>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
