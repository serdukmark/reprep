export type User = {
  id: string;
  role: "tutor" | "learner" | "guardian";
  alias: string;
  demo: boolean;
};
export type Relation = {
  id: string;
  tutor_alias: string;
  learner_alias: string;
  subject: string;
};
export type Task = {
  id: string;
  type: "numeric" | "single_choice" | "short_text";
  prompt: string;
  options: string[];
  answer?: string;
  rubric?: string;
  skill: string;
  hint?: string;
};
export type Correctness =
  "correct" | "incorrect" | "partially_correct" | "unknown";
export type Assessment = {
  task_id: string;
  correctness: Correctness;
  confidence: number;
  summary_for_tutor: string;
  feedback_for_learner: string;
  hint: string;
  skill: string;
};
export type ReviewTask = {
  task_id: string;
  correctness: Correctness;
  feedback: string;
};
export type AnswerFile = { file_name: string; content: string };
export type Submission = {
  id: string;
  status: string;
  attempt: number;
  answers: Record<string, string>;
  attachments?: Record<string, AnswerFile>;
  submitted: string;
  analysis: {
    engine: string;
    assessment_status: string;
    failure_reason?: string;
    tasks: Assessment[];
  } | null;
  review: { action: string; tasks: ReviewTask[]; note: string } | null;
  hints?: Record<string, string>;
};
export type Assignment = {
  lesson_id?: string;
  id: string;
  title: string;
  instructions: string;
  relationship_id: string;
  status: string;
  revision: number;
  due_at: string | null;
  feedback_policy: "after_review" | "hints_first";
  tasks: Task[];
  draft: {
    answers: Record<string, string>;
    revision: number;
    attachments?: Record<string, AnswerFile>;
  };
  submission: Submission | null;
};
export type AssignmentSummary = {
  id: string;
  title: string;
  due_at: string | null;
  status: string;
  relationship_id: string;
  learner_alias: string;
  tasks_count: number;
  submission: { id: string; status: string } | null;
};
export type Skill = {
  skill: string;
  correct: number;
  total: number;
  latest: Correctness;
  evidence: {
    id: string;
    assignment_title: string;
    review_action: string;
    correctness: Correctness;
    created: string;
    submission_id: string;
  }[];
};
export type Lesson = {
  id: string;
  status?: "scheduled" | "completed" | "cancelled";
  relationship_id: string;
  title: string;
  starts_at: string;
  duration: number;
  payment_status?: string;
};
export type Material = {
  file_name?: string;
  assignment_id?: string;
  lesson_id?: string;
  ai_allowed?: boolean;
  id: string;
  relationship_id: string;
  title: string;
  url: string;
  note: string;
};
let token = "";
try {
  token = sessionStorage.getItem("reprep.session") || "";
} catch {
  /* Embedded storage may be denied. Keep this session in memory. */
}
export function setToken(value: string) {
  token = value;
  try {
    if (value) sessionStorage.setItem("reprep.session", value);
    else sessionStorage.removeItem("reprep.session");
  } catch {
    /* Reload requires a new login, saved answers remain on server. */
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let res: Response;
  let data;
  try {
    res = await fetch("/api" + path, {
      signal: controller.signal,
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    try {
      data = await res.json();
    } catch {
      throw new Error(
        "Сервер вернул непонятный ответ. Обновите данные и повторите действие.",
      );
    }
  } catch (e) {
    if (controller.signal.aborted)
      throw new Error(
        "Сервер не ответил вовремя. Обновите данные перед повтором: действие могло сохраниться.",
      );
    if (e instanceof TypeError)
      throw new Error(
        "Не удалось связаться с сервером. Проверьте соединение и повторите действие.",
      );
    throw e;
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok)
    throw new Error(
      (data?.error?.message || "Не удалось выполнить действие") +
        (data?.error?.reference_id
          ? " · " + data.error.reference_id.slice(0, 8)
          : ""),
    );
  return data;
}
export const labels: Record<string, string> = {
  draft: "Черновик",
  published: "Назначено",
  queued: "В очереди проверки",
  processing: "Проверяем",
  awaiting_review: "Ждёт преподавателя",
  reviewed: "Проверено",
  returned: "На доработке",
  correct: "Верно",
  incorrect: "Нужно исправить",
  partially_correct: "Частично верно",
  unknown: "Нужна ручная проверка",
};
export function date(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
      })
    : "Без дедлайна";
}
