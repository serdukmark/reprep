import React, { useEffect, useState } from "react";
import { api, Assignment, Material } from "./api";
export function WorkMaterials({ assignment }: { assignment: Assignment }) {
  const [items, setItems] = useState<Material[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    api<Material[]>("/materials")
      .then((rows) => {
        if (live)
          setItems(
            rows.filter(
              (m) =>
                m.assignment_id === assignment.id ||
                (!m.assignment_id &&
                  assignment.lesson_id &&
                  m.lesson_id === assignment.lesson_id),
            ),
          );
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [assignment.id, assignment.lesson_id]);
  if (!items.length && !error) return null;
  return (
    <section className="card">
      <h3>Материалы к работе</h3>
      {error && <p role="alert">{error}</p>}
      {items.map((m) => (
        <p key={m.id}>
          <strong>{m.title}</strong>
          {m.file_name ? (
            <button
              className="text-button"
              onClick={async () => {
                setError("");
                try {
                  const data = await api<{
                    file_name: string;
                    content: string;
                  }>(`/materials/${m.id}/file`);
                  const url = URL.createObjectURL(
                    new Blob([data.content], {
                      type: "text/plain;charset=utf-8",
                    }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = data.file_name;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Скачать {m.file_name}
            </button>
          ) : (
            <a href={m.url} target="_blank" rel="noreferrer">
              Открыть материал
            </a>
          )}
        </p>
      ))}
    </section>
  );
}
