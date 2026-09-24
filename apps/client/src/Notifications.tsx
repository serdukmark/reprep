import { useEffect, useState } from "react";
import { api, User } from "./api";
type Settings = {
  lessons: boolean;
  assignments: boolean;
  bot_started: boolean;
  delivery_enabled: boolean;
  deliveries: Record<string, number>;
  note: string;
};
export function Notifications({ user }: { user: User }) {
  const [settings, setSettings] = useState<Settings | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [changes, setChanges] = useState<
    Partial<Pick<Settings, "lessons" | "assignments">>
  >({});
  useEffect(() => {
    api<Settings>("/notifications")
      .then(setSettings)
      .catch((e) => setError(e.message));
  }, [user.id]);
  async function save() {
    if (!settings) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (Object.keys(changes).length)
        await api("/notifications", "PATCH", changes);
      setSettings(await api<Settings>("/notifications"));
      setChanges({});
      setNotice("Настройки напоминаний сохранены");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <h2>Напоминания в мессенджере</h2>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {settings && (
        <>
          <p>
            {settings.bot_started
              ? "Диалог с ботом открыт."
              : "Чтобы включить напоминания, войдите через мессенджер и отправьте боту /start."}
          </p>
          {!settings.delivery_enabled && (
            <p>
              Отправка в мессенджер сейчас выключена. Напоминания на главном
              экране доступны.
            </p>
          )}
          <label>
            <input
              type="checkbox"
              checked={settings.lessons}
              disabled={!settings.bot_started || busy}
              onChange={(e) => {
                setSettings({ ...settings, lessons: e.target.checked });
                setChanges({ ...changes, lessons: e.target.checked });
                setNotice("");
              }}
            />
            О ближайших занятиях
          </label>
          {user.role === "learner" && (
            <label>
              <input
                type="checkbox"
                checked={settings.assignments}
                disabled={!settings.bot_started || busy}
                onChange={(e) => {
                  setSettings({ ...settings, assignments: e.target.checked });
                  setChanges({ ...changes, assignments: e.target.checked });
                  setNotice("");
                }}
              />
              О сроках заданий
            </label>
          )}
          <p>{settings.note}</p>
          <button
            className="secondary"
            disabled={busy || !settings.bot_started}
            onClick={save}
          >
            Сохранить напоминания
          </button>
          {Object.keys(settings.deliveries).length > 0 && (
            <p>
              Доставка: отправлено {settings.deliveries.sent || 0}; в очереди{" "}
              {(settings.deliveries.queued || 0) +
                (settings.deliveries.sending || 0)}
              ; ошибок {settings.deliveries.failed || 0}; отменено{" "}
              {settings.deliveries.cancelled || 0}.
            </p>
          )}
        </>
      )}
    </section>
  );
}
