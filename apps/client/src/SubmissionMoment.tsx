import { Check } from "lucide-react";
import { WeekProgress } from "./StreakCard";
import { useJourney } from "./journey";
import "./journeyWidgets.css";

export function AnswerProgress({
  answered,
  total,
}: {
  answered: number;
  total: number;
}) {
  return (
    <section
      className="card journey-answer-progress"
      aria-label="Прогресс ответов"
    >
      <p>
        Заполнено {answered} из {total}
      </p>
      <progress aria-label="Ответы в работе" value={answered} max={total} />
      <small>
        Ответ или TXT добавлен. Правильность проверит преподаватель.
      </small>
    </section>
  );
}

export function SubmissionMoment({ relationship }: { relationship: string }) {
  const { data, error, retry } = useJourney(relationship);
  return (
    <section className="card journey-submitted" aria-label="Работа отправлена">
      <div className="journey-success-circle" aria-hidden="true">
        <Check size={44} />
      </div>
      <h2>Отправлено</h2>
      <p role="status">
        Ответы сохранены. Теперь работу проверит преподаватель.
      </p>
      {data && <WeekProgress data={data} />}
      {!data && !error && <p>Обновляем сводку недели…</p>}
      {error && (
        <div>
          <p role="alert">Работа отправлена, но сводка недели недоступна.</p>
          <button className="secondary" onClick={retry}>
            Обновить сводку недели
          </button>
        </div>
      )}
    </section>
  );
}
