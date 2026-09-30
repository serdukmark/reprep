import { Check, ChevronRight, Flame, LockKeyhole, Route } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { api, date, labels, type Skill } from "./api";
import "./learningJourney.css";

type PathNode = {
  skill: string;
  latest: string;
  correct: number;
  total: number;
  evidence_count: number;
  evidence_ids?: string[];
  prerequisites_confirmed: boolean;
};
type PathGraph = {
  skills: string[];
  edges: { prerequisite: string; skill: string }[];
  nodes: PathNode[];
};
type PathData = { graph: PathGraph; progress: Skill[] };

function stateOf(node: PathNode) {
  if (node.latest === "correct") return "confirmed";
  return node.prerequisites_confirmed ? "current" : "locked";
}

function stateLabel(node: PathNode) {
  if (node.latest === "correct") return "Последняя проверка: верно";
  return node.prerequisites_confirmed
    ? "Можно тренировать"
    : "После предыдущих навыков";
}

// Keep the teacher's order within each prerequisite level. Independent branches
// share a level; there are no invented links between neighbouring nodes.
function pathLevels(graph: PathGraph): PathNode[][] {
  const remaining = [...graph.nodes];
  const placed = new Set<string>();
  const levels: PathNode[][] = [];
  while (remaining.length) {
    const next = remaining.filter((node) =>
      graph.edges
        .filter((edge) => edge.skill === node.skill)
        .every((edge) => placed.has(edge.prerequisite)),
    );
    // The API rejects cycles; a defensive fallback still shows every real node.
    if (!next.length) return [...levels, remaining];
    levels.push(next);
    for (const node of next) {
      placed.add(node.skill);
      remaining.splice(remaining.indexOf(node), 1);
    }
  }
  return levels;
}

export function SkillPath({ relationship }: { relationship: string }) {
  const [data, setData] = useState<PathData | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState("");
  const headingId = useId();
  const detailId = useId();

  useEffect(() => {
    let live = true;
    setData(null);
    setError("");
    setSelected("");
    Promise.all([
      api<PathGraph>(`/relationships/${relationship}/skill-graph`),
      api<Skill[]>(`/relationships/${relationship}/progress`),
    ])
      .then(([graph, progress]) => {
        if (live) setData({ graph, progress });
      })
      .catch((reason: Error) => {
        if (live) setError(reason.message);
      });
    return () => {
      live = false;
    };
  }, [relationship, retry]);

  const hasGraph = !!data?.graph.nodes.length;
  const nodes: PathNode[] = hasGraph
    ? data!.graph.nodes
    : (data?.progress || []).map((skill) => ({
        ...skill,
        evidence_count: skill.evidence.length,
        prerequisites_confirmed: true,
      }));
  const levels = hasGraph ? pathLevels(data!.graph) : [nodes];
  const current = nodes.find((node) => node.skill === selected);
  const byId = new Map(
    (data?.progress || []).flatMap((skill) =>
      skill.evidence.map((item) => [item.id, item] as const),
    ),
  );
  // The graph supplies exact evidence IDs and order, including merged spelling
  // variants. Do not reimplement server normalization or guess which row won.
  const candidates = hasGraph
    ? current?.evidence_ids?.flatMap((id) =>
        byId.has(id) ? [byId.get(id)!] : [],
      )
    : data?.progress.find((skill) => skill.skill === selected)?.evidence;
  const evidence =
    current &&
    candidates &&
    candidates.length === current.evidence_count &&
    (!candidates.length || candidates[0].correctness === current.latest)
      ? candidates
      : undefined;

  return (
    <section
      className="card learning-journey skill-path"
      aria-labelledby={headingId}
      data-testid="journey-path"
      data-relationship={relationship}
    >
      <div className="journey-heading">
        <Route aria-hidden="true" size={28} />
        <h2 id={headingId}>Мой путь</h2>
      </div>
      <p className="journey-note">
        Результаты подтверждает преподаватель. Верная последняя проверка не
        означает, что навык освоен полностью.
      </p>
      {!data && !error && <p role="status">Загружаем путь навыков…</p>}
      {error && (
        <div className="journey-message">
          <p role="alert">Не удалось загрузить путь. {error}</p>
          <button
            className="secondary"
            type="button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Попробовать ещё раз
          </button>
        </div>
      )}
      {data && !nodes.length && (
        <div className="journey-message">
          <h3>Путь ещё не составлен</h3>
          <p>
            После проверки работы здесь появятся навыки. Преподаватель может
            связать их в план: что тренировать сначала, а что потом.
          </p>
        </div>
      )}
      {data && !!nodes.length && (
        <>
          <p className="journey-note">
            {hasGraph
              ? "Порядок задаёт преподаватель. Замок обозначает неподтверждённые предпосылки и не мешает открывать назначенные работы."
              : "Преподаватель пока не задал связи. Это список навыков из проверенных работ, без выдуманного порядка."}
          </p>
          <ol
            className={`skill-path-levels${hasGraph ? "" : " skill-path-list"}`}
            aria-label={
              hasGraph
                ? "Навыки по плану преподавателя"
                : "Навыки из проверенных работ"
            }
          >
            {levels.map((level, index) => (
              <li className="skill-path-level" key={index}>
                <ul className="skill-path-nodes">
                  {level.map((node) => {
                    const state = stateOf(node);
                    const Icon =
                      state === "confirmed"
                        ? Check
                        : state === "locked"
                          ? LockKeyhole
                          : Flame;
                    const parents = data.graph.edges
                      .filter((edge) => edge.skill === node.skill)
                      .map((edge) => edge.prerequisite);
                    return (
                      <li key={node.skill}>
                        <button
                          className={`skill-path-node skill-path-node-${state}`}
                          type="button"
                          data-state={state}
                          aria-pressed={selected === node.skill}
                          aria-controls={detailId}
                          onClick={() => setSelected(node.skill)}
                        >
                          <span className="skill-path-symbol">
                            <Icon size={28} aria-hidden="true" />
                          </span>
                          <span className="skill-path-copy">
                            <strong>{node.skill}</strong>
                            <span className="skill-path-state">
                              {stateLabel(node)}
                            </span>
                            <span className="skill-path-count">
                              {node.total
                                ? `Верных результатов: ${node.correct} из ${node.total}`
                                : node.evidence_count
                                  ? "Проверки пока без оценки"
                                  : "Подтверждённых результатов пока нет"}
                            </span>
                            {!!parents.length && (
                              <span className="skill-path-parents">
                                После: {parents.join(", ")}
                              </span>
                            )}
                          </span>
                          <ChevronRight size={20} aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
          <div
            className="skill-path-detail"
            id={detailId}
            aria-live="polite"
            aria-atomic="true"
          >
            {current ? (
              <>
                <h3>{current.skill}</h3>
                <p>
                  {current.total
                    ? `Верных результатов: ${current.correct} из ${current.total}. Последняя проверка: ${labels[current.latest] || current.latest}.`
                    : current.evidence_count
                      ? "Преподаватель пока не смог оценить ответы по этому навыку."
                      : "Преподаватель ещё не подтвердил результаты по этому навыку."}
                </p>
                <p className="journey-note">
                  Это результаты проверенных заданий, а не доля освоенной
                  программы. Следующий шаг выбирает преподаватель.
                </p>
                {!!current.evidence_count && !evidence && (
                  <div className="journey-message">
                    <p>
                      История проверок изменилась или не сопоставлена с навыком.
                      Обнови путь, чтобы увидеть согласованные данные.
                    </p>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => setRetry((value) => value + 1)}
                    >
                      Обновить путь
                    </button>
                  </div>
                )}
                {!!evidence?.length && (
                  <ul
                    className="skill-path-evidence"
                    aria-label={`Проверки по навыку ${current.skill}`}
                  >
                    {evidence.map((item) => (
                      <li key={item.id}>
                        <strong>{item.assignment_title}</strong>
                        <span>
                          {labels[item.correctness] || item.correctness} ·{" "}
                          {date(item.created)}
                        </span>
                        <span className="journey-note">
                          {item.review_action === "corrected"
                            ? "Проверка исправлена преподавателем"
                            : "Результат подтверждён преподавателем"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p>Выбери навык, чтобы посмотреть подтверждённые результаты.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
