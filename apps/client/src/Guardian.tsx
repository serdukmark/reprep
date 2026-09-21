import { useEffect, useState } from "react";
import { api, date, labels, Relation, User } from "./api";

type Access = {
  id: string;
  state: string;
  alias: string | null;
  expires: number;
};
export function GuardianInvites({ relation }: { relation: string }) {
  const [items, setItems] = useState<Access[]>([]),
    [code, setCode] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load() {
    setItems(await api<Access[]>(`/relationships/${relation}/guardians`));
  }
  useEffect(() => {
    setCode("");
    setError("");
    load().catch((e) => setError(e.message));
  }, [relation]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <h2>Доступ родителя</h2>
      <p>
        Только подтверждённый прогресс и расписание этого ученика. Передайте код
        согласованному взрослому. В реальном пилоте требуется утверждённый
        порядок доступа.
      </p>
      {error && <p role="alert">{error}</p>}
      <button
        className="secondary"
        disabled={busy}
        onClick={() =>
          run(async () => {
            const value = await api<{ token: string }>(
              `/relationships/${relation}/guardians`,
              "POST",
            );
            setCode(value.token);
          })
        }
      >
        Создать приглашение родителю
      </button>
      {code && (
        <label>
          Код родителя
          <input readOnly value={code} />
        </label>
      )}
      {items.map((item) => (
        <div key={item.id} className="form-actions">
          <span>
            {item.alias || "Приглашение"} ·{" "}
            {item.state === "accepted"
              ? "Доступ открыт"
              : item.state === "revoked"
                ? "Отозвано"
                : item.expires * 1000 < Date.now()
                  ? "Истекло"
                  : "Ожидает принятия"}
          </span>
          {item.state !== "revoked" && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api(`/guardian/invitations/${item.id}/revoke`, "POST");
                  setCode("");
                })
              }
            >
              Отозвать доступ родителя
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

type Summary = {
  progress: { skill: string; correct: number; total: number; latest: string }[];
  lessons: {
    id: string;
    title: string;
    starts_at: string;
    duration: number;
    status: string;
  }[];
  note: string;
};
export function GuardianPortal({
  user,
  logout,
}: {
  user: User;
  logout: () => Promise<void>;
}) {
  const [links, setLinks] = useState<Relation[]>([]),
    [selected, setSelected] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null),
    [code, setCode] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load() {
    const items = await api<Relation[]>("/guardian/links");
    setLinks(items);
    setError("");
    if (selected && !items.some((item) => item.id === selected)) {
      setSelected("");
      setSummary(null);
    } else if (selected)
      setSummary(await api<Summary>(`/guardian/links/${selected}`));
  }
  useEffect(() => {
    let live = true;
    const refresh = () =>
      load().catch((e) => {
        if (live) {
          setError(e.message);
          setSummary(null);
        }
      });
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [selected]);
  async function accept() {
    setBusy(true);
    setError("");
    try {
      await api("/guardian/accept", "POST", { token: code.trim() });
      setCode("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      className="guardian-portal"
      style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}
    >
      <div className="page-heading">
        <div>
          <div className="brand">reprep ↗</div>
          <h1>Кабинет родителя</h1>
          <p>
            {user.alias}
            {user.demo && " · ДЕМО · СИНТЕТИЧЕСКИЕ ДАННЫЕ"}
          </p>
        </div>
        <button className="secondary" onClick={logout}>
          Выйти
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <section className="card">
        <h2>Принять приглашение преподавателя</h2>
        <label>
          Код приглашения родителю
          <input
            value={code}
            maxLength={200}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        <button
          className="primary"
          disabled={busy || !code.trim()}
          onClick={accept}
        >
          Принять доступ
        </button>
      </section>
      {!links.length && (
        <p>
          Открытых доступов нет. Преподаватель может выдать отдельное
          приглашение.
        </p>
      )}
      <div className="filters">
        {links.map((item) => (
          <button
            className="secondary"
            key={item.id}
            onClick={() => {
              setSummary(null);
              setSelected(item.id);
              setError("");
            }}
          >
            {item.learner_alias} · {item.subject}
          </button>
        ))}
      </div>
      {selected && !summary && <p role="status">Проверяем доступ…</p>}
      {summary && (
        <>
          <p>{summary.note}</p>
          <section className="card">
            <h2>Подтверждённый прогресс</h2>
            {!summary.progress.length && (
              <p>Проверенных результатов пока нет.</p>
            )}
            {summary.progress.map((item) => (
              <p key={item.skill}>
                <strong>{item.skill}</strong> · Верных: {item.correct} из{" "}
                {item.total} · Последний результат:{" "}
                {labels[item.latest] || item.latest}
              </p>
            ))}
          </section>
          <section className="card">
            <h2>Расписание ученика</h2>
            {!summary.lessons.length && <p>Занятий пока нет.</p>}
            {summary.lessons.map((item) => (
              <p key={item.id}>
                <strong>{item.title}</strong> · {date(item.starts_at)} ·{" "}
                {item.duration} мин ·{" "}
                {item.status === "cancelled"
                  ? "Отменено"
                  : item.status === "completed"
                    ? "Проведено"
                    : "Запланировано"}
              </p>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
