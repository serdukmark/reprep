import { ProfileSettings } from "./ProfileSettings";
import { ChoiceSelect } from "./ChoiceSelect";
import React, { useState, useEffect, useRef } from "react";
import { initializeMax, launchData, bindMaxBack, inTelegram, inMax, platformName } from "./max";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Plus,
  BookOpen,
  Users,
  LayoutDashboard,
  CalendarDays,
  FolderOpen,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  LogOut,
  ShieldCheck,
  Sparkles,
  CheckCheck,
  RotateCcw,
  Download,
  Search,
  Menu,
  X,
  GraduationCap,
} from "lucide-react";
import {
  api,
  setToken,
  date,
  User,
  Relation,
  Assignment,
  AssignmentSummary,
  Skill,
  Lesson,
  Material,
} from "./api";
import { Badge, Empty, mayLeave } from "./components";
import { Builder, AssignmentDetail, blankAssignment } from "./Assignment";
import { Collection } from "./Collection";
import "./style.css";
import { Reminders, CalendarDownload } from "./Reminders";
import { Groups } from "./Groups";
import { Notifications } from "./Notifications";
import { AccountData } from "./AccountData";
import { SkillGraph } from "./SkillGraph";
import { Catalog } from "./Catalog";
import { Workspaces } from "./Workspaces";
import { GuardianInvites, GuardianPortal } from "./Guardian";
import { LearningPlan } from "./LearningPlan";
import { Analytics, Recommendations } from "./Insights";
type Page =
  | "today"
  | "assignments"
  | "learners"
  | "progress"
  | "schedule"
  | "materials"
  | "catalog"
  | "settings";
type Config = {
  demo_enabled: boolean;
  max_enabled: boolean;
  telegram_enabled: boolean;
  assessment: string;
};
function App() {
  const duplicateRequest = useRef<{source: string; client_id: string} | null>(null);
  const [config, setConfig] = useState<Config | null>(null),
    [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true);
  const [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState<Page>("today");
  const [relations, setRelations] = useState<Relation[]>([]),
    [assignments, setAssignments] = useState<AssignmentSummary[]>([]),
    [lessons, setLessons] = useState<Lesson[]>([]),
    [materials, setMaterials] = useState<Material[]>([]);
  const [active, setActive] = useState<Assignment | null>(null),
    [editing, setEditing] = useState(false),
    [selected, setSelected] = useState(""),
    [skills, setSkills] = useState<Skill[]>([]),
    [search, setSearch] = useState(""),
    [workFilter, setWorkFilter] = useState("all"),
    [mobile, setMobile] = useState(false);
  const [invite, setInvite] = useState(""),
    [inviteInput, setInviteInput] = useState(""),
    [invites, setInvites] = useState<
      { id: string; subject: string; state: string }[]
    >([]);
  const [invitePreview, setInvitePreview] = useState<{
    tutor_alias: string;
    subject: string;
    expires: number;
  } | null>(null);
  const [alias, setAlias] = useState(""),
    [role, setRole] = useState<"tutor" | "learner" | "guardian">("tutor");
  const workLoad = useRef(0);
  // Capture the displayed view now, before a child starts an asynchronous mutation.
  const activeView = workLoad.current;
  async function openDraft(id: string) {
    // The child may finish creating a draft after its original screen is gone.
    if (activeView !== workLoad.current) return;
    await open(id, true);
  }
  function showAssignment(next: Assignment | null) {
    workLoad.current++;
    setActive(next);
  }
  const isTutor = user?.role === "tutor";
  async function refresh() {
    const [r, a, l, m] = await Promise.all([
      api<Relation[]>("/relationships"),
      api<AssignmentSummary[]>("/assignments"),
      api<Lesson[]>("/lessons"),
      api<Material[]>("/materials"),
    ]);
    setRelations(r);
    setAssignments(a);
    setLessons(l);
    setMaterials(m);
    setSelected((old) => (r.some((x) => x.id === old) ? old : r[0]?.id || ""));
  }
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    Promise.all([
      api<Config>("/config")
        .then(setConfig)
        .catch((e) => setError(e.message)),
      api<User>("/me")
        .then(setUser)
        .catch(() => {}),
    ]).finally(() => setLoading(false));
    const p = new URLSearchParams(location.hash.slice(1));
    if (p.get("invite")) setInviteInput(p.get("invite")!);
  }, []);
  useEffect(() => {
    if (user && user.role !== "guardian") action(refresh);
  }, [user?.id]);
  useEffect(() => {
    if (!selected || !user || user.role === "guardian") return;
    let progressLive = true;
    setSkills([]);
    api<Skill[]>("/relationships/" + selected + "/progress")
      .then((value) => {
        if (progressLive) setSkills(value);
      })
      .catch((e) => {
        if (progressLive) setError(e.message);
      });
    return () => {
      progressLive = false;
    };
  }, [selected, page, assignments]);
  useEffect(() => {
    if (page === "learners" && isTutor)
      api<typeof invites>("/invitations")
        .then(setInvites)
        .catch((e) => setError(e.message));
  }, [page, invite, user]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  async function open(id: string, asDraft = false) {
    if (!mayLeave()) return;
    const revision = ++workLoad.current;
    await action(async () => {
      try {
        const assignment = await api<Assignment>("/assignments/" + id);
        if (revision !== workLoad.current) return;
        showAssignment(assignment);
        setEditing(asDraft);
        if (asDraft) await refresh();
      } catch (e) {
        if (revision === workLoad.current) throw e;
      }
    });
  }
  useEffect(() => {
    if (
      !active?.submission ||
      ![
        "queued",
        "processing",
        ...(!isTutor ? ["awaiting_review"] : ["returned"]),
      ].includes(active.submission.status)
    )
      return;
    const id = active.id;
    const interval = setInterval(
      () =>
        api<Assignment>("/assignments/" + id)
          .then((a) => {
            setActive((old) => (old?.id === id ? a : old));
            if (
              a.submission?.status !== active.submission?.status &&
              ["reviewed", "returned"].includes(a.submission?.status || "")
            )
              return refresh();
          })
          .catch((e) => setError(e.message)),
      ["awaiting_review", "returned"].includes(active.submission.status)
        ? 5000
        : 2000,
    );
    return () => clearInterval(interval);
  }, [active?.id, active?.submission?.status]);
  async function login(persona: string) {
    await action(async () => {
      const data = await api<{ token: string; user: User }>(
        "/auth/demo/" + persona,
        "POST",
      );
      setToken(data.token);
      setUser(data.user);
      showAssignment(null);
      setPage("today");
    });
  }
  async function logout() {
    if (!mayLeave()) return;
    await action(async () => {
      await api("/logout", "POST");
      setToken("");
      setUser(null);
      showAssignment(null);
      setAssignments([]);
      setRelations([]);
      setLessons([]);
      setMaterials([]);
      setSelected("");
      setInvites([]);
      setInvitePreview(null);
      setWorkFilter("all");
      setSearch("");
      setSkills([]);
      setInvite("");
      // Root-level form buffers survive child unmounts, so clear them at logout too.
      setInviteInput("");
      setAlias("");
      setRole("tutor");
      setToast("");
      setEditing(false);
      setMobile(false);
      setPage("today");
      duplicateRequest.current = null;
    });
  }
  function navigate(p: Page) {
    if (!mayLeave()) return;
    setPage(p);
    showAssignment(null);
    setEditing(false);
    setMobile(false);
    setSearch("");
    setError("");
  }
  async function createInvite() {
    await action(async () => {
      const r = await api<{ token: string }>("/invitations", "POST", {
        subject:
          relations.find((r) => r.id === selected)?.subject || "Математика",
      });
      setInvite(r.token);
    });
  }
  async function saveAssignment(a: Assignment, publish: boolean) {
    const saveView = workLoad.current;
    await action(async () => {
      const body = {
        client_id: a.client_id || "",
        relationship_id: a.relationship_id,
        title: a.title,
        instructions: a.instructions,
        lesson_id: a.lesson_id || "",
        due_at: a.due_at,
        feedback_policy: a.feedback_policy,
        tasks: a.tasks,
      };
      const saved = await api<Assignment>(
        a.id
          ? "/assignments/" + a.id + "?revision=" + a.revision
          : "/assignments",
        a.id ? "PUT" : "POST",
        body,
      );
      if (publish) await api("/assignments/" + saved.id + "/publish", "POST");
      const savedAssignment = await api<Assignment>("/assignments/" + saved.id);
      if (saveView === workLoad.current) {
        showAssignment(savedAssignment);
        setEditing(false);
      }
      await refresh();
      setToast(publish ? "Работа назначена ученику" : "Черновик сохранён");
    });
  }
  useEffect(
    () =>
      bindMaxBack(
        active
          ? () => {
              if (!mayLeave()) return;
              showAssignment(null);
              setEditing(false);
              action(refresh);
            }
          : page !== "today"
            ? () => navigate("today")
            : null,
      ),
    [active?.id, page],
  );
  const pending = assignments.filter(
    (a) =>
      a.submission &&
      ["awaiting_review", "processing", "queued"].includes(a.submission.status),
  );
  const assigned = assignments.filter(
    (a) =>
      a.status === "published" &&
      (!a.submission || a.submission.status === "returned"),
  );
  const nextLesson = lessons
    .filter(
      (l) => (l.status ?? "scheduled") === "scheduled" && new Date(l.starts_at) > new Date(),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const nav = [
    { id: "today", label: "Сегодня", icon: LayoutDashboard },
    { id: "assignments", label: "Задания", icon: BookOpen },
    {
      id: isTutor ? "learners" : "progress",
      label: isTutor ? "Ученики" : "Мой прогресс",
      icon: isTutor ? Users : ChartNoAxesCombined,
    },
    { id: "schedule", label: "Расписание", icon: CalendarDays },
    { id: "materials", label: "Материалы", icon: FolderOpen },
    { id: "catalog", label: "Репетиторы", icon: Users },
  ] as const;
  if (loading)
    return (
      <div className="boot">
        reprep<span>Открываем пространство…</span>
      </div>
    );
  if (!user)
    return (
      <main className="login">
        <div className="login-copy">
          <div className="brand">
            reprep<span>↗</span>
          </div>
          <div className="eyebrow">ПРОСТРАНСТВО ДЛЯ РЕПЕТИТОРА И УЧЕНИКА</div>
          <h1>
            Меньше рутины.
            <br />
            <em>Больше понимания.</em>
          </h1>
          <p>
            Задания, обратная связь и прогресс — в одном учебном пространстве. С
            поддержкой AI и решающим словом преподавателя.
          </p>
          <div className="login-flow">
            <span>01 / Задание</span>
            <ArrowRight />
            <span>02 / Разбор</span>
            <ArrowRight />
            <span>03 / Прогресс</span>
          </div>
          <div className="paper-preview">
            <span className="eyebrow">МАЛЕНЬКИЕ ШАГИ. ЗАМЕТНЫЙ РЕЗУЛЬТАТ.</span>
            <h2>
              Не просто проверить ответ.
              <br />
              Помочь понять ошибку.
            </h2>
            <span className="floating-check">
              <CheckCheck />
            </span>
          </div>
        </div>
        <section className="login-panel">
          <div className="login-symbol">
            <GraduationCap size={34} />
          </div>
          <h2>Ваше учебное пространство</h2>
          <p>{config?.demo_enabled
            ? "Начните с демонстрации или откройте приложение в мессенджере."
            : "Откройте приложение в мессенджере."}</p>
          {config?.demo_enabled && (
            <>
              <div className="notice">
                Демо на вымышленных данных. Не вводите персональные данные
                учеников.
              </div>
              <button
                className="primary full"
                disabled={busy}
                onClick={() => login("tutor")}
              >
                Я преподаватель <ArrowRight size={18} />
              </button>
              <button
                className="secondary full"
                disabled={busy}
                onClick={() => login("learner")}
              >
                Я ученик <ArrowRight size={18} />
              </button>
              <button
                className="secondary full"
                disabled={busy}
                onClick={() => login("guardian")}
              >
                Я родитель <ArrowRight size={18} />
              </button>
              <button
                className="text-button full"
                disabled={busy}
                onClick={() => login("outsider")}
              >
                Другой преподаватель · демо
              </button>
            </>
          )}
          {((inTelegram && config?.telegram_enabled) || (inMax && config?.max_enabled)) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                action(async () => {
                  const data = await api<{ token: string; user: User }>(
                    inTelegram ? "/auth/telegram" : "/auth/max",
                    "POST",
                    {
                      init_data: launchData(),
                      role,
                      alias: alias || "Участник",
                    },
                  );
                  setToken(data.token);
                  setUser(data.user);
                  history.replaceState(null, "", location.pathname + (inTelegram ? "?platform=telegram" : ""));
                });
              }}
            >
              <label>
                Как к вам обращаться
                <input
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  maxLength={60}
                />
              </label>
              <fieldset className="registration-roles" disabled={busy}>
                <legend>Как вы будете пользоваться RePrep?</legend>
                {([
                  { value: "tutor", title: "Преподаватель", description: "Назначать задания и помогать ученикам", icon: BookOpen },
                  { value: "learner", title: "Ученик", description: "Решать задания и видеть свой прогресс", icon: GraduationCap },
                  { value: "guardian", title: "Родитель", description: "Следить за обучением ребёнка", icon: Users },
                ] as const).map(({ value, title, description, icon: Icon }) => (
                  <label className="registration-role" key={value}>
                    <input
                      type="radio"
                      name="registration-role"
                      value={value}
                      checked={role === value}
                      onChange={() => setRole(value)}
                    />
                    <span className="registration-role-card">
                      <span className="registration-role-icon"><Icon size={22} aria-hidden="true" /></span>
                      <span className="registration-role-copy">
                        <strong>{title}</strong>
                        <span>{description}</span>
                      </span>
                      <span className="registration-role-check" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <button className="primary full" disabled={busy}>
                Войти через {platformName}
              </button>
            </form>
          )}
          {!config?.demo_enabled && !config?.max_enabled && !config?.telegram_enabled && (
            <div className="notice">
              Вход ещё не настроен. Администратору нужно подключить MAX.
            </div>
          )}
          {!inMax && !inTelegram && <div className="notice">
            {config?.telegram_enabled && <p><a href="https://t.me/MaxFuckYouBot?startapp">Открыть RePrep в Telegram</a></p>}
            {config?.max_enabled && <p><a href="https://max.ru/t792_hakaton_max_bot">Открыть RePrep в MAX</a></p>}
          </div>}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div className="privacy">
            <ShieldCheck size={16} /> Преподаватель контролирует результаты
            проверки
          </div>
        </section>
      </main>
    );
  if (user.role === "guardian")
    return <GuardianPortal user={user} logout={logout} />;
  function workState(a: AssignmentSummary) {
    if (a.status === "draft") return "draft";
    if (a.submission?.status === "reviewed") return "completed";
    if (
      (!a.submission || a.submission.status === "returned") &&
      a.due_at &&
      new Date(a.due_at).getTime() < Date.now()
    )
      return "overdue";
    return "active";
  }
  function AssignmentRows({ items }: { items: AssignmentSummary[] }) {
    return (
      <div className="assignment-list">
        {!items.length && <p>По выбранным условиям работ нет.</p>}
        {items.map((a) => (
          <button
            key={a.id}
            className="assignment-row"
            onClick={() => open(a.id)}
          >
            <div className="assignment-icon">
              <BookOpen size={20} />
            </div>
            <div className="row-main">
              <strong>{a.title}</strong>
              <span>
                {isTutor ? a.learner_alias + " · " : ""}
                {a.tasks_count} задания · {date(a.due_at)}
              </span>
            </div>
            <Badge
              state={
                workState(a) === "overdue"
                  ? "overdue"
                  : a.submission?.status || a.status
              }
            />
            <ChevronRight size={18} />
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="shell">
      <aside className={"sidebar " + (mobile ? "visible" : "")}>
        <button className="brand" onClick={() => navigate("today")}>
          reprep<span>↗</span>
        </button>
        <div className="workspace">
          <div className="avatar">{user.alias[0]}</div>
          <div>
            <strong>{isTutor ? "Моё пространство" : "Моё обучение"}</strong>
            <small>
              {isTutor ? "Кабинет преподавателя" : "Кабинет ученика"}
            </small>
          </div>
        </div>
        <span className="nav-caption">ОБУЧЕНИЕ</span>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={page === n.id && !active ? "selected" : ""}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={19} />
              {n.label}
              {n.id === "assignments" && pending.length > 0 && (
                <span className="nav-count">{pending.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="context-note">
            <Sparkles size={20} />
            <strong>AI помогает. Вы решаете.</strong>
            <p>Каждый вывод можно проверить и исправить.</p>
          </div>
          <button className="account" onClick={() => navigate("settings")}>
            <div className="avatar small">{user.alias[0]}</div>
            <span>
              {user.alias}
              <small>
                {user.demo ? "Демонстрационный аккаунт" : `Аккаунт ${platformName}`}
              </small>
            </span>
            <ChevronRight size={15} />
          </button>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label="Открыть меню"
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? <X /> : <Menu />}
          </button>
          <span>Ваше пространство для роста</span>
          <div>
            {user.demo && (
              <span className="demo-label">ДЕМО · СИНТЕТИЧЕСКИЕ ДАННЫЕ</span>
            )}
            <span className="today-date">
              {new Date().toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
              })}
            </span>
          </div>
        </header>
        <main className="content">
          {error && (
            <div className="error" role="alert">
              {error}
              <button aria-label="Закрыть ошибку" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {toast && (
            <div className="toast" role="status">
              <Check size={18} />
              {toast}
            </div>
          )}
          {active ? (
            <>
              <button
                className="back"
                onClick={() => {
                  if (!mayLeave()) return;
                  showAssignment(null);
                  setEditing(false);
                  setPage("assignments");
                  refresh();
                }}
              >
                <ArrowLeft size={16} /> К заданиям
              </button>
              {editing || !active.id ? (
                <Builder
                  key={active.id || "new"}
                  initial={active}
                  relations={relations}
                  busy={busy}
                  save={saveAssignment}
                />
              ) : (
                <AssignmentDetail
                  key={active.id}
                  assignment={active}
                  isTutor={!!isTutor}
                  busy={busy}
                  action={action}
                  update={async () => {
                    const updated = await api<Assignment>("/assignments/" + active.id);
                    if (activeView === workLoad.current) showAssignment(updated);
                    await refresh();
                  }}
                  edit={() => setEditing(true)}
                  duplicate={() =>
                    action(async () => {
                      const duplicateView = workLoad.current;
                      if (duplicateRequest.current?.source !== active.id)
                        duplicateRequest.current = {source: active.id, client_id: crypto.randomUUID()};
                      const r = await api<{ id: string }>(
                        "/assignments/" + active.id + "/duplicate",
                        "POST",
                        {client_id: duplicateRequest.current.client_id},
                      );
                      const copied = await api<Assignment>("/assignments/" + r.id);
                      duplicateRequest.current = null;
                      if (duplicateView === workLoad.current) {
                        showAssignment(copied);
                        setEditing(true);
                      }
                      await refresh();
                    })
                  }
                />
              )}
            </>
          ) : (
            <>
              {page === "today" && (
                <>
                  <Reminders open={open} />
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">КАЖДЫЙ ШАГ ИМЕЕТ ЗНАЧЕНИЕ</div>
                      <h1>
                        {isTutor
                          ? "Хороший день, чтобы учить."
                          : "Ваш следующий шаг."}
                      </h1>
                      <p>
                        {isTutor
                          ? "Всё важное для занятий — перед вами."
                          : "Продолжайте в своём темпе. Преподаватель рядом."}
                      </p>
                    </div>
                    {isTutor && (
                      <button
                        className="primary"
                        onClick={() => showAssignment(blankAssignment(selected))}
                      >
                        <Plus size={18} /> Создать задание
                      </button>
                    )}
                  </div>
                  <div className="dashboard-grid">
                    <section className="hero-card">
                      <div className="eyebrow">
                        {isTutor ? "ФОКУС НА СЕГОДНЯ" : "ВАШЕ ОБУЧЕНИЕ"}
                      </div>
                      <h2>
                        {isTutor
                          ? pending.length
                            ? "Обратная связь,\nкоторая помогает расти."
                            : "Новый шаг начинается\nс хорошего задания."
                          : assigned.length
                            ? "Пора попробовать\nи разобраться."
                            : "Хорошая работа.\nПосмотрите обратную связь."}
                      </h2>
                      <p>
                        {isTutor
                          ? "Откройте работу ученика, посмотрите разбор и добавьте то, что важно именно ему."
                          : "Сохраняйте ответы, задавайте себе вопросы и двигайтесь к пониманию."}
                      </p>
                      <button
                        className="dark"
                        onClick={() =>
                          pending[0]
                            ? open(pending[0].id)
                            : assigned[0]
                              ? open(assigned[0].id)
                              : navigate("assignments")
                        }
                      >
                        {pending.length
                          ? "Открыть проверку"
                          : "Перейти к заданиям"}
                        <ArrowUpRight size={18} />
                      </button>
                      <div className="hero-art" aria-hidden="true">
                        <div className="art-page">
                          <span>f(x)</span>
                          <div />
                          <div />
                          <div />
                          <b>✓</b>
                        </div>
                        <span className="orbit">✳</span>
                      </div>
                    </section>
                    <section className="today-card">
                      <div className="section-head">
                        <h3>Ближайшее занятие</h3>
                        <CalendarDays size={18} />
                      </div>
                      {nextLesson ? (
                        <>
                          <div className="lesson-time">
                            {new Date(nextLesson.starts_at).toLocaleTimeString(
                              "ru-RU",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                            <small>
                              {date(nextLesson.starts_at)} ·{" "}
                              {nextLesson.duration} мин
                            </small>
                          </div>
                          <h3>{nextLesson.title}</h3>
                          <p>
                            {
                              relations.find(
                                (r) => r.id === nextLesson.relationship_id,
                              )?.[isTutor ? "learner_alias" : "tutor_alias"]
                            }
                          </p>
                          <button
                            className="text-button"
                            onClick={() => navigate("schedule")}
                          >
                            Открыть расписание <ArrowRight size={16} />
                          </button>
                        </>
                      ) : (
                        <Empty
                          title="Пока свободно"
                          text="Здесь появится ближайшее занятие."
                        />
                      )}
                    </section>
                  </div>
                  <div className="stats">
                    <div>
                      <span>Ждут проверки</span>
                      <strong>
                        {pending.length.toString().padStart(2, "0")}
                      </strong>
                      <small>Работы с сохранёнными ответами</small>
                    </div>
                    <div>
                      <span>В процессе</span>
                      <strong>
                        {assigned.length.toString().padStart(2, "0")}
                      </strong>
                      <small>Задания, которые ещё предстоит сдать</small>
                    </div>
                    <div>
                      <span>{isTutor ? "Ученики" : "Преподаватели"}</span>
                      <strong>
                        {relations.length.toString().padStart(2, "0")}
                      </strong>
                      <small>Активные учебные связи</small>
                    </div>
                  </div>
                  <div className="section-head">
                    <h2>
                      {isTutor ? "Работы и обратная связь" : "Мои задания"}{" "}
                      <span className="muted-count">{assignments.length}</span>
                    </h2>
                    <button
                      className="text-button"
                      onClick={() => navigate("assignments")}
                    >
                      Все задания <ArrowRight size={16} />
                    </button>
                  </div>
                  {assignments.length ? (
                    <AssignmentRows items={assignments.slice(0, 4)} />
                  ) : (
                    <Empty
                      title="Первое задание — начало истории"
                      text="Пригласите ученика и создайте работу."
                    />
                  )}
                </>
              )}
              {page === "assignments" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">ОТ ВОПРОСА К ПОНИМАНИЮ</div>
                      <h1>Задания</h1>
                      <p>Один понятный путь от назначения до обратной связи.</p>
                    </div>
                    {isTutor && (
                      <button
                        className="primary"
                        onClick={() => showAssignment(blankAssignment(selected))}
                      >
                        <Plus size={18} /> Создать задание
                      </button>
                    )}
                  </div>
                  <div className="filters">
                    <label className="search">
                      <Search size={18} />
                      <input
                        placeholder="Найти задание"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <label>
                      Статус работ
                      <ChoiceSelect
                        value={workFilter}
                        onChange={(e) => setWorkFilter(e.target.value)}
                      >
                        <option value="all">Все</option>
                        <option value="active">Активные</option>
                        <option value="overdue">Просроченные</option>
                        <option value="completed">Завершённые</option>
                        {isTutor && <option value="draft">Черновики</option>}
                      </ChoiceSelect>
                    </label>
                    <span>{assignments.length} работ всего</span>
                  </div>
                  {assignments.length ? (
                    <AssignmentRows
                      items={assignments.filter(
                        (a) =>
                          (workFilter === "all" ||
                            workState(a) === workFilter) &&
                          (a.title + a.learner_alias)
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                      )}
                    />
                  ) : (
                    <Empty
                      title="Заданий пока нет"
                      text={
                        isTutor
                          ? "Создайте первый черновик. Ученика можно выбрать перед назначением."
                          : "Преподаватель назначит вам работу. Если у вас есть приглашение, примите его в настройках."
                      }
                    />
                  )}
                </>
              )}
              {page === "catalog" && (
                <Catalog user={user} onChanged={refresh} />
              )}
              {page === "schedule" && <CalendarDownload />}
              {(page === "learners" || page === "progress") && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">
                        ПРОГРЕСС СКЛАДЫВАЕТСЯ ИЗ ШАГОВ
                      </div>
                      <h1>{isTutor ? "Ученики" : "Мой прогресс"}</h1>
                      <p>
                        Только проверенные результаты. У каждого наблюдения есть
                        основание.
                      </p>
                    </div>
                    {isTutor && (
                      <button
                        className="primary"
                        onClick={createInvite}
                        disabled={busy}
                      >
                        <Plus size={18} /> Пригласить ученика
                      </button>
                    )}
                  </div>
                  {invite && (
                    <div className="card invite-box">
                      <h3>Приглашение создано</h3>
                      <p>
                        Передайте код ученику через согласованный канал. Он
                        действует 72 часа и используется один раз.
                      </p>
                      <code>{invite}</code>
                      <button
                        className="secondary"
                        onClick={() =>
                          action(async () => {
                            await navigator.clipboard.writeText(invite);
                            setToast("Код скопирован");
                          })
                        }
                      >
                        Скопировать код
                      </button>
                    </div>
                  )}
                  <div className="learner-grid">
                    <section className="card learner-list">
                      {relations.length ? (
                        relations.map((r) => (
                          <button
                            key={r.id}
                            className={selected === r.id ? "active" : ""}
                            onClick={() => {
                              if (mayLeave()) setSelected(r.id);
                            }}
                          >
                            <div className="avatar">{r.learner_alias[0]}</div>
                            <span>
                              <strong>
                                {isTutor ? r.learner_alias : r.tutor_alias}
                              </strong>
                              <small>{r.subject}</small>
                            </span>
                            <ChevronRight size={16} />
                          </button>
                        ))
                      ) : (
                        <Empty
                          title="Начните со знакомства"
                          text="Здесь появятся ваши учебные связи."
                        />
                      )}
                    </section>
                    <section className="card progress-panel">
                      <div className="section-head">
                        <h2>Карта навыков</h2>
                        {selected && (
                          <button
                            className="icon-button"
                            aria-label="Экспорт прогресса"
                            onClick={() =>
                              action(async () => {
                                const data = await api(
                                  "/relationships/" + selected + "/export",
                                );
                                const url = URL.createObjectURL(
                                  new Blob([JSON.stringify(data, null, 2)], {
                                    type: "application/json",
                                  }),
                                );
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = "reprep-progress.json";
                                a.click();
                                URL.revokeObjectURL(url);
                              })
                            }
                          >
                            <Download size={18} />
                          </button>
                        )}
                      </div>
                      {skills.length ? (
                        skills.map((s) => (
                          <details className="skill" key={s.skill}>
                            <summary>
                              <div>
                                <strong>{s.skill}</strong>
                                <small>
                                  {s.total} проверенных ответов · {s.correct}{" "}
                                  верных
                                </small>
                              </div>
                              <Badge state={s.latest} />
                            </summary>
                            <div className="skill-track">
                              <span
                                style={{
                                  width:
                                    (s.total
                                      ? (s.correct / s.total) * 100
                                      : 0) + "%",
                                }}
                              />
                            </div>
                            {s.evidence.map((e) => (
                              <div className="evidence" key={e.id}>
                                <span>
                                  {e.assignment_title}
                                  <small>
                                    {date(e.created)} ·{" "}
                                    {e.review_action === "corrected"
                                      ? "Проверка преподавателя"
                                      : "Подтверждён AI-разбор"}
                                  </small>
                                </span>
                                <Badge state={e.correctness} />
                              </div>
                            ))}
                          </details>
                        ))
                      ) : (
                        <Empty
                          title="Прогресс начинается с обратной связи"
                          text="После проверки преподавателем здесь появятся навыки и работы, на которых основан результат."
                        />
                      )}
                    </section>
                  </div>
                  {selected && (
                    <LearningPlan
                      key={selected}
                      relationship={selected}
                      tutor={isTutor}
                      open={open}
                    />
                  )}
                  {selected && (
                    <SkillGraph
                      key={"graph-" + selected}
                      relationship={selected}
                      tutor={isTutor}
                    />
                  )}
                  {isTutor && (
                    <Workspaces
                      user={user}
                      assignments={assignments}
                      relations={relations}
                      openDraft={openDraft}
                    />
                  )}
                  {isTutor && selected && (
                    <GuardianInvites
                      key={"guardian-" + selected}
                      relation={selected}
                    />
                  )}
                  {isTutor && (
                    <Groups
                      relations={relations}
                      assignments={assignments}
                      refresh={refresh}
                    />
                  )}
                  {isTutor && selected && (
                    <Recommendations
                      relationship={selected}
                      onDraft={openDraft}
                    />
                  )}
                  {isTutor && invites.length > 0 && (
                    <section className="card">
                      <h3>Приглашения</h3>
                      {invites.map((i) => (
                        <div className="line" key={i.id}>
                          <span>
                            {i.subject} ·{" "}
                            {
                              (
                                {
                                  created: "Ожидает ученика",
                                  accepted: "Принято",
                                  expired: "Истекло",
                                  revoked: "Отозвано",
                                  declined: "Отклонено",
                                } as Record<string, string>
                              )[i.state]
                            }
                          </span>
                          {i.state === "created" && (
                            <button
                              className="text-button"
                              onClick={() =>
                                action(async () => {
                                  await api(
                                    "/invitations/" + i.id + "/revoke",
                                    "POST",
                                  );
                                  setInvites(await api("/invitations"));
                                })
                              }
                            >
                              Отозвать
                            </button>
                          )}
                        </div>
                      ))}
                    </section>
                  )}
                </>
              )}
              {(page === "schedule" || page === "materials") && (
                <Collection
                  key={page}
                  page={page}
                  tutor={!!isTutor}
                  relations={relations}
                  lessons={lessons}
                  materials={materials}
                  busy={busy}
                  action={action}
                  refresh={refresh}
                  openDraft={openDraft}
                />
              )}
              {page === "settings" && (
                <>
                  <div className="page-heading">
                    <div>
                      <h1>Настройки и помощь</h1>
                      <p>
                        {user.alias} · {isTutor ? "Преподаватель" : "Ученик"}
                      </p>
                    </div>
                  </div>
                  <ProfileSettings user={user} busy={busy} action={action}
                    saved={(updated) => { setUser(updated); setToast("Имя сохранено"); }} />
                  <Notifications user={user} />
                  <AccountData user={user} />
                  {isTutor && <Analytics />}
                  <section className="card settings">
                    <h3>Проверка работ</h3>
                    <p>
                      {config?.assessment === "local_rules"
                        ? "Сейчас работает автоматическая проверка по эталонам. Это не нейросеть. Свободные ответы проверяет преподаватель."
                        : "AI-модель: " +
                          config?.assessment +
                          ". Выводы предварительные, окончательное решение принимает преподаватель."}
                    </p>
                    <p>
                      Не используйте демонстрационное пространство для
                      персональных данных. Для пилота потребуется согласованный
                      порядок работы с данными.
                    </p>
                    {!isTutor && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          action(async () => {
                            if (!invitePreview) {
                              setInvitePreview(
                                await api("/invitations/preview", "POST", {
                                  token: inviteInput,
                                }),
                              );
                              return;
                            }
                            await api("/invitations/accept", "POST", {
                              token: inviteInput,
                            });
                            setInviteInput("");
                            setInvitePreview(null);
                            await refresh();
                            setToast("Вы подключились к преподавателю");
                          });
                        }}
                      >
                        <label>
                          Код приглашения
                          <input
                            value={inviteInput}
                            required
                            onChange={(e) => {
                              setInviteInput(e.target.value);
                              setInvitePreview(null);
                            }}
                          />
                        </label>
                        <button className="primary" disabled={busy}>
                          {invitePreview
                            ? "Принять приглашение"
                            : "Посмотреть приглашение"}
                        </button>
                        {invitePreview && (
                          <>
                            <p>
                              Преподаватель: {invitePreview.tutor_alias}.
                              Предмет: {invitePreview.subject}.
                            </p>
                            <button
                              type="button"
                              className="secondary"
                              disabled={busy}
                              onClick={() =>
                                action(async () => {
                                  await api("/invitations/decline", "POST", {
                                    token: inviteInput,
                                  });
                                  setInviteInput("");
                                  setInvitePreview(null);
                                  setToast("Приглашение отклонено");
                                })
                              }
                            >
                              Отклонить приглашение
                            </button>
                          </>
                        )}
                      </form>
                    )}
                    <div className="settings-actions">
                      <button className="secondary" onClick={logout}>
                        <LogOut size={16} /> Выйти
                      </button>
                      {user.demo && isTutor && (
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() => {
                            if (
                              confirm(
                                "Сбросить только демонстрационные работы? Все демо-сессии завершатся.",
                              )
                            )
                              action(async () => {
                                const s = await api<{
                                  token: string;
                                  user: User;
                                }>("/demo/reset", "POST");
                                setToken(s.token);
                                setUser(s.user);
                                await refresh();
                                setToast("Демо восстановлено");
                              });
                          }}
                        >
                          <RotateCcw size={16} /> Восстановить демо
                        </button>
                      )}
                    </div>
                  </section>
                </>
              )}
            </>
          )}
          <footer>
            reprep <span>Место, где обучение становится понятнее.</span>
            <span>С заботой о каждом шаге ↗</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
initializeMax().finally(() =>
  createRoot(document.getElementById("root")!).render(<App />),
);
