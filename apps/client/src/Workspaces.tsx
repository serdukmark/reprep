import { ChoiceSelect } from "./ChoiceSelect";
import { useEffect, useRef, useState } from "react";
import { api, AssignmentSummary, Relation, User } from "./api";

type Space = { id: string; title: string; owner_id: string };
type Member = { id: string; alias: string };
type Template = {
  id: string;
  title: string;
  author_alias: string;
  tasks_count: number;
};
type Invite = { id: string; state: string; expires: number };
export function Workspaces({
  user,
  assignments,
  relations,
  openDraft,
}: {
  user: User;
  assignments: AssignmentSummary[];
  relations: Relation[];
  openDraft: (id: string) => void;
}) {
  const [spaces, setSpaces] = useState<Space[]>([]),
    [selected, setSelected] = useState("");
  const [members, setMembers] = useState<Member[]>([]),
    [templates, setTemplates] = useState<Template[]>([]),
    [invites, setInvites] = useState<Invite[]>([]);
  const [title, setTitle] = useState(""),
    [joinCode, setJoinCode] = useState(""),
    [inviteCode, setInviteCode] = useState("");
  const [source, setSource] = useState(""),
    [target, setTarget] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const createKey = useRef(crypto.randomUUID());
  const copyRequest = useRef<{
    template: string;
    relation: string;
    id: string;
  } | null>(null);
  const owner =
    spaces.find((item) => item.id === selected)?.owner_id === user.id;
  async function load(preferred = selected) {
    const items = await api<Space[]>("/workspaces");
    setSpaces(items);
    const chosen = items.some((item) => item.id === preferred)
      ? preferred
      : items[0]?.id || "";
    if (chosen !== selected) {
      setSelected(chosen);
      return;
    }
    if (selected) {
      setMembers(await api<Member[]>(`/workspaces/${selected}/members`));
      setTemplates(await api<Template[]>(`/workspaces/${selected}/templates`));
      setInvites(
        items.find((item) => item.id === selected)?.owner_id === user.id
          ? await api<Invite[]>(`/workspaces/${selected}/invitations`)
          : [],
      );
    }
  }
  useEffect(() => {
    setInviteCode("");
    setMembers([]);
    setTemplates([]);
    setInvites([]);
    load().catch((e) => setError(e.message));
  }, [selected]);
  async function run(fn: () => Promise<void | string>) {
    setBusy(true);
    setError("");
    try {
      const next = await fn();
      await load(next || selected);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <h2>Пространства преподавателей</h2>
      <p>
        Общая библиотека шаблонов. При копировании создаётся личный черновик для
        вашего ученика. Ответы учеников и файлы исходной работы не передаются.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="form-grid">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const created = await api<{ id: string }>("/workspaces", "POST", {
                title,
                client_id: createKey.current,
              });
              createKey.current = crypto.randomUUID();
              setTitle("");
              return created.id;
            });
          }}
        >
          <label>
            Название пространства
            <input
              minLength={2}
              maxLength={100}
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <button className="secondary" disabled={busy}>
            Создать пространство
          </button>
        </form>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const joined = await api<{ id: string }>(
                "/workspaces/accept",
                "POST",
                { token: joinCode.trim() },
              );
              setJoinCode("");
              return joined.id;
            });
          }}
        >
          <label>
            Код пространства
            <input
              required
              value={joinCode}
              maxLength={200}
              onChange={(e) => setJoinCode(e.target.value)}
            />
          </label>
          <button className="secondary" disabled={busy}>
            Вступить в пространство
          </button>
        </form>
      </div>
      {!!spaces.length && (
        <label>
          Текущее пространство
          <ChoiceSelect
            value={selected}
            disabled={busy}
            onChange={(e) => setSelected(e.target.value)}
          >
            {spaces.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </ChoiceSelect>
        </label>
      )}
      {selected && (
        <>
          <h3>Участники</h3>
          {members.map((member) => (
            <div className="form-actions" key={member.id}>
              <span>{member.alias}</span>
              {((owner && member.id !== user.id) ||
                (!owner && member.id === user.id)) && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api(
                        `/workspaces/${selected}/members/${member.id}/remove`,
                        "POST",
                      );
                    })
                  }
                >
                  {member.id === user.id
                    ? "Выйти из пространства"
                    : `Исключить ${member.alias}`}
                </button>
              )}
            </div>
          ))}
          {owner && (
            <>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const invite = await api<{ token: string }>(
                      `/workspaces/${selected}/invite`,
                      "POST",
                    );
                    setInviteCode(invite.token);
                  })
                }
              >
                Пригласить коллегу
              </button>
              {inviteCode && (
                <label>
                  Код для коллеги
                  <input value={inviteCode} readOnly />
                </label>
              )}
              {invites
                .filter(
                  (item) =>
                    item.state === "created" &&
                    item.expires * 1000 > Date.now(),
                )
                .map((item) => (
                  <button
                    className="text-button"
                    key={item.id}
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await api(
                          `/workspaces/${selected}/invitations/${item.id}/revoke`,
                          "POST",
                        );
                        setInviteCode("");
                      })
                    }
                  >
                    Отозвать приглашение коллеги
                  </button>
                ))}
            </>
          )}
          <h3>Поделиться шаблоном</h3>
          <p>
            Участники получат условия, эталоны, критерии и подсказки. Проверьте,
            что в тексте нет личных сведений ученика.
          </p>
          <label>
            Моя работа для шаблона
            <ChoiceSelect
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="">Выберите работу</option>
              {assignments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </ChoiceSelect>
          </label>
          <button
            className="secondary"
            disabled={busy || !source}
            onClick={() =>
              run(async () => {
                await api(`/workspaces/${selected}/templates`, "POST", {
                  assignment_id: source,
                });
              })
            }
          >
            Поделиться с участниками
          </button>
          <h3>Общие шаблоны</h3>
          <label>
            Мой ученик для копии
            <ChoiceSelect
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">Выберите ученика</option>
              {relations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.learner_alias} · {item.subject}
                </option>
              ))}
            </ChoiceSelect>
          </label>
          {!templates.length && <p>Шаблонов пока нет.</p>}
          {templates.map((item) => (
            <div className="form-actions" key={item.id}>
              <span>
                <strong>{item.title}</strong> · {item.author_alias} ·{" "}
                {item.tasks_count} заданий
              </span>
              <button
                className="secondary"
                disabled={busy || !target}
                onClick={() =>
                  run(async () => {
                    if (
                      !copyRequest.current ||
                      copyRequest.current.template !== item.id ||
                      copyRequest.current.relation !== target
                    )
                      copyRequest.current = {
                        template: item.id,
                        relation: target,
                        id: crypto.randomUUID(),
                      };
                    const copied = await api<{ id: string }>(
                      `/workspace-templates/${item.id}/copy`,
                      "POST",
                      {
                        relationship_id: target,
                        client_id: copyRequest.current.id,
                      },
                    );
                    copyRequest.current = null;
                    openDraft(copied.id);
                  })
                }
              >
                Создать мой черновик
              </button>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
