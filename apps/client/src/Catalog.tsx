import { ChoiceSelect } from "./ChoiceSelect";
import { useEffect, useRef, useState } from "react";
import { api, User } from "./api";
import { useUnsaved } from "./components";

type Offer = {
  visible: boolean;
  headline: string;
  description: string;
  subjects: string[];
  price_rub: number;
  duration: number;
};
type Card = Offer & { id: string; alias: string; revision: number };
type RequestItem = {
  id: string;
  subject: string;
  message: string;
  price_rub: number;
  duration: number;
  status: string;
  reply: string;
  tutor_alias: string;
  learner_alias: string;
};
const blank: Offer = {
  visible: false,
  headline: "",
  description: "",
  subjects: [],
  price_rub: 500,
  duration: 60,
};
export function Catalog({
  user,
  onChanged,
}: {
  user: User;
  onChanged: () => Promise<void>;
}) {
  const [offer, setOffer] = useState<Offer>(blank),
    [revision, setRevision] = useState(0),
    [loaded, setLoaded] = useState(false);
  const original = useRef(JSON.stringify(blank));
  const [items, setItems] = useState<Card[]>([]),
    [requests, setRequests] = useState<RequestItem[]>([]),
    [q, setQ] = useState(""),
    [price, setPrice] = useState(100000);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(""),
    [subject, setSubject] = useState(""),
    [message, setMessage] = useState(""),
    [replies, setReplies] = useState<Record<string, string>>({});
  const requestRef = useRef<{ payload: string; id: string } | null>(null),
    accepted = useRef("");
  useUnsaved(
    user.role === "tutor" &&
      loaded &&
      JSON.stringify(offer) !== original.current,
  );
  useEffect(() => {
    if (user.role !== "tutor") return;
    api<{ revision: number; offer: Offer | null }>("/catalog/profile")
      .then((value) => {
        const data = value.offer || blank;
        setOffer(data);
        original.current = JSON.stringify(data);
        setRevision(value.revision);
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, [user.id]);
  async function load() {
    const catalog = await api<{ items: Card[] }>(
      `/catalog?q=${encodeURIComponent(q)}&max_price=${price}`,
    );
    setItems(catalog.items);
    const incoming = await api<RequestItem[]>("/catalog/requests");
    setRequests(incoming);
    const ids = incoming
      .filter((item) => item.status === "accepted")
      .map((item) => item.id)
      .join(",");
    if (ids !== accepted.current) {
      accepted.current = ids;
      await onChanged();
    }
  }
  useEffect(() => {
    const timer = setTimeout(
      () => load().catch((e) => setError(e.message)),
      300,
    );
    const poll = setInterval(
      () => load().catch((e) => setError(e.message)),
      5000,
    );
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
    };
  }, [q, price, user.id]);
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
    <>
      <div className="page-heading">
        <div>
          <h1>Каталог репетиторов</h1>
          <p>
            Поиск по предмету и заявленной стоимости. Анкеты заполняют
            преподаватели; рейтинг качества не присваивается.
          </p>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {user.role === "tutor" && (
        <section className="card">
          <h2>Моя анкета</h2>
          {!loaded ? (
            <p>Загружаем анкету…</p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  const saved = await api<{ revision: number }>(
                    "/catalog/profile",
                    "PUT",
                    { ...offer, revision },
                  );
                  setRevision(saved.revision);
                  original.current = JSON.stringify(offer);
                  setNotice("Анкета сохранена");
                });
              }}
            >
              <label>
                Заголовок анкеты
                <input
                  required
                  minLength={3}
                  maxLength={120}
                  value={offer.headline}
                  onChange={(e) =>
                    setOffer({ ...offer, headline: e.target.value })
                  }
                />
              </label>
              <label>
                О занятиях
                <textarea
                  required
                  minLength={10}
                  maxLength={1200}
                  value={offer.description}
                  onChange={(e) =>
                    setOffer({ ...offer, description: e.target.value })
                  }
                />
              </label>
              <label>
                Предметы анкеты (каждый с новой строки)
                <textarea
                  required
                  value={offer.subjects.join("\n")}
                  onChange={(e) =>
                    setOffer({ ...offer, subjects: e.target.value.split("\n") })
                  }
                />
              </label>
              <div className="form-grid">
                <label>
                  Стоимость занятия, руб.
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    required
                    value={offer.price_rub}
                    onChange={(e) =>
                      setOffer({ ...offer, price_rub: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Длительность занятия, минут
                  <input
                    type="number"
                    min={15}
                    max={240}
                    required
                    value={offer.duration}
                    onChange={(e) =>
                      setOffer({ ...offer, duration: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={offer.visible}
                  onChange={(e) =>
                    setOffer({ ...offer, visible: e.target.checked })
                  }
                />
                Показывать мою анкету в каталоге
              </label>
              <button className="primary" disabled={busy}>
                Сохранить анкету
              </button>
            </form>
          )}
        </section>
      )}
      <section className="card">
        <h2>Найти преподавателя</h2>
        <div className="form-grid">
          <label>
            Предмет или имя
            <input
              maxLength={100}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <label>
            Максимальная цена, руб.
            <input
              type="number"
              min={0}
              max={100000}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </label>
        </div>
        {!items.length && <p>Подходящих анкет пока нет.</p>}
        {items.map((item) => (
          <article className="card" key={item.id}>
            <h3>{item.headline}</h3>
            <p>
              <strong>{item.alias}</strong> · {item.subjects.join(" · ")}
            </p>
            <p>{item.description}</p>
            <p>
              {item.price_rub} руб. за {item.duration} мин. Оплата через
              приложение не проводится.
            </p>
            {user.role === "learner" && (
              <button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  setSelected(item.id);
                  setSubject(item.subjects[0]);
                  setMessage("");
                  setNotice("");
                }}
              >
                Оставить заявку
              </button>
            )}
            {selected === item.id && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    const payload = JSON.stringify({
                      selected,
                      offer_revision: item.revision,
                      subject,
                      message,
                    });
                    if (requestRef.current?.payload !== payload)
                      requestRef.current = { payload, id: crypto.randomUUID() };
                    await api(`/catalog/${selected}/requests`, "POST", {
                      subject,
                      message,
                      client_id: requestRef.current.id,
                      offer_revision: item.revision,
                    });
                    requestRef.current = null;
                    setSelected("");
                    setMessage("");
                    setNotice(
                      "Заявка сохранена. Решение преподавателя появится здесь.",
                    );
                  });
                }}
              >
                <label>
                  Предмет заявки
                  <ChoiceSelect
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  >
                    {item.subjects.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </ChoiceSelect>
                </label>
                <label>
                  Что хотите изучать
                  <textarea
                    required
                    minLength={3}
                    maxLength={1000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </label>
                <button className="primary" disabled={busy}>
                  Отправить заявку
                </button>
              </form>
            )}
          </article>
        ))}
      </section>
      <section className="card">
        <h2>{user.role === "tutor" ? "Заявки учеников" : "Мои заявки"}</h2>
        {!requests.length && <p>Заявок пока нет.</p>}
        {requests.map((item) => (
          <article className="card" key={item.id}>
            <h3>
              {item.subject} ·{" "}
              {user.role === "tutor" ? item.learner_alias : item.tutor_alias}
            </h3>
            <p>{item.message}</p>
            <p>
              Цена в момент заявки: {item.price_rub} руб. / {item.duration} мин.
            </p>
            <p>
              {item.status === "accepted"
                ? "Преподаватель принял заявку. Учебная связь создана."
                : item.status === "declined"
                  ? "Преподаватель отклонил заявку."
                  : "Ожидает решения преподавателя"}
            </p>
            {item.reply && <p>Ответ преподавателя: {item.reply}</p>}
            {user.role === "tutor" && item.status === "pending" && (
              <>
                <label>
                  Ответ на заявку
                  <textarea
                    maxLength={1000}
                    value={replies[item.id] || ""}
                    onChange={(e) =>
                      setReplies({ ...replies, [item.id]: e.target.value })
                    }
                  />
                </label>
                <div className="form-actions">
                  {["accepted", "declined"].map((decision) => (
                    <button
                      className="secondary"
                      key={decision}
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await api(
                            `/catalog/requests/${item.id}/review`,
                            "POST",
                            { decision, reply: replies[item.id] || "" },
                          );
                          await onChanged();
                        })
                      }
                    >
                      {decision === "accepted"
                        ? "Принять ученика"
                        : "Отклонить заявку"}
                    </button>
                  ))}
                </div>
              </>
            )}
          </article>
        ))}
      </section>
    </>
  );
}
