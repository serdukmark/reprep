import { ChoiceSelect } from "./ChoiceSelect";
import { useEffect, useId, useState } from "react";
import { api, labels } from "./api";
import { useUnsaved } from "./components";

type Edge = { prerequisite: string; skill: string };
type Node = {
  skill: string;
  latest: string;
  correct: number;
  total: number;
  evidence_count: number;
  prerequisites_confirmed: boolean;
};
type Graph = {
  revision: number;
  skills: string[];
  edges: Edge[];
  nodes: Node[];
  available_skills: string[];
  note: string;
};
export function SkillGraph({
  relationship,
  tutor,
}: {
  relationship: string;
  tutor: boolean;
}) {
  const [data, setData] = useState<Graph | null>(null),
    [names, setNames] = useState(""),
    [edges, setEdges] = useState<Edge[]>([]);
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const marker = useId().replaceAll(":", "");
  useUnsaved(
    !!data &&
      tutor &&
      (names !== data.skills.join("\n") ||
        JSON.stringify(edges) !== JSON.stringify(data.edges)),
  );
  useEffect(() => {
    let live = true;
    api<Graph>(`/relationships/${relationship}/skill-graph`)
      .then((value) => {
        if (live) {
          setData(value);
          setNames(value.skills.join("\n"));
          setEdges(value.edges);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [relationship]);
  const skills = names
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const levels = new Map<string, number>();
  for (let i = 0; i < (data?.skills.length || 0); i++)
    for (const skill of data!.skills) {
      const parents = data!.edges
        .filter((e) => e.skill === skill)
        .map((e) => e.prerequisite);
      if (parents.every((p) => levels.has(p)))
        levels.set(
          skill,
          parents.length
            ? Math.max(...parents.map((p) => levels.get(p)!)) + 1
            : 0,
        );
    }
  const count = new Map<number, number>(),
    positions = new Map<string, { x: number; y: number }>();
  for (const node of data?.nodes || []) {
    const level = levels.get(node.skill) || 0,
      row = count.get(level) || 0;
    count.set(level, row + 1);
    positions.set(node.skill, { x: 20 + level * 230, y: 20 + row * 95 });
  }
  const width = Math.max(480, (Math.max(0, ...levels.values()) + 1) * 230),
    height = Math.max(130, Math.max(0, ...count.values()) * 95 + 30);
  const current = data?.nodes.find((n) => n.skill === selected);
  async function save() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const value = await api<Graph>(
        `/relationships/${relationship}/skill-graph`,
        "PUT",
        { revision: data!.revision, skills, edges },
      );
      setData(value);
      setNames(value.skills.join("\n"));
      setEdges(value.edges);
      setNotice("Граф сохранён");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <h2>Граф навыков</h2>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {!data && !error && <p>Загружаем граф…</p>}
      {data && (
        <>
          <p>{data.note}</p>
          {!data.nodes.length && <p>Связи навыков ещё не заданы.</p>}
          {!!data.nodes.length && (
            <div style={{ overflowX: "auto" }}>
              <svg
                role="group"
                aria-label="Сохранённый граф навыков"
                width={width}
                height={height}
              >
                <defs>
                  <marker
                    id={marker}
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0 0 L8 4 L0 8" fill="#718269" />
                  </marker>
                </defs>
                {data.edges.map((edge, i) => {
                  const a = positions.get(edge.prerequisite)!,
                    b = positions.get(edge.skill)!;
                  return (
                    <path
                      key={i}
                      d={`M${a.x + 190},${a.y + 34} C${a.x + 220},${a.y + 34} ${b.x - 30},${b.y + 34} ${b.x},${b.y + 34}`}
                      fill="none"
                      stroke="#718269"
                      markerEnd={`url(#${marker})`}
                    />
                  );
                })}
                {data.nodes.map((node) => {
                  const p = positions.get(node.skill)!;
                  return (
                    <g
                      key={node.skill}
                      role="button"
                      tabIndex={0}
                      aria-label={`Навык ${node.skill}: ${labels[node.latest] || node.latest}`}
                      onClick={() => setSelected(node.skill)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(node.skill);
                        }
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <rect
                        x={p.x}
                        y={p.y}
                        width={190}
                        height={68}
                        rx={10}
                        fill={node.latest === "correct" ? "#e3eedc" : "#f4f1e9"}
                        stroke={selected === node.skill ? "#446f3d" : "#d2d7c9"}
                      />
                      <text
                        x={p.x + 12}
                        y={p.y + 24}
                        fontSize={13}
                        fill="#25302a"
                      >
                        {node.skill.length > 24
                          ? node.skill.slice(0, 22) + "…"
                          : node.skill}
                      </text>
                      <text
                        x={p.x + 12}
                        y={p.y + 47}
                        fontSize={12}
                        fill="#52624b"
                      >
                        {labels[node.latest] || node.latest}
                      </text>
                      <title>{node.skill}</title>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
          {current && (
            <p>
              <strong>{current.skill}</strong>: верных {current.correct} из{" "}
              {current.total}; подтверждений {current.evidence_count}.{" "}
              {!data.edges.some((edge) => edge.skill === current.skill)
                ? "Для этого навыка предпосылки не заданы."
                : current.prerequisites_confirmed
                  ? "Последние результаты по предпосылкам верны. Следующий шаг выбирает преподаватель."
                  : "Не все предпосылки подтверждены последней проверкой."}
            </p>
          )}
          {tutor && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <label>
                Навыки графа (каждый с новой строки)
                <textarea
                  disabled={busy}
                  value={names}
                  onChange={(e) => setNames(e.target.value)}
                />
              </label>
              {!!data.available_skills.length && (
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    setNames(
                      [...new Set([...skills, ...data.available_skills])].join(
                        "\n",
                      ),
                    )
                  }
                >
                  Добавить навыки из проверенной истории
                </button>
              )}
              <div className="form-grid">
                <label>
                  Сначала навык
                  <ChoiceSelect
                    disabled={busy}
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  >
                    <option value="">Выберите</option>
                    {skills.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </ChoiceSelect>
                </label>
                <label>
                  Затем навык
                  <ChoiceSelect
                    disabled={busy}
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  >
                    <option value="">Выберите</option>
                    {skills.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </ChoiceSelect>
                </label>
              </div>
              <button
                type="button"
                className="secondary"
                disabled={busy || !from || !to || from === to}
                onClick={() => {
                  if (
                    !edges.some(
                      (e) => e.prerequisite === from && e.skill === to,
                    )
                  )
                    setEdges([...edges, { prerequisite: from, skill: to }]);
                }}
              >
                Добавить связь
              </button>
              {edges.map((edge, i) => (
                <div className="form-actions" key={i}>
                  <span>
                    {edge.prerequisite} → {edge.skill}
                  </span>
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() => setEdges(edges.filter((_, j) => j !== i))}
                  >
                    Удалить связь
                  </button>
                </div>
              ))}
              <p>
                Связь означает предложенную вами предпосылку. Циклы запрещены;
                при переименовании навыка поправьте его связи.
              </p>
              <button className="primary" disabled={busy}>
                Сохранить граф
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
