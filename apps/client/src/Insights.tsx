import { useEffect, useState } from "react";
import { api } from "./api";

type Recommendation = {
  skill: string;
  reason: string;
  action: string;
  evidence_id: string;
  source_assignment_id: string;
};
export function Recommendations({
  relationship,
  onDraft,
}: {
  relationship: string;
  onDraft: (id: string) => Promise<void>;
}) {
  const [items, setItems] = useState<Recommendation[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setItems([]);
    setError("");
    api<Recommendation[]>(`/relationships/${relationship}/recommendations`)
      .then((data) => {
        if (active) setItems(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [relationship]);
  return (
    <section className="card recommendations">
      <h2>Следующий учебный шаг</h2>
      <p>
        Рекомендации по подтверждённой истории. Это правило выбора темы, не
        новый вывод AI. Назначение остаётся за вами.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!items.length && !error && (
        <p>
          Пока нет подтверждённых затруднений. После проверки работы здесь
          появится следующий шаг.
        </p>
      )}
      {items.map((item) => (
        <div className="work-task" key={item.evidence_id}>
          <h3>{item.skill}</h3>
          <p>
            {item.reason}. {item.action}.
          </p>
          <button
            className="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const draft = await api<{ id: string }>(
                  `/assignments/${item.source_assignment_id}/duplicate`,
                  "POST",
                );
                await onDraft(draft.id);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Подготовить тренировку
          </button>
        </div>
      ))}
    </section>
  );
}

type Stats = {
  assignments: number;
  published: number;
  submissions: number;
  review_actions: Record<string, number>;
  ai_failures: number;
  external_ai_attempts_today: number;
  daily_limit: number;
  note: string;
};
export function Analytics() {
  const [data, setData] = useState<Stats | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api<Stats>("/analytics")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="card analytics">
      <h2>Работа пространства</h2>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Загружаем показатели…</p>}
      {data && (
        <>
          <p>
            Заданий: {data.assignments} · Назначено: {data.published} · Сдач:{" "}
            {data.submissions}
          </p>
          <p>
            Подтверждений AI: {data.review_actions.confirmed} · Проверок
            преподавателя: {data.review_actions.corrected} · Возвратов:{" "}
            {data.review_actions.returned} · Отклонений:{" "}
            {data.review_actions.rejected}
          </p>
          <p>
            Отказов AI: {data.ai_failures}. Ваших внешних AI-вызовов сегодня:{" "}
            {data.external_ai_attempts_today}. Общий дневной лимит сервера:{" "}
            {data.daily_limit}.
          </p>
          <small>{data.note}</small>
        </>
      )}
    </section>
  );
}
