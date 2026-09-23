import { ChoiceSelect } from "./ChoiceSelect";
import React, { useEffect, useState } from "react";
import { api, AssignmentSummary, Material } from "./api";
import { useUnsaved } from "./components";

type Step = {
  title: string;
  skill: string;
  status: "planned" | "in_progress" | "completed";
  assignment_id: string;
  material_id: string;
};
type Plan = { revision: number; goal: string; level: string; steps: Step[] };
export function LearningPlan({
  relationship,
  tutor,
  open,
}: {
  relationship: string;
  tutor: boolean;
  open: (id: string) => void;
}) {
  const [plan, setPlan] = useState<Plan | null>(null),
    [saved, setSaved] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]),
    [materials, setMaterials] = useState<Material[]>([]);
  useUnsaved(!!plan && JSON.stringify(plan) !== saved);
  useEffect(() => {
    let live = true;
    Promise.all([
      api<Plan>(`/relationships/${relationship}/plan`),
      api<AssignmentSummary[]>("/assignments"),
      api<Material[]>("/materials"),
    ])
      .then(([p, a, m]) => {
        if (live) {
          setPlan(p);
          setSaved(JSON.stringify(p));
          setAssignments(a.filter((x) => x.relationship_id === relationship));
          setMaterials(m.filter((x) => x.relationship_id === relationship));
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [relationship]);
  if (!plan)
    return (
      <section className="card">
        <h3>Индивидуальная программа</h3>
        <p role={error ? "alert" : undefined}>
          {error || "Загрузка программы…"}
        </p>
      </section>
    );
  function step(i: number, patch: Partial<Step>) {
    setPlan(
      (p) =>
        p && {
          ...p,
          steps: p.steps.map((s, j) => (i === j ? { ...s, ...patch } : s)),
        },
    );
  }
  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const p = await api<Plan>(
            `/relationships/${relationship}/plan`,
            "PUT",
            plan,
          );
          setPlan(p);
          setSaved(JSON.stringify(p));
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Индивидуальная программа</h3>
      <p>
        План преподавателя. Отметка этапа не заменяет подтверждённые результаты
        работ.
      </p>
      {error && <p role="alert">{error}</p>}
      {tutor ? (
        <fieldset disabled={busy}>
          <label>
            Цель программы
            <textarea
              required
              minLength={2}
              maxLength={1000}
              value={plan.goal}
              onChange={(e) => setPlan({ ...plan, goal: e.target.value })}
            />
          </label>
          <label>
            Учебный уровень
            <input
              maxLength={100}
              value={plan.level}
              onChange={(e) => setPlan({ ...plan, level: e.target.value })}
            />
          </label>
          {plan.steps.map((s, i) => (
            <section className="card" key={i}>
              <label>
                Этап {i + 1}
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  value={s.title}
                  onChange={(e) => step(i, { title: e.target.value })}
                />
              </label>
              <label>
                Навык этапа {i + 1}
                <input
                  required
                  maxLength={100}
                  value={s.skill}
                  onChange={(e) => step(i, { skill: e.target.value })}
                />
              </label>
              <label>
                Статус этапа {i + 1}
                <ChoiceSelect
                  value={s.status}
                  onChange={(e) =>
                    step(i, { status: e.target.value as Step["status"] })
                  }
                >
                  <option value="planned">Запланирован</option>
                  <option value="in_progress">В работе</option>
                  <option value="completed">Завершён преподавателем</option>
                </ChoiceSelect>
              </label>
              <label>
                Работа этапа {i + 1}
                <ChoiceSelect
                  value={s.assignment_id}
                  onChange={(e) => step(i, { assignment_id: e.target.value })}
                >
                  <option value="">Не выбрана</option>
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </ChoiceSelect>
              </label>
              <label>
                Материал этапа {i + 1}
                <ChoiceSelect
                  value={s.material_id}
                  onChange={(e) => step(i, { material_id: e.target.value })}
                >
                  <option value="">Не выбран</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </ChoiceSelect>
              </label>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setPlan({
                    ...plan,
                    steps: plan.steps.filter((_, j) => j !== i),
                  })
                }
              >
                Удалить этап {i + 1}
              </button>
              {i > 0 && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    const steps = [...plan.steps];
                    [steps[i - 1], steps[i]] = [steps[i], steps[i - 1]];
                    setPlan({ ...plan, steps });
                  }}
                >
                  Выше
                </button>
              )}
            </section>
          ))}
          <button
            type="button"
            className="secondary"
            disabled={plan.steps.length >= 50}
            onClick={() =>
              setPlan({
                ...plan,
                steps: [
                  ...plan.steps,
                  {
                    title: "",
                    skill: "",
                    status: "planned",
                    assignment_id: "",
                    material_id: "",
                  },
                ],
              })
            }
          >
            Добавить этап
          </button>
          <button className="primary">Сохранить программу</button>
          {saved === JSON.stringify(plan) && plan.revision > 0 && (
            <p role="status">Программа сохранена</p>
          )}
        </fieldset>
      ) : (
        <>
          <p>{plan.goal || "Преподаватель ещё не составил программу."}</p>
          <p>{plan.level}</p>
          <ol>
            {plan.steps.map((s, i) => (
              <li key={i}>
                <strong>{s.title}</strong>
                <p>
                  {s.skill} ·{" "}
                  {
                    {
                      planned: "Запланирован",
                      in_progress: "В работе",
                      completed: "Завершён преподавателем",
                    }[s.status]
                  }
                </p>
                {s.assignment_id && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => open(s.assignment_id)}
                  >
                    Открыть работу
                  </button>
                )}
                {s.material_id && (
                  <p>
                    Материал:{" "}
                    {materials.find((m) => m.id === s.material_id)?.title ||
                      "Смотрите библиотеку"}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </form>
  );
}
