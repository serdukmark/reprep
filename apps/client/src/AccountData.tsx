import { useEffect, useState } from "react";
import { api, downloadOwnData, User } from "./api";

type State = {
  request: { id: string; status: string; created: string } | null;
  note: string;
};
export function AccountData({ user }: { user: User }) {
  const [state, setState] = useState<State | null>(null),
    [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function load() {
    setState(await api<State>("/account/deletion"));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [user.id]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
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
      <h2>Мои данные</h2>
      <p>
        Экспорт JSON включает профиль, доступные работы и историю попыток.
        Секреты авторизации в него не входят.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <button
        className="secondary"
        disabled={busy}
        onClick={() =>
          run(async () => {
            await downloadOwnData();
            setNotice("Файл экспорта передан браузеру");
          })
        }
      >
        Скачать мои данные
      </button>
      {state && (
        <>
          <p>{state.note}</p>
          {state.request?.status === "requested" ? (
            <>
              <p>Запрос на удаление ожидает обработки владельцем.</p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api("/account/deletion/cancel", "POST");
                    setNotice("Запрос отменён");
                  })
                }
              >
                Отменить запрос на удаление
              </button>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await api("/account/deletion", "POST", {
                    confirm_alias: confirm,
                  });
                  setConfirm("");
                });
              }}
            >
              <p>
                Чтобы запросить удаление, введите текущее имя:{" "}
                <strong>{user.alias}</strong>. Запрос можно отменить до
                обработки.
              </p>
              <label>
                Имя для запроса удаления
                <input
                  required
                  maxLength={60}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
              <button
                className="secondary"
                disabled={busy || confirm !== user.alias}
              >
                Запросить удаление аккаунта
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
