import React, { useEffect, useRef, useState } from "react";
import { api, Task } from "./api";
import { useUnsaved } from "./components";
type Question = {
  id: string;
  cursor: number;
  task_id: string;
  question: string;
  status: string;
  response: string | null;
  needs_teacher: boolean;
  draft: {
    text: string;
    engine: string;
    confidence: number;
    status: string;
  } | null;
};
function ReviewQuestion({
  question,
  refresh,
}: {
  question: Question;
  refresh: () => Promise<void>;
}) {
  const [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useUnsaved(!!text);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api(`/questions/${question.id}/review`, "POST", { text });
          setText("");
          await refresh();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {question.draft && (
        <details>
          <summary>
            Предварительный ответ ·{" "}
            {question.draft.engine === "unavailable"
              ? "AI недоступен"
              : question.draft.engine}
          </summary>
          <p>{question.draft.text}</p>
          <p>
            Уверенность: {Math.round(question.draft.confidence * 100)}%. Это
            оценка модели, не доказанная точность.
          </p>
          {question.draft.engine !== "unavailable" && (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setText(question.draft!.text)}
            >
              Взять текст для проверки
            </button>
          )}
        </details>
      )}
      <label>
        Ответ преподавателя на вопрос
        <textarea
          required
          maxLength={3000}
          disabled={busy}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <button className="primary" disabled={busy || !text.trim()}>
        Подтвердить и отправить ответ
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
export function Questions({
  assignment,
  tasks,
  tutor,
}: {
  assignment: string;
  tasks: Task[];
  tutor: boolean;
}) {
  const [items, setItems] = useState<Question[]>([]),
    [older, setOlder] = useState<Question[]>([]),
    [text, setText] = useState(""),
    [task, setTask] = useState(tasks[0]?.id || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [end, setEnd] = useState(false);
  const pending = useRef<{
    client_id: string;
    text: string;
    task_id: string;
  } | null>(null);
  useUnsaved(!!text);
  async function refresh() {
    setItems(await api(`/assignments/${assignment}/questions`));
    setLoaded(true);
  }
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const result = await api<Question[]>(
          `/assignments/${assignment}/questions`,
        );
        if (live) {
          setItems(result);
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
  }, [assignment]);
  const all = Array.from(
    new Map([...older, ...items].map((q) => [q.id, q])).values(),
  ).sort((a, b) => a.cursor - b.cursor);
  return (
    <section className="card">
      <h3>Вопрос по заданию для AI и преподавателя</h3>
      <p>
        AI готовит подсказку только по выбранному заданию. Преподаватель
        проверяет текст перед отправкой. При отказе модели вопрос остаётся
        преподавателю.
      </p>
      {error && <p role="alert">{error}</p>}
      {!loaded ? (
        <p>Загрузка вопросов…</p>
      ) : !all.length ? (
        <p>Вопросов пока нет.</p>
      ) : (
        <>
          {!end && all.length >= 50 && (
            <button
              disabled={busy}
              className="secondary"
              onClick={async () => {
                setBusy(true);
                try {
                  const rows = await api<Question[]>(
                    `/assignments/${assignment}/questions?before=${all[0].cursor}`,
                  );
                  setOlder((x) => [...x, ...rows]);
                  setEnd(rows.length < 50);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Ранние вопросы
            </button>
          )}
          {all.map((q) => (
            <article key={q.id}>
              <strong>{q.question}</strong>
              {q.response ? (
                <p style={{ whiteSpace: "pre-wrap" }}>
                  Ответ проверен преподавателем: {q.response}
                </p>
              ) : (
                <>
                  <p>
                    {q.needs_teacher
                      ? "AI не смог ответить. Ответит преподаватель."
                      : q.status === "queued" || q.status === "processing"
                        ? "Вопрос сохранён, готовится предварительный ответ."
                        : "Предварительный ответ ждёт проверки преподавателем."}
                  </p>
                  {tutor && <ReviewQuestion question={q} refresh={refresh} />}
                </>
              )}
            </article>
          ))}
        </>
      )}
      {!tutor && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              if (
                !pending.current ||
                pending.current.text !== text.trim() ||
                pending.current.task_id !== task
              )
                pending.current = {
                  client_id: crypto.randomUUID(),
                  text: text.trim(),
                  task_id: task,
                };
              await api(
                `/assignments/${assignment}/questions`,
                "POST",
                pending.current,
              );
              setText("");
              pending.current = null;
              await refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Задание для вопроса
            <select
              disabled={busy}
              value={task}
              onChange={(e) => setTask(e.target.value)}
            >
              {tasks.map((t, i) => (
                <option key={t.id} value={t.id}>
                  Задание {i + 1} · {t.skill}
                </option>
              ))}
            </select>
          </label>
          <label>
            Вопрос к AI
            <textarea
              disabled={busy}
              required
              maxLength={3000}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <button className="primary" disabled={busy || !text.trim()}>
            Задать вопрос
          </button>
        </form>
      )}
    </section>
  );
}
