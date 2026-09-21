import React, { useEffect, useState, useRef } from "react";
import { api, date } from "./api";
import { useUnsaved } from "./components";
type Message = {
  id: string;
  cursor: number;
  text: string;
  alias: string;
  role: string;
  created: string;
};
export function Discussion({ assignment }: { assignment: string }) {
  const [items, setItems] = useState<Message[]>([]),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [older, setOlder] = useState<Message[]>([]),
    [end, setEnd] = useState(false);
  const pending = useRef<{ client_id: string; text: string } | null>(null);
  useUnsaved(!!text);
  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const rows = await api<Message[]>(
          `/assignments/${assignment}/messages`,
        );
        if (live) {
          setItems(rows);
          setLoaded(true);
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      }
    };
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [assignment]);
  const all = Array.from(
    new Map([...items, ...older].map((m) => [m.id, m])).values(),
  ).sort((a, b) => a.cursor - b.cursor);
  return (
    <section className="card">
      <h3>Обсуждение с преподавателем</h3>
      <p>
        Сообщения видны только ученику и его преподавателю в этом задании. Это
        переписка с человеком, не AI.
      </p>
      {error && <p role="alert">{error}</p>}
      {!loaded ? (
        <p>Загрузка обсуждения…</p>
      ) : !all.length ? (
        <p>Сообщений пока нет.</p>
      ) : (
        <>
          {!end && all.length >= 50 && (
            <button
              disabled={busy}
              className="secondary"
              onClick={async () => {
                setBusy(true);
                try {
                  const rows = await api<Message[]>(
                    `/assignments/${assignment}/messages?before=${all[0].cursor}`,
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
              Ранние сообщения
            </button>
          )}
          <ol>
            {all.map((m) => (
              <li key={m.id}>
                <strong>
                  {m.alias} · {m.role === "tutor" ? "Преподаватель" : "Ученик"}
                </strong>
                <small> {date(m.created)}</small>
                <p style={{ whiteSpace: "pre-wrap" }}>{m.text}</p>
              </li>
            ))}
          </ol>
        </>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (!pending.current || pending.current.text !== text.trim())
              pending.current = {
                client_id: crypto.randomUUID(),
                text: text.trim(),
              };
            await api(
              `/assignments/${assignment}/messages`,
              "POST",
              pending.current,
            );
            pending.current = null;
            setText("");
            setItems(await api(`/assignments/${assignment}/messages`));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Сообщение по заданию
          <textarea
            required
            maxLength={3000}
            disabled={busy}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <button className="primary" disabled={busy || !text.trim()}>
          Отправить сообщение
        </button>
      </form>
    </section>
  );
}
