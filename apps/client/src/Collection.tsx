import { ChoiceSelect } from "./ChoiceSelect";
import React, { useState, useEffect, useRef, FormEvent } from "react";
import { Plus, FolderOpen, ArrowUpRight } from "lucide-react";
import { api, Relation, Lesson, Material, AssignmentSummary } from "./api";
import { Generation } from "./Generation";
import { Empty, mayLeave, useUnsaved } from "./components";
export function Collection({
  page,
  tutor,
  relations,
  lessons,
  materials,
  busy,
  action,
  refresh,
  openDraft,
}: {
  page: "schedule" | "materials";
  tutor: boolean;
  relations: Relation[];
  lessons: Lesson[];
  materials: Material[];
  busy: boolean;
  action: (fn: () => Promise<void>) => Promise<void>;
  refresh: () => Promise<void>;
  openDraft: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  useUnsaved(adding && formDirty);
  const createKey = useRef(crypto.randomUUID());
  const [file, setFile] = useState<{
    file_name: string;
    content: string;
  } | null>(null);
  const [fileError, setFileError] = useState("");
  const [target, setTarget] = useState(relations[0]?.id || "");
  const [works, setWorks] = useState<AssignmentSummary[]>([]);
  useEffect(() => {
    if (tutor)
      api<AssignmentSummary[]>("/assignments")
        .then(setWorks)
        .catch((e) => setFileError(e.message));
  }, [tutor]);
  const schedule = page === "schedule";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data: Record<string, FormDataEntryValue> = {
      ...Object.fromEntries(new FormData(e.currentTarget)),
      client_id: createKey.current,
    };
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
          : { ...data, ...(file || {}), ai_allowed: data.ai_allowed === "on" },
      );
      createKey.current = crypto.randomUUID();
      setFormDirty(false);
      setAdding(false);
      setFile(null);
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
            onClick={() => {
              if (adding && formDirty && !mayLeave()) return;
              setFormDirty(false);
              setFile(null);
              setFileError("");
              setTarget(relations[0]?.id || "");
              if (!adding) createKey.current = crypto.randomUUID();
              setAdding(!adding);
            }}
          >
            <Plus size={18} />
            {schedule ? "Добавить занятие" : "Добавить материал"}
          </button>
        )}
      </div>
      {adding && (
        <form
          className="card collection-form"
          onSubmit={submit}
          onChange={() => setFormDirty(true)}
        >
          <fieldset disabled={busy} className="form-fields">
            <label>
              Название
              <input name="title" required minLength={2} maxLength={160} />
            </label>
            <label>
              Ученик
              <ChoiceSelect
                name="relationship_id"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                {relations.map((r) => (
                  <option value={r.id} key={r.id}>
                    {r.learner_alias}
                  </option>
                ))}
              </ChoiceSelect>
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
                  <input
                    name="url"
                    type="url"
                    pattern="https://.*"
                    required={!file}
                    disabled={!!file}
                  />
                </label>
                <label>
                  Или файл TXT (UTF-8, до 60 KB)
                  <input
                    type="file"
                    accept=".txt,text/plain"
                    onChange={async (e) => {
                      setFile(null);
                      setFileError("");
                      const chosen = e.target.files?.[0];
                      if (!chosen) return;
                      try {
                        if (
                          !chosen.name.endsWith(".txt") ||
                          chosen.size > 60000
                        )
                          throw new Error("Нужен TXT до 60 KB");
                        const content = new TextDecoder("utf-8", {
                          fatal: true,
                        }).decode(await chosen.arrayBuffer());
                        if (!content.trim() || content.includes("\0"))
                          throw new Error(
                            "Файл пуст или содержит нулевые байты",
                          );
                        setFile({ file_name: chosen.name, content });
                      } catch (err) {
                        setFileError((err as Error).message);
                      }
                    }}
                  />
                </label>
                {fileError && (
                  <p className="error" role="alert">
                    {fileError}
                  </p>
                )}
                <label>
                  Задание
                  <ChoiceSelect name="assignment_id" key={"a" + target}>
                    <option value="">Для всех заданий ученика</option>
                    {works
                      .filter((w) => w.relationship_id === target)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.title}
                        </option>
                      ))}
                  </ChoiceSelect>
                </label>
                <label>
                  Занятие
                  <ChoiceSelect name="lesson_id" key={"l" + target}>
                    <option value="">Без привязки</option>
                    {lessons
                      .filter((l) => l.relationship_id === target)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.title}
                        </option>
                      ))}
                  </ChoiceSelect>
                </label>
                <label>
                  <input type="checkbox" name="ai_allowed" disabled={!file} />{" "}
                  Разрешаю использовать этот TXT в AI-проверке: у меня есть
                  права на материал, персональных данных нет
                </label>
                <label>
                  Пояснение
                  <textarea name="note" maxLength={500} />
                </label>
              </>
            )}
            <button className="primary" disabled={busy || !!fileError}>
              Сохранить
            </button>
          </fieldset>
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
                  <p>
                    {
                      {
                        scheduled: "Запланировано",
                        completed: "Проведено",
                        cancelled: "Отменено",
                      }[l.status || "scheduled"]
                    }
                  </p>
                  {tutor && (
                    <label>
                      Статус занятия
                      <ChoiceSelect
                        disabled={busy}
                        value={l.status || "scheduled"}
                        onChange={(e) =>
                          action(async () => {
                            await api("/lessons/" + l.id, "PATCH", {
                              status: e.target.value,
                            });
                            await refresh();
                          })
                        }
                      >
                        <option value="scheduled">Запланировано</option>
                        <option value="completed">Проведено</option>
                        <option value="cancelled">Отменено</option>
                      </ChoiceSelect>
                    </label>
                  )}
                  {tutor && (
                    <label className="payment-label">
                      Ваша отметка об оплате
                      <ChoiceSelect
                        disabled={busy}
                        value={l.payment_status}
                        onChange={(e) =>
                          action(async () => {
                            await api("/lessons/" + l.id, "PATCH", {
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
                      </ChoiceSelect>
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
              {tutor && m.file_name && m.ai_allowed && (
                <Generation material={m.id} open={openDraft} />
              )}
              {m.file_name ? (
                <button
                  className="text-button"
                  onClick={() =>
                    action(async () => {
                      const data = await api<{
                        content: string;
                        file_name: string;
                      }>("/materials/" + m.id + "/file");
                      const url = URL.createObjectURL(
                        new Blob([data.content], {
                          type: "text/plain;charset=utf-8",
                        }),
                      );
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = data.file_name;
                      a.click();
                      URL.revokeObjectURL(url);
                    })
                  }
                >
                  Скачать {m.file_name}
                </button>
              ) : (
                <a
                  className="text-button"
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Открыть материал <ArrowUpRight size={16} />
                </a>
              )}
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
