import { ArrowRight, Flame, Medal } from "lucide-react";
import { ChoiceSelect } from "./ChoiceSelect";
import { Relation } from "./api";
import { Journey, useJourney } from "./journey";
import "./journeyWidgets.css";

export function WeekProgress({ data }: { data: Journey }) {
  if (data.data_status === "insufficient_data") return null;
  const { week } = data;
  return (
    <div className="journey-week">
      <p>
        {week.total
          ? `Работы этой недели: сдано ${week.submitted} из ${week.total}`
          : "На этой неделе нет работ со сроком сдачи."}
      </p>
      {week.total > 0 && (
        <>
          <progress
            aria-label="Работы недели"
            max={week.total}
            value={week.submitted}
          />
          <p>Из них в срок: {week.on_time}.</p>
        </>
      )}
      {week.complete && week.total > 0 && (
        <p className="journey-medal" data-testid="journey-week-medal">
          <Medal aria-hidden="true" size={28} /> Все работы недели сданы
        </p>
      )}
      <small>
        Неделя: понедельник–воскресенье, UTC. По срокам назначенных работ.
      </small>
    </div>
  );
}

export function StreakCard({
  relationship,
  relations,
  select,
  openPath,
}: {
  relationship: string;
  relations: Relation[];
  select: (id: string) => void;
  openPath: () => void;
}) {
  const { data, error, retry } = useJourney(relationship);
  const relation = relations.find((r) => r.id === relationship);
  return (
    <section
      className="card journey-streak"
      data-testid="journey-streak"
      aria-label="Серия сдач в срок"
    >
      <div className="journey-widget-heading">
        <Flame className="journey-flame" size={42} aria-hidden="true" />
        <div>
          <h2>Серия сдач в срок</h2>
          <p>
            {relation?.subject} · {relation?.tutor_alias}
          </p>
        </div>
      </div>
      {relations.length > 1 && (
        <label>
          Обучение для серии
          <ChoiceSelect
            value={relationship}
            onChange={(e) => select(e.target.value)}
          >
            {relations.map((r) => (
              <option key={r.id} value={r.id}>
                {r.subject} · {r.tutor_alias}
              </option>
            ))}
          </ChoiceSelect>
        </label>
      )}
      {!data && !error && <p role="status">Считаем по отправленным работам…</p>}
      {error && (
        <div>
          <p role="alert">Не удалось загрузить серию. {error}</p>
          <button className="secondary" onClick={retry}>
            Повторить загрузку серии
          </button>
        </div>
      )}
      {data && (
        <>
          {data.data_status === "insufficient_data" ? (
            <p>Недостаточно данных о сроках или сдачах для расчёта серии.</p>
          ) : data.streak.count === null ? (
            <p>
              Серия ещё не началась. Она появится после сдачи работы со сроком.
            </p>
          ) : (
            <p className="journey-streak-count">
              <strong>{data.streak.count}</strong> подряд в срок
            </p>
          )}
          <WeekProgress data={data} />
          <small>
            Сводка на{" "}
            {new Date(data.calculated_at).toLocaleString("ru-RU", {
              timeZone: "UTC",
            })}{" "}
            UTC.
          </small>
        </>
      )}
      <details>
        <summary>Как считается серия</summary>
        <p>
          По первой отправке каждой работы в этом обучении. Сдача не позже срока
          добавляет одну работу; пропуск срока обнуляет серию. Черновики, работы
          без срока и повторные попытки её не увеличивают. Будущая несданная
          работа не меняет серию. При одинаковом сроке пропуск любой из работ
          обнуляет всю группу. Исправление и ожидание проверки не отнимают сдачу
          в срок. Это факт отправки, а не оценка ответа.
        </p>
      </details>
      <button className="text-button" onClick={openPath}>
        Мой путь <ArrowRight size={18} aria-hidden="true" />
      </button>
    </section>
  );
}
