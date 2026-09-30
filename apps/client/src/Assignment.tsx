import { ChoiceSelect } from "./ChoiceSelect";
import { LearnerFeedback } from "./LearnerFeedback";
import React, { useState, useEffect, useRef, FormEvent } from "react";
import {
  ArrowRight,
  Plus,
  Trash2,
  ShieldCheck,
  Clock,
  Sparkles,
  Check,
  CheckCheck,
} from "lucide-react";
import {
  api,
  date,
  labels,
  Assignment,
  AnswerFile,
  Task,
  Relation,
  Lesson,
  ReviewTask,
  Correctness,
} from "./api";
import { AnswerAttachment } from "./AnswerAttachment";
import { WorkMaterials } from "./WorkMaterials";
import { Questions } from "./Questions";
import { Discussion } from "./Discussion";
import { AttemptHistory } from "./AttemptHistory";
import { AnswerProgress, SubmissionMoment } from "./SubmissionMoment";
import { Badge, useUnsaved } from "./components";
export const blankTask = (): Task => ({
  id: crypto.randomUUID().replaceAll("-", ""),
  type: "numeric",
  prompt: "",
  options: [],
  answer: "",
  rubric: "",
  skill: "",
  hint: "",
});
export const blankAssignment = (r: string): Assignment => ({
  client_id: crypto.randomUUID(),
  id: "",
  title: "",
  instructions: "",
  relationship_id: r,
  status: "draft",
  revision: 1,
  due_at: null,
  feedback_policy: "after_review",
  tasks: [blankTask()],
  draft: { answers: {}, revision: 0 },
  submission: null,
});
export function Builder({
  initial,
  relations,
  busy,
  save,
}: {
  initial: Assignment;
  relations: Relation[];
  busy: boolean;
  save: (a: Assignment, p: boolean) => void;
}) {
  const [a, setA] = useState(initial),
    [preview, setPreview] = useState(false);
  const [lessonOptions, setLessonOptions] = useState<Lesson[]>([]);
  const [lessonError, setLessonError] = useState("");
  useEffect(() => {
    let live = true;
    api<Lesson[]>("/lessons")
      .then((x) => {
        if (live) setLessonOptions(x);
      })
      .catch((e) => {
        if (live) setLessonError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  useUnsaved(JSON.stringify(a) !== JSON.stringify(initial));
  const update = (i: number, patch: Partial<Task>) =>
    setA((old) => ({
      ...old,
      tasks: old.tasks.map((t, j) => (i === j ? { ...t, ...patch } : t)),
    }));
  function submit(e: FormEvent) {
    e.preventDefault();
    save(a, false);
  }
  return (
    <form onSubmit={submit}>
      <div className="page-heading">
        <div>
          <div className="eyebrow">СНАЧАЛА ХОРОШИЙ ВОПРОС</div>
          <h1>{initial.id ? "Редактирование работы" : "Новое задание"}</h1>
          <p>Эталоны и критерии останутся видны только вам.</p>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => setPreview(!preview)}
        >
          {preview ? "Вернуться к редактору" : "Глазами ученика"}
        </button>
      </div>
      {!a.relationship_id && (
        <div className="notice">
          Черновик можно сохранить без ученика. Чтобы назначить работу,
          пригласите ученика в разделе «Ученики», дождитесь принятия приглашения
          и выберите его здесь.
        </div>
      )}
      <section className="card builder">
        <label>
          Название работы
          <input
            required
            minLength={3}
            maxLength={160}
            placeholder="Например, линейные уравнения"
            value={a.title}
            onChange={(e) => setA({ ...a, title: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            Ученик
            <ChoiceSelect
              aria-label="Ученик"
              value={a.relationship_id}
              onChange={(e) =>
                setA({ ...a, relationship_id: e.target.value, lesson_id: "" })
              }
            >
              <option value="">Выбрать позже · черновик</option>
              {relations.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.learner_alias} · {r.subject}
                </option>
              ))}
            </ChoiceSelect>
          </label>
          <label>
            Дедлайн (ваш часовой пояс)
            <input
              type="datetime-local"
              value={
                a.due_at
                  ? new Date(
                      new Date(a.due_at).getTime() -
                        new Date(a.due_at).getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)
                  : ""
              }
              onChange={(e) =>
                setA({
                  ...a,
                  due_at: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null,
                })
              }
            />
          </label>
        </div>
        <label>
          Занятие для этой работы
          <ChoiceSelect
            value={a.lesson_id || ""}
            onChange={(e) => setA({ ...a, lesson_id: e.target.value })}
          >
            <option value="">Без привязки</option>
            {lessonOptions
              .filter((l) => l.relationship_id === a.relationship_id)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title} · {date(l.starts_at)}
                </option>
              ))}
          </ChoiceSelect>
        </label>
        {lessonError && <p role="alert">{lessonError}</p>}
        <label>
          Инструкция ученику
          <textarea
            maxLength={3000}
            placeholder="Что важно помнить при выполнении?"
            value={a.instructions}
            onChange={(e) => setA({ ...a, instructions: e.target.value })}
          />
        </label>
        {!preview && (
          <label>
            Когда показывать обратную связь
            <ChoiceSelect
              value={a.feedback_policy}
              onChange={(e) =>
                setA({
                  ...a,
                  feedback_policy: e.target.value as typeof a.feedback_policy,
                })
              }
            >
              <option value="after_review">После моей проверки</option>
              <option value="hints_first">
                Мои подсказки сразу, результат после проверки
              </option>
            </ChoiceSelect>
          </label>
        )}
      </section>
      {a.tasks.map((t, i) => (
        <section className="card task-editor" key={t.id}>
          <div className="section-head">
            <span className="eyebrow">
              ЗАДАНИЕ {String(i + 1).padStart(2, "0")}
            </span>
            {!preview && a.tasks.length > 1 && (
              <button
                type="button"
                className="icon-button"
                aria-label={"Удалить задание " + (i + 1)}
                onClick={() =>
                  setA({ ...a, tasks: a.tasks.filter((_, j) => j !== i) })
                }
              >
                <Trash2 size={17} />
              </button>
            )}
          </div>
          {preview ? (
            <>
              <h3>{t.prompt || "Текст задания"}</h3>
              {t.type === "single_choice" ? (
                t.options.map((o) => (
                  <div className="option" key={o}>
                    {o}
                  </div>
                ))
              ) : (
                <div className="answer-placeholder">
                  Место для ответа ученика
                </div>
              )}
            </>
          ) : (
            <>
              <label>
                Формат ответа
                <ChoiceSelect
                  value={t.type}
                  onChange={(e) =>
                    update(i, {
                      type: e.target.value as Task["type"],
                      answer: "",
                      options:
                        e.target.value === "single_choice"
                          ? ["Вариант 1", "Вариант 2"]
                          : [],
                    })
                  }
                >
                  <option value="numeric">Число</option>
                  <option value="single_choice">Один вариант</option>
                  <option value="short_text">
                    Короткий ответ с объяснением
                  </option>
                </ChoiceSelect>
              </label>
              <label>
                Условие
                <textarea
                  required
                  minLength={3}
                  maxLength={3000}
                  value={t.prompt}
                  onChange={(e) => update(i, { prompt: e.target.value })}
                />
              </label>
              {t.type === "single_choice" && (
                <label>
                  Варианты (каждый с новой строки)
                  <textarea
                    value={t.options.join("\n")}
                    onChange={(e) =>
                      update(i, { options: e.target.value.split("\n") })
                    }
                  />
                </label>
              )}
              <div className="private-fields">
                <span>
                  <ShieldCheck size={15} /> Только преподавателю и проверяющей
                  модели
                </span>
                <div className="form-grid">
                  <label>
                    Эталонный ответ
                    {t.type === "single_choice" ? (
                      <ChoiceSelect
                        value={t.answer}
                        onChange={(e) => update(i, { answer: e.target.value })}
                      >
                        <option value="">Выберите правильный</option>
                        {t.options.map((o, j) => (
                          <option key={j}>{o}</option>
                        ))}
                      </ChoiceSelect>
                    ) : (
                      <input
                        maxLength={1000}
                        value={t.answer}
                        required={t.type === "numeric"}
                        onChange={(e) => update(i, { answer: e.target.value })}
                      />
                    )}
                  </label>
                  <label>
                    Навык
                    <input
                      required
                      maxLength={100}
                      placeholder="Например, раскрытие скобок"
                      value={t.skill}
                      onChange={(e) => update(i, { skill: e.target.value })}
                    />
                  </label>
                </div>
                <label>
                  Критерии проверки
                  <textarea
                    maxLength={2000}
                    placeholder="Что считать верным, частично верным, на что обратить внимание"
                    value={t.rubric}
                    onChange={(e) => update(i, { rubric: e.target.value })}
                  />
                </label>
              </div>
              <label>
                Подсказка ученику (без готового ответа)
                <input
                  maxLength={1000}
                  value={t.hint}
                  onChange={(e) => update(i, { hint: e.target.value })}
                />
              </label>
            </>
          )}
        </section>
      ))}
      {!preview && a.tasks.length < 20 && (
        <button
          className="add-task"
          type="button"
          onClick={() => setA({ ...a, tasks: [...a.tasks, blankTask()] })}
        >
          <Plus size={18} /> Добавить задание
        </button>
      )}
      <div className="form-actions">
        <span>После назначения содержание работы фиксируется.</span>
        <button className="secondary" disabled={busy}>
          Сохранить черновик
        </button>
        <button
          className="primary"
          disabled={busy || !a.relationship_id}
          type="button"
          onClick={(e) => {
            if (e.currentTarget.form?.reportValidity()) save(a, true);
          }}
        >
          Назначить ученику <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
}
export function AssignmentDetail({
  assignment: a,
  isTutor,
  busy,
  action,
  update,
  edit,
  duplicate,
  journeyEnabled = false,
}: {
  assignment: Assignment;
  isTutor: boolean;
  busy: boolean;
  action: (fn: () => Promise<void>) => Promise<void>;
  update: () => Promise<void>;
  edit: () => void;
  duplicate: () => void;
  journeyEnabled?: boolean;
}) {
  const [receipt, setReceipt] = useState<{
    id: string;
    answers: Record<string, string>;
    attachments: Record<string, AnswerFile>;
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>(
      a.draft.revision
        ? a.draft.answers
        : a.submission?.status === "returned"
          ? a.submission.answers
          : a.draft.answers,
    ),
    [attachments, setAttachments] = useState<Record<string, AnswerFile>>(
      (a.draft.revision
        ? a.draft.attachments
        : a.submission?.status === "returned"
          ? a.submission.attachments
          : a.draft.attachments) || {},
    ),
    [fileError, setFileError] = useState(""),
    [fileLoading, setFileLoading] = useState(false),
    [revision, setRevision] = useState(a.draft.revision),
    [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState(""),
    [saved, setSaved] = useState(""),
    [note, setNote] = useState(""),
    [showHints, setShowHints] = useState<Record<string, boolean>>({});
  const s = a.submission;
  // Keep the acknowledged original visible even if the follow-up GET fails.
  const visibleOriginal = receipt && s?.id !== receipt.id ? receipt : s;
  const hasMatchingSubmission = !receipt || s?.id === receipt.id;
  const writable = !isTutor && !receipt && (!s || s.status === "returned");
  const priorSubmission = useRef({ id: s?.id, status: s?.status });
  useEffect(() => {
    if (
      !isTutor &&
      s?.status === "returned" &&
      hasMatchingSubmission &&
      (priorSubmission.current.status !== "returned" ||
        priorSubmission.current.id !== s.id ||
        !!receipt)
    ) {
      setAnswers(a.draft.revision ? a.draft.answers : s.answers);
      setAttachments(
        (a.draft.revision ? a.draft.attachments : s.attachments) || {},
      );
      setRevision(a.draft.revision);
      setDirty(false);
      setSaveError("");
      setSaved("");
      setReceipt(null);
    }
    priorSubmission.current = { id: s?.id, status: s?.status };
  }, [s?.status, s?.id, receipt?.id]);

  const [reviewTasks, setReviewTasks] = useState<ReviewTask[]>([]);
  const savingRef = useRef(false),
    reviewDirty = useRef(false);
  useEffect(() => {
    if (isTutor) {
      setNote("");
      reviewDirty.current = false;
    }
  }, [s?.id]);
  useUnsaved(dirty || reviewDirty.current);
  useEffect(() => {
    if (reviewDirty.current) return;
    setReviewTasks(
      a.tasks.map((t) => {
        const r = s?.analysis?.tasks.find((x) => x.task_id === t.id);
        return {
          task_id: t.id,
          correctness: r?.correctness || "unknown",
          feedback: r?.feedback_for_learner || "",
        };
      }),
    );
  }, [s?.analysis]);
  async function save() {
    if (savingRef.current) return;
    setSaving(true);
    savingRef.current = true;
    setSaveError("");
    try {
      const r = await api<{ revision: number }>(
        "/assignments/" + a.id + "/draft",
        "PUT",
        { answers, revision, attachments },
      );
      setRevision(r.revision);
      setDirty(false);
      setSaved("Сохранено");
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }
  async function send() {
    if (
      !confirm(
        "Отправить работу преподавателю? Сохранённые ответы останутся в истории.",
      )
    )
      return;
    await action(async () => {
      const submitted = await api<{ id: string }>(
        "/assignments/" + a.id + "/submit",
        "POST",
        { answers, attachments, revision },
      );
      setDirty(false);
      if (journeyEnabled) setReceipt({ id: submitted.id, answers, attachments });
      await update();
    });
  }
  useEffect(() => {
    if (!writable || !dirty || saving || busy || fileLoading || saveError)
      return;
    const timer = setTimeout(() => {
      void save();
    }, 2000);
    return () => clearTimeout(timer);
  }, [
    answers,
    attachments,
    dirty,
    saving,
    busy,
    fileLoading,
    writable,
    saveError,
  ]);
  async function attach(task: string, file?: File) {
    if (!file) return;
    setFileLoading(true);
    setFileError("");
    try {
      if (!file.name.endsWith(".txt") || file.size > 60000 || file.size === 0)
        throw Error("Нужен непустой TXT до 60 KB");
      const content = new TextDecoder("utf-8", {
        fatal: true,
        ignoreBOM: true,
      }).decode(await file.arrayBuffer());
      if (content.includes("\0")) throw Error("Нулевые байты не допускаются");
      const next = {
        ...attachments,
        [task]: { file_name: file.name, content },
      };
      if (
        Object.keys(next).length > 3 ||
        Object.values(next).reduce(
          (n, f) => n + new TextEncoder().encode(f.content).length,
          0,
        ) > 60000
      )
        throw Error("Не более трёх файлов, суммарно до 60 KB");
      setAttachments(next);
      setDirty(true);
      setSaved("");
    } catch (e) {
      setFileError((e as Error).message);
    } finally {
      setFileLoading(false);
    }
  }
  async function review(kind: string) {
    await action(async () => {
      await api("/submissions/" + s!.id + "/review", "POST", {
        action: kind,
        tasks: kind === "returned" || kind === "rejected" ? [] : reviewTasks,
        note,
      });
      reviewDirty.current = false;
      await update();
    });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <Badge state={s?.status || a.status} />
          <h1 className="assignment-title">{a.title}</h1>
          <p>
            <Clock size={15} /> {date(a.due_at)} · {a.tasks.length} задания
            {s && " · Попытка " + s.attempt}
          </p>
        </div>
        {isTutor && (
          <button
            className="secondary"
            disabled={busy}
            onClick={a.status === "draft" ? edit : duplicate}
          >
            {a.status === "draft" ? "Редактировать" : "Создать копию"}
          </button>
        )}
      </div>
      {a.instructions && <div className="instructions">{a.instructions}</div>}
      {journeyEnabled && writable && (
        <AnswerProgress
          answered={a.tasks.filter((task) =>
            !!answers[task.id]?.trim() || !!attachments[task.id]?.content.trim(),
          ).length}
          total={a.tasks.length}
        />
      )}
      {journeyEnabled &&
        !isTutor &&
        receipt &&
        (!hasMatchingSubmission || !["reviewed", "returned"].includes(s?.status || "")) && (
          <SubmissionMoment key={receipt.id} relationship={a.relationship_id} />
        )}
      {s && hasMatchingSubmission && (
        <div className="notice">
          {s.status === "returned"
            ? "Преподаватель вернул работу: " +
              s.review?.note +
              ". Можно отправить новую попытку."
            : s.status === "reviewed"
              ? s.review?.action === "rejected"
                ? "Работа отклонена без оценки. " + s.review.note
                : "Преподаватель проверил работу. Обратная связь — под каждым ответом."
              : isTutor
                ? ["queued", "processing"].includes(s.status)
                  ? "Ответы сохранены. AI готовит разбор, но вы уже можете проверить вручную."
                  : s.analysis?.failure_reason === "context_too_large"
                    ? "Работа слишком длинная для одной AI-проверки. Все ответы сохранены; проверьте её вручную или назначьте меньшие части отдельными работами."
                    : ["provider_unavailable", "output_invalid"].includes(
                          s.analysis?.assessment_status || "",
                        )
                      ? "AI не смог подготовить надёжный разбор. Ответы сохранены: проверьте работу вручную или повторите попытку позже."
                      : s.analysis?.engine === "local_rules_v1"
                        ? "Предварительная проверка по эталонам, без нейросети. Проверьте выводы и добавьте обратную связь."
                        : s.analysis
                          ? "Предварительный AI-разбор · " +
                            s.analysis.engine +
                            ". Решение остаётся за вами."
                          : "Ответы сохранены. AI готовит разбор, но вы уже можете проверить вручную."
                : "Ответы сохранены и отправлены. Преподаватель проверит результат и даст обратную связь."}
        </div>
      )}
      {a.tasks.map((t, i) => {
        const assessed = s?.analysis?.tasks.find((x) => x.task_id === t.id);
        const reviewed = hasMatchingSubmission
          ? s?.review?.tasks.find((x) => x.task_id === t.id)
          : undefined;
        return (
          <section className="card work-task" key={t.id}>
            <div className="section-head">
              <span className="eyebrow">
                ЗАДАНИЕ {String(i + 1).padStart(2, "0")}
              </span>
              <span className="skill-tag">{t.skill}</span>
            </div>
            <h2>{t.prompt}</h2>
            {writable ? (
              <>
                {t.type === "single_choice" ? (
                  <fieldset className="options">
                    <legend>Ваш ответ</legend>
                    {t.options.map((o) => (
                      <label
                        className={
                          "option " + (answers[t.id] === o ? "chosen" : "")
                        }
                        key={o}
                      >
                        <input
                          type="radio"
                          disabled={saving || busy}
                          name={t.id}
                          checked={answers[t.id] === o}
                          onChange={() => {
                            setAnswers({ ...answers, [t.id]: o });
                            setDirty(true);
                            setSaved("");
                          }}
                        />
                        {o}
                      </label>
                    ))}
                  </fieldset>
                ) : (
                  <label>
                    Ваш ответ
                    <textarea
                      aria-label={"Ответ на задание " + (i + 1)}
                      disabled={saving || busy}
                      rows={t.type === "numeric" ? 2 : 4}
                      maxLength={5000}
                      value={answers[t.id] || ""}
                      placeholder={
                        t.type === "numeric"
                          ? "Введите число"
                          : "Напишите ответ и ход рассуждений"
                      }
                      onChange={(e) => {
                        setAnswers({ ...answers, [t.id]: e.target.value });
                        setDirty(true);
                        setSaved("");
                      }}
                    />
                  </label>
                )}
              </>
            ) : (
              visibleOriginal && (
                <div className="original">
                  <span>ОРИГИНАЛЬНЫЙ ОТВЕТ УЧЕНИКА</span>
                  <p>{visibleOriginal.answers[t.id]}</p>
                </div>
              )
            )}
            <AnswerAttachment
              file={writable ? attachments[t.id] : visibleOriginal?.attachments?.[t.id]}
            />
            {writable && t.type !== "single_choice" && (
              <div>
                <label>
                  TXT к заданию {i + 1}
                  <input
                    type="file"
                    accept=".txt,text/plain"
                    disabled={saving || busy || fileLoading}
                    onChange={(e) => {
                      void attach(t.id, e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {attachments[t.id] && (
                  <button
                    type="button"
                    className="text-button"
                    disabled={saving || busy || fileLoading}
                    onClick={() => {
                      const next = { ...attachments };
                      delete next[t.id];
                      setAttachments(next);
                      setDirty(true);
                      setSaved("");
                    }}
                  >
                    Убрать файл
                  </button>
                )}
              </div>
            )}
            {isTutor && (
              <div className="reference">
                <strong>Эталон и критерии</strong>
                <p>{t.answer || t.rubric}</p>
                {t.answer && t.rubric && <p>{t.rubric}</p>}
              </div>
            )}
            {isTutor && s && !s.review && (
              <div className="assessment">
                <div className="section-head">
                  <strong>
                    <Sparkles size={17} />{" "}
                    {assessed ? "Предварительный разбор" : "Ручная проверка"}
                  </strong>
                  {assessed && <Badge state={assessed.correctness} />}
                </div>
                {assessed && <p>{assessed.summary_for_tutor}</p>}
                <div className="form-grid">
                  <label>
                    Результат
                    <ChoiceSelect
                      value={reviewTasks[i]?.correctness || "unknown"}
                      onChange={(e) => {
                        reviewDirty.current = true;
                        setReviewTasks((old) =>
                          old.map((r, j) =>
                            j === i
                              ? {
                                  ...r,
                                  correctness: e.target.value as Correctness,
                                }
                              : r,
                          ),
                        );
                      }}
                    >
                      {[
                        "correct",
                        "partially_correct",
                        "incorrect",
                        "unknown",
                      ].map((k) => (
                        <option key={k} value={k}>
                          {labels[k]}
                        </option>
                      ))}
                    </ChoiceSelect>
                  </label>
                  <label>
                    Обратная связь ученику
                    <textarea
                      value={reviewTasks[i]?.feedback || ""}
                      maxLength={3000}
                      onChange={(e) => {
                        reviewDirty.current = true;
                        setReviewTasks((old) =>
                          old.map((r, j) =>
                            j === i ? { ...r, feedback: e.target.value } : r,
                          ),
                        );
                      }}
                    />
                  </label>
                </div>
              </div>
            )}
            {reviewed && (
              <div className="reviewed-feedback">
                <strong>
                  <CheckCheck size={18} /> Проверено преподавателем
                </strong>
                <Badge state={reviewed.correctness} />
                <p>{reviewed.feedback}</p>
              </div>
            )}
            {!isTutor && hasMatchingSubmission && s?.hints?.[t.id] && (
              <div className="hint">
                <button
                  className="text-button"
                  onClick={() =>
                    setShowHints({ ...showHints, [t.id]: !showHints[t.id] })
                  }
                >
                  <Sparkles size={16} /> Подсказка преподавателя
                </button>
                {showHints[t.id] && <p>{s.hints[t.id]}</p>}
              </div>
            )}
          </section>
        );
      })}
      {writable && (
        <p>
          До трёх TXT-файлов, суммарно 60 KB. Текст файла входит в проверку
          вместе с ответом; оригинал сохраняется в истории.
        </p>
      )}
      {fileError && <p role="alert">{fileError}</p>}
      {writable && (
        <div className="form-actions sticky">
          <div role="status">
            {saving
              ? "Сохраняем…"
              : dirty
                ? "Есть несохранённые ответы"
                : saved || "Ответы можно сохранить и продолжить позже"}
            {saveError && <p className="save-error">{saveError}</p>}
          </div>
          <button
            className="secondary"
            disabled={saving || busy || fileLoading || !dirty}
            onClick={save}
          >
            Сохранить ответы
          </button>
          <button
            className="primary"
            disabled={saving || busy || fileLoading}
            onClick={send}
          >
            Отправить работу <ArrowRight size={16} />
          </button>
        </div>
      )}
      {isTutor && s && !s.review && (
        <section className="card">
          <h2>Ваше решение</h2>
          <p>
            Прогресс обновится только после вашей проверки. Неуверенный вывод
            можно оставить без оценки.
          </p>
          <label>
            Комментарий к работе
            <textarea
              value={note}
              maxLength={2000}
              onChange={(e) => {
                reviewDirty.current = true;
                setNote(e.target.value);
              }}
            />
          </label>
          <div className="review-actions">
            <button
              className="primary"
              disabled={busy || reviewTasks.some((t) => !t.feedback)}
              onClick={() => review("corrected")}
            >
              <Check size={17} /> Сохранить мою проверку
            </button>
            {s.analysis && s.analysis.tasks.length === a.tasks.length && (
              <button
                className="secondary"
                disabled={busy}
                onClick={() => review("confirmed")}
              >
                Подтвердить разбор
              </button>
            )}
            <button
              className="secondary"
              disabled={busy || !note}
              onClick={() => review("returned")}
            >
              Вернуть на доработку
            </button>
            <button
              className="text-button"
              disabled={busy || !note}
              onClick={() => review("rejected")}
            >
              Отклонить без прогресса
            </button>
            {s.status === "awaiting_review" &&
              s.analysis?.failure_reason !== "context_too_large" &&
              ["output_invalid", "provider_unavailable"].includes(
                s.analysis?.assessment_status || "",
              ) && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    action(async () => {
                      await api("/submissions/" + s.id + "/retry", "POST");
                      await update();
                    })
                  }
                >
                  Повторить AI-проверку
                </button>
              )}
          </div>
        </section>
      )}
      <WorkMaterials key={"materials-" + a.id} assignment={a} />
      {a.status !== "draft" && (
        <Questions
          key={"questions-" + a.id}
          assignment={a.id}
          tasks={a.tasks}
          tutor={isTutor}
        />
      )}
      {a.status !== "draft" && (
        <Discussion key={"discussion-" + a.id} assignment={a.id} />
      )}
      {s && <AttemptHistory assignment={a} tutor={isTutor} />}
      {!isTutor && s && hasMatchingSubmission && (
        <LearnerFeedback key={a.id} assignment={a.id} />
      )}
    </>
  );
}
