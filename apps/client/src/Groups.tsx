import { ChoiceSelect } from "./ChoiceSelect";
import React, { useEffect, useRef, useState } from "react";
import { api, Relation, AssignmentSummary } from "./api";
import { useUnsaved } from "./components";
type Group = {
  id: string;
  revision: number;
  title: string;
  relationship_ids: string[];
};
export function Groups({
  relations,
  assignments,
  refresh,
}: {
  relations: Relation[];
  assignments: AssignmentSummary[];
  refresh: () => Promise<void>;
}) {
  const [groups, setGroups] = useState<Group[]>([]),
    [editing, setEditing] = useState<Group | null>(null),
    [title, setTitle] = useState(""),
    [members, setMembers] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const pending = useRef<
    Record<string, { signature: string; client_id: string }>
  >({});
  useUnsaved(
    editing
      ? title !== editing.title ||
          JSON.stringify(members) !== JSON.stringify(editing.relationship_ids)
      : !!title || !!members.length,
  );
  async function load() {
    setGroups(await api("/groups"));
  }
  useEffect(() => {
    let live = true;
    api<Group[]>("/groups")
      .then((x) => {
        if (live) setGroups(x);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function bulk(g: Group, kind: string, fields: Record<string, unknown>) {
    const body = { revision: g.revision, ...fields },
      key = g.id + kind,
      signature = JSON.stringify(body);
    if (pending.current[key]?.signature !== signature)
      pending.current[key] = { signature, client_id: crypto.randomUUID() };
    const result = await api<{ count: number }>(
      `/groups/${g.id}/${kind}`,
      "POST",
      { ...body, client_id: pending.current[key].client_id },
    );
    await refresh();
    await load();
    delete pending.current[key];
    setNotice(`Создано записей для участников: ${result.count}`);
  }
  return (
    <section className="card">
      <h3>Групповые занятия</h3>
      <p>
        Группа состоит из ваших учебных связей. Список участников виден только
        вам. Работа и занятие создаются отдельно для каждого ученика; ответы
        одноклассников недоступны.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void act(async () => {
            await api(
              editing ? `/groups/${editing.id}` : "/groups",
              editing ? "PUT" : "POST",
              {
                title,
                relationship_ids: members,
                revision: editing?.revision || 0,
              },
            );
            setTitle("");
            setMembers([]);
            setEditing(null);
            await load();
            setNotice("Группа сохранена");
          });
        }}
      >
        <fieldset disabled={busy}>
          <legend>{editing ? "Изменить состав группы" : "Новая группа"}</legend>
          <label>
            Название группы
            <input
              required
              minLength={2}
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          {relations.map((r) => (
            <label key={r.id}>
              <input
                type="checkbox"
                checked={members.includes(r.id)}
                onChange={(e) =>
                  setMembers((x) =>
                    e.target.checked
                      ? [...x, r.id]
                      : x.filter((id) => id !== r.id),
                  )
                }
              />
              {r.learner_alias} · {r.subject}
            </label>
          ))}
          <p>{members.length} из 20 участников</p>
          <button
            className="primary"
            disabled={!members.length || members.length > 20}
          >
            Сохранить группу
          </button>
          {editing && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setEditing(null);
                setTitle("");
                setMembers([]);
              }}
            >
              Отменить изменение группы
            </button>
          )}
        </fieldset>
      </form>
      {!groups.length && <p>Групп пока нет.</p>}
      {groups.map((g) => (
        <article className="card" key={g.id}>
          <h4>{g.title}</h4>
          <p>
            {g.relationship_ids
              .map(
                (id) =>
                  relations.find((r) => r.id === id)?.learner_alias ||
                  "Недоступная связь",
              )
              .join(", ")}
          </p>
          <button
            disabled={busy || !!title || !!members.length}
            className="secondary"
            onClick={() => {
              setEditing(g);
              setTitle(g.title);
              setMembers([...g.relationship_ids]);
            }}
          >
            Изменить состав
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void act(() =>
                bulk(g, "assign", {
                  assignment_id: String(data.get("assignment_id")),
                }),
              );
            }}
          >
            <label>
              Работа для группы {g.title}
              <ChoiceSelect name="assignment_id" required disabled={busy}>
                <option value="">Выберите проверенный шаблон</option>
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </ChoiceSelect>
            </label>
            <p>
              Будут назначены копии условий и критериев. Ответы прежнего ученика
              и материалы не копируются.
            </p>
            <button className="primary" disabled={busy}>
              Назначить работу всем {g.relationship_ids.length} участникам
            </button>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void act(() =>
                bulk(g, "lessons", {
                  title: String(data.get("title")),
                  starts_at: new Date(
                    String(data.get("starts_at")),
                  ).toISOString(),
                  duration: Number(data.get("duration")),
                }),
              );
            }}
          >
            <fieldset disabled={busy}>
              <legend>Общее занятие для {g.title}</legend>
              <label>
                Тема общего занятия
                <input name="title" required minLength={2} maxLength={160} />
              </label>
              <label>
                Начало общего занятия
                <input name="starts_at" type="datetime-local" required />
              </label>
              <label>
                Длительность общего занятия
                <input
                  name="duration"
                  type="number"
                  min={15}
                  max={240}
                  defaultValue={60}
                  required
                />
              </label>
              <button className="primary">
                Запланировать для всех {g.relationship_ids.length} участников
              </button>
            </fieldset>
          </form>
          <p>
            Изменение состава применяется только к следующим назначениям.
            Переносы и отмены уже созданных занятий выполняются в расписании
            каждого ученика. Видеоконференция автоматически не создаётся.
          </p>
        </article>
      ))}
    </section>
  );
}
