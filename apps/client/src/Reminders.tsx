import React, { useEffect, useState } from "react";
import { api, date } from "./api";
export function Reminders({ open }: { open: (id: string) => void }) {
  const [data, setData] = useState<{
      note: string;
      items: {
        id: string;
        kind: string;
        title: string;
        at: string;
        resource_id: string;
      }[];
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const result = await api<NonNullable<typeof data>>("/reminders");
        if (live) {
          setData(result);
          setError("");
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      }
    }
    void load();
    const timer = setInterval(load, 60000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <section className="card">
      <h3>Напоминания</h3>
      {error && <p role="alert">{error}</p>}
      {data ? (
        <>
          <p>{data.note}</p>
          {!data.items.length && <p>Ближайших напоминаний нет.</p>}
          <ul>
            {data.items.map((i) => (
              <li key={i.id}>
                <strong>
                  {i.kind === "lesson"
                    ? "Занятие"
                    : i.kind === "overdue"
                      ? "Просрочено"
                      : "Срок работы"}
                  : {i.title}
                </strong>
                <p>{date(i.at)}</p>
                {i.kind !== "lesson" && (
                  <button
                    className="text-button"
                    onClick={() => open(i.resource_id)}
                  >
                    Открыть задание
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>Проверяем сроки…</p>
      )}
    </section>
  );
}

export function CalendarDownload() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="card">
      <button
        className="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const data = await api<{ file_name: string; content: string }>(
              "/calendar",
            );
            const url = URL.createObjectURL(
              new Blob([data.content], { type: "text/calendar;charset=utf-8" }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = data.file_name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Скачать календарь (.ics)
      </button>
      <p>
        Одноразовый экспорт занятий. После переноса или отмены обновите внешний
        календарь вручную; автоматической синхронизации пока нет.
      </p>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
