import { lint, type SkillFile, splitFrontmatter } from "@skillsmith/core";
import { useMemo, useState } from "react";
import type { ForgeState, RoundView } from "../forgeState";

const STAGES = ["draft", "lint", "test", "fix", "package"] as const;

function Schematic({ state }: { state: ForgeState }) {
  const at = state.stage === "done" ? STAGES.length : STAGES.indexOf((state.stage ?? "") as (typeof STAGES)[number]);
  return (
    <ol className="schematic" aria-label="Forge stages">
      {STAGES.map((s, i) => (
        <li key={s} className={i < at ? "done" : i === at && state.running ? "now" : ""}>
          <span className="node">{String(i + 1).padStart(2, "0")}</span>
          <b>{s}</b>
          {s === "fix" && state.round > 1 && <em>round {state.round}</em>}
        </li>
      ))}
    </ol>
  );
}

function Matrix({ state }: { state: ForgeState }) {
  if (!state.cases.length) return null;
  return (
    <div className="matrix-wrap">
      <table className="matrix">
        <thead>
          <tr>
            <th>Test case</th>
            <th>Should load</th>
            {state.rounds.map((r) => (
              <th key={r.round}>R{r.round}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {state.cases.map((c) => (
            <tr key={c.id}>
              <td className="prompt">{c.prompt}</td>
              <td>{c.should_trigger ? "yes" : <span className="neg">near-miss</span>}</td>
              {state.rounds.map((r) => {
                const res = r.results.find((x) => x.id === c.id);
                if (!res) return <td key={r.round} className="cell pending">{r.lint.some((i) => i.level === "error") ? "lint" : "…"}</td>;
                const why = !res.trigger_ok
                  ? res.should_trigger ? `not loaded (picked ${res.picked})` : `wrongly loaded`
                  : res.grades?.filter((g) => !g.passed).map((g) => g.expectation).join("; ") || "ok";
                return (
                  <td key={r.round} className={`cell ${res.passed ? "pass" : "fail"}`} title={why}>
                    {res.passed ? "✓" : "✗"}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="totals">
            <td colSpan={2}>Score</td>
            {state.rounds.map((r) => (
              <td key={r.round}>{r.score === null ? "…" : `${Math.round(r.score * 100)}%`}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Files({ round, previous }: { round: RoundView; previous?: RoundView }) {
  const [open, setOpen] = useState("SKILL.md");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const files: SkillFile[] = round.files.map((f) => ({ ...f, content: edits[f.path] ?? f.content }));
  const file = files.find((f) => f.path === open) ?? files[0];
  // The same linter the server runs, live in the browser as you edit.
  const issues = useMemo(() => lint(files), [files]);
  const desc = (fs?: SkillFile[]) => String(splitFrontmatter(fs?.find((f) => f.path === "SKILL.md")?.content ?? "").data.description ?? "");
  const changed = previous && desc(previous.files) !== desc(round.files);

  if (!file) return null;
  return (
    <div className="files">
      <nav className="tree">
        <span className="label">Bundle</span>
        {files.map((f) => (
          <button key={f.path} className={f.path === file.path ? "on" : ""} onClick={() => setOpen(f.path)}>
            {f.path.includes("/") ? "└ " : ""}
            {f.path}
            {edits[f.path] !== undefined && " *"}
          </button>
        ))}
        <span className="label">Lint</span>
        {issues.length === 0 ? (
          <p className="ok">✓ Meets the Agent Skills format</p>
        ) : (
          <ul className="issues">
            {issues.map((i, k) => (
              <li key={k} className={i.level}>
                <b>{i.rule}</b> {i.message}
              </li>
            ))}
          </ul>
        )}
        {round.notes && (
          <>
            <span className="label">Drafter's note</span>
            <p className="note">{round.notes}</p>
          </>
        )}
      </nav>
      <div className="code">
        {changed && file.path === "SKILL.md" && (
          <div className="delta">
            <span className="label">Description changed since R{previous!.round}</span>
            <del>{desc(previous!.files)}</del>
            <ins>{desc(round.files)}</ins>
          </div>
        )}
        <textarea
          spellCheck={false}
          value={file.content}
          onChange={(e) => setEdits((x) => ({ ...x, [file.path]: e.target.value }))}
          aria-label={`Edit ${file.path}`}
          rows={Math.min(40, file.content.split("\n").length + 2)}
        />
      </div>
    </div>
  );
}

export function ForgeBench({ state, sessionId, name }: { state: ForgeState; sessionId: string; name: string }) {
  const [view, setView] = useState<number | null>(null);
  const shown = state.rounds.find((r) => r.round === (view ?? state.best ?? state.round)) ?? state.rounds.at(-1);
  const prev = shown && state.rounds.find((r) => r.round === shown.round - 1);

  return (
    <section className="bench">
      <Schematic state={state} />
      {state.error && <p className="error">{state.error}</p>}
      <Matrix state={state} />
      {shown && (
        <>
          <div className="rounds">
            {state.rounds.map((r) => (
              <button key={r.round} className={r.round === shown.round ? "on" : ""} onClick={() => setView(r.round)}>
                Round {r.round}
                {r.round === state.best && " · best"}
              </button>
            ))}
          </div>
          <Files key={shown.round} round={shown} previous={prev} />
        </>
      )}
      {state.best && !state.running && (
        <div className="ship">
          <a className="btn orange" href={`/api/sessions/${sessionId}/download`} download>
            Download {name}.zip
          </a>
          <dl className="targets">
            <div>
              <dt>Claude apps</dt>
              <dd>Upload the zip under Settings → Features.</dd>
            </div>
            <div>
              <dt>Claude Code</dt>
              <dd>
                <code>unzip {name}.zip -d ~/.claude/skills/</code>
              </dd>
            </div>
            <div>
              <dt>Claude API</dt>
              <dd>
                <code>client.skills.create(&#123; files &#125;)</code>, then mount it with <code>container.skills</code>.
              </dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
