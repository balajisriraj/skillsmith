import { useEffect, useState } from "react";
import { api, type SessionSummary } from "./api";
import { navigate } from "./router";

export function Home() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [examples, setExamples] = useState<{ id: string; title: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.list().then(setSessions).catch(() => setError("The SkillSmith API isn't reachable."));
    api.examples().then(setExamples).catch(() => {});
  }, []);

  const open = async (label: string, go: () => Promise<{ id: string }>) => {
    setBusy(label);
    setError(null);
    try {
      navigate(`/s/${(await go()).id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  return (
    <main className="page home">
      <section className="hero">
        <span className="label">Fig. 1 · From know-how to a tested skill</span>
        <h1>
          Turn know-how into
          <br />
          <span className="outline">agent skills.</span>
        </h1>
        <p className="lede">
          Describe a workflow you know well. SkillSmith interviews you, drafts an Agent Skill, lints it against the format,
          tests it against realistic requests and near-misses, fixes what fails, and hands you a bundle ready for Claude.
        </p>
        <div className="actions">
          <button className="btn orange big" disabled={!!busy} onClick={() => open("new", api.create)}>
            {busy === "new" ? "Opening…" : "Start an interview →"}
          </button>
        </div>
        <div className="flow" aria-hidden="true">
          {["Interview", "Draft", "Lint", "Test", "Fix", "Package"].map((s, i) => (
            <span key={s}>
              <b>{String(i + 1).padStart(2, "0")}</b>
              {s}
            </span>
          ))}
        </div>
      </section>

      <section className="examples">
        <span className="label">Or load a worked interview</span>
        <div className="cards">
          {examples.map((e) => (
            <button key={e.id} className="card" disabled={!!busy} onClick={() => open(e.id, () => api.example(e.id))}>
              <span className="label">Example</span>
              <b>{busy === e.id ? "Interviewing…" : e.title}</b>
            </button>
          ))}
        </div>
      </section>
      {error && <p className="error">{error}</p>}

      {sessions.length > 0 && (
        <section className="register">
          <span className="label">Drawing register</span>
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Skill</th>
                <th>Started</th>
                <th>Tests</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <tr key={s.id} onClick={() => navigate(`/s/${s.id}`)}>
                  <td>SS-{String(sessions.length - i).padStart(3, "0")}</td>
                  <td>
                    <b>{s.name || s.title}</b>
                  </td>
                  <td>{new Date(s.created).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</td>
                  <td>{s.score === null ? (s.ready ? "ready to forge" : "interviewing") : `${Math.round(s.score * 100)}% pass`}</td>
                  <td>
                    <button
                      className="link"
                      onClick={(e) => {
                        e.stopPropagation();
                        api.remove(s.id).then(() => setSessions((xs) => xs.filter((x) => x.id !== s.id)));
                      }}
                    >
                      delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
