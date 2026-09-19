import React, { useState, FormEvent } from "react";
import { Plus, FolderOpen, ArrowUpRight } from "lucide-react";
import { api, Relation, Lesson, Material } from "./api";
import { Empty } from "./components";
export function Collection({
  page,
  tutor,
  relations,
  lessons,
  materials,
  busy,
  action,
  refresh,
}: {
  page: "schedule" | "materials";
  tutor: boolean;
  relations: Relation[];
  lessons: Lesson[];
  materials: Material[];
  busy: boolean;
  action: (fn: () => Promise<void>) => Promise<void>;
  refresh: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const schedule = page === "schedule";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    await action(async () => {
      await api(
        schedule ? "/lessons" : "/materials",
        "POST",
        schedule
          ? {
              ...data,
              starts_at: new Date(data.starts_at as string).toISOString(),
              duration: Number(data.duration),
              payment_status: "unknown",
            }
          : data,
      );
      setAdding(false);
      await refresh();
    });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ВСЁ ДЛЯ УЧЕБНОГО РИТМА</div>
          <h1>{schedule ? "Расписание" : "Материалы"}</h1>
          <p>
            {schedule
              ? "Занятия, к которым удобно возвращаться."
              : "Полезные ссылки от преподавателя — рядом с обучением."}
          </p>
        </div>
        {tutor && (
          <button
            className="primary"
            disabled={!relations.length}
            onClick={() => setAdding(!adding)}
          >
            <Plus size={18} />
            {schedule ? "Добавить занятие" : "Добавить материал"}
          </button>
        )}
      </div>
      {adding && (
        <form className="card collection-form" onSubmit={submit}>
          <label>
            Название
            <input name="title" required minLength={2} maxLength={160} />
          </label>
          <label>
            Ученик
            <select name="relationship_id">
              {relations.map((r) => (
                <option value={r.id} key={r.id}>
                  {r.learner_alias}
                </option>
              ))}
            </select>
          </label>
          {schedule ? (
            <div className="form-grid">
              <label>
                Начало (ваш часовой пояс)
                <input name="starts_at" type="datetime-local" required />
              </label>
              <label>
                Длительность, минут
                <input
                  name="duration"
                  type="number"
                  defaultValue={60}
                  min={15}
                  max={240}
                />
              </label>
            </div>
          ) : (
            <>
              <label>
                Ссылка HTTPS
                <input name="url" type="url" pattern="https://.*" required />
              </label>
              <label>
                Пояснение
                <textarea name="note" maxLength={500} />
              </label>
            </>
          )}
          <button className="primary" disabled={busy}>
            Сохранить
          </button>
        </form>
      )}
      {schedule ? (
        <div className="calendar-list">
          {lessons.length ? (
            [...lessons]
              .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
              .map((l) => (
                <section className="card lesson-row" key={l.id}>
                  <div className="date-block">
                    <strong>{new Date(l.starts_at).getDate()}</strong>
                    <span>
                      {new Date(l.starts_at).toLocaleDateString("ru-RU", {
                        month: "short",
                      })}
                    </span>
                  </div>
                  <div className="row-main">
                    <h3>{l.title}</h3>
                    <p>
                      {new Date(l.starts_at).toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {l.duration} мин ·{" "}
                      {
                        relations.find((r) => r.id === l.relationship_id)?.[
                          tutor ? "learner_alias" : "tutor_alias"
                        ]
                      }
                    </p>
                  </div>
                  {tutor && (
                    <label className="payment-label">
                      Ваша отметка об оплате
                      <select
                        value={l.payment_status}
                        onChange={(e) =>
                          action(async () => {
                            const { id, ...body } = l;
                            await api("/lessons/" + id, "PUT", {
                              ...body,
                              payment_status: e.target.value,
                            });
                            await refresh();
                          })
                        }
                      >
                        <option value="unknown">Не отмечено</option>
                        <option value="paid">Оплачено</option>
                        <option value="unpaid">Не оплачено</option>
                        <option value="waived">Без оплаты</option>
                      </select>
                    </label>
                  )}
                </section>
              ))
          ) : (
            <Empty
              title="Расписание пока свободно"
              text="Назначенные занятия появятся здесь."
            />
          )}
          {tutor && (
            <p className="muted">
              Отметки об оплате — личные записи преподавателя. Сервис не
              принимает и не проверяет платежи.
            </p>
          )}
        </div>
      ) : materials.length ? (
        <div className="material-grid">
          {materials.map((m) => (
            <section className="card material-card" key={m.id}>
              <div className="material-symbol">
                <FolderOpen size={26} />
              </div>
              <h3>{m.title}</h3>
              <p>{m.note}</p>
              <a
                className="text-button"
                href={m.url}
                target="_blank"
                rel="noreferrer"
              >
                Открыть материал <ArrowUpRight size={16} />
              </a>
            </section>
          ))}
        </div>
      ) : (
        <Empty
          title="Соберите свою библиотеку"
          text="Добавляйте разрешённые учебные ссылки. Они будут доступны нужному ученику."
        />
      )}
    </>
  );
}
