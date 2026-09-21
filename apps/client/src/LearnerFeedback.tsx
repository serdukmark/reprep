import { useState } from "react";
import { api } from "./api";
export function LearnerFeedback({ assignment }: { assignment: string }) {
  const [category, setCategory] = useState("useful"),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  return (
    <section className="card">
      <h2>Обратная связь о разборе</h2>
      <p>
        Оцените полезность или сообщите о неверном либо вредном объяснении.
        Сообщение сохраняется для разбора командой; это не срочный канал помощи.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setNotice("");
          try {
            await api("/reports", "POST", {
              context_id: assignment,
              category,
              text,
            });
            setNotice("Сообщение сохранено для разбора командой");
            setText("");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Тип отзыва
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="useful">Разбор помог</option>
            <option value="incorrect_feedback">Есть ошибка</option>
            <option value="harmful_feedback">Вредный ответ</option>
            <option value="bug">Техническая проблема</option>
          </select>
        </label>
        <label>
          Комментарий к разбору
          <textarea
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <button className="secondary" disabled={busy}>
          Отправить отзыв о разборе
        </button>
      </form>
    </section>
  );
}
