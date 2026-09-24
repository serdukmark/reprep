import { useEffect, useRef, useState } from "react";
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
  const practiceRequests = useRef<Record<string, string>>({});
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
                const requestKey = JSON.stringify([relationship, item.source_assignment_id]);
                practiceRequests.current[requestKey] ??= crypto.randomUUID();
                const draft = await api<{ id: string }>(
                  `/assignments/${item.source_assignment_id}/duplicate`,
                  "POST",
                  { client_id: practiceRequests.current[requestKey] },
                );
                delete practiceRequests.current[requestKey];
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
  reviewed_attempts: number;
  median_review_wait_seconds: number | null;
  compared_task_results: number;
  changed_task_results: number;
  awaiting_tutor: number;
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
          <p>
            Ожидают преподавателя: {data.awaiting_tutor}. Медиана ожидания
            решения:{" "}
            {data.median_review_wait_seconds === null
              ? "ещё нет данных"
              : `${Math.round(data.median_review_wait_seconds / 60)} мин`}{" "}
            по {data.reviewed_attempts} попыткам.
          </p>
          <p>
            Преподаватель изменил результат в {data.changed_task_results} из{" "}
            {data.compared_task_results} сопоставленных задач. Это расхождение с
            предварительным разбором, не независимая оценка качества AI и не
            измеренное время работы преподавателя.
          </p>
          <small>{data.note}</small>
        </>
      )}
    </section>
  );
}
