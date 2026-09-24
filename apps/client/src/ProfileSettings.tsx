import { useState } from "react";
import { api, User } from "./api";
import { useUnsaved } from "./components";

export function ProfileSettings({ user, busy, action, saved }: {
  user: User;
  busy: boolean;
  action: (fn: () => Promise<void>) => Promise<void>;
  saved: (user: User) => void;
}) {
  const [name, setName] = useState(user.alias);
  useUnsaved(name !== user.alias);
  return <form className="card" onSubmit={(event) => {
    event.preventDefault();
    void action(async () => {
      const updated = await api<User>("/profile", "PUT", { alias: name });
      setName(updated.alias);
      saved(updated);
    });
  }}>
    <fieldset disabled={busy} className="form-fields">
      <label>Отображаемое имя
        <input name="alias" value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} />
      </label>
      <button className="secondary">Сохранить имя</button>
    </fieldset>
  </form>;
}
