import { useEffect, useReducer, useRef, useState } from "react";
import { api, type Session } from "./api";
import { ForgeBench } from "./components/ForgeBench";
import { SpecSheet } from "./components/SpecSheet";
import { initial, reduce, type RoundView } from "./forgeState";
import { navigate } from "./router";

/** Restore a finished forge from the saved session, so reloading shows the last result. */
function restored(s: Session) {
  if (!s.rounds.length) return initial;
  const rounds: RoundView[] = s.rounds.map((r) => ({ round: r.round, files: r.files, notes: "", lint: r.lint, results: r.results, score: r.score }));
  const cases = s.rounds.flatMap((r) => r.results).reduce<{ id: string; prompt: string; should_trigger: boolean; expectations: string[] }[]>(
    (acc, r) => (acc.some((c) => c.id === r.id) ? acc : [...acc, { id: r.id, prompt: r.prompt, should_trigger: r.should_trigger, expectations: [] }]),
    [],
  );
  return { ...initial, rounds, cases, best: s.best, stage: "done" };
}

export function SessionView({ id }: { id: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [missing, setMissing] = useState(false);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"spec" | "forge">("spec");
  const [forge, dispatch] = useReducer(reduce, initial);
  const [restoredState, setRestored] = useState(initial);
  const log = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    api
      .get(id)
      .then((s) => {
        setSession(s);
        setRestored(restored(s));
        if (s.rounds.length) setTab("forge");
      })
      .catch(() => setMissing(true));
    return () => abort.current?.abort();
  }, [id]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
  }, [session?.messages.length, thinking]);

  if (missing)
    return (
      <main className="page center">
        <h1>Drawing not found.</h1>
        <button className="btn" onClick={() => navigate("/")}>
          Back to the register
        </button>
      </main>
    );
  if (!session) return <main className="page center label">Loading drawing…</main>;

  const say = async () => {
    const text = draft.trim();
    if (!text || thinking) return;
    setDraft("");
    setThinking(true);
    setError(null);
    setSession({ ...session, messages: [...session.messages, { role: "user", content: text }] });
    try {
      setSession(await api.say(session.id, text));
    } catch (e) {
      setError((e as Error).message);
      setSession(session);
      setDraft(text);
    } finally {
      setThinking(false);
    }
  };

  const startForge = async () => {
    setTab("forge");
    setRestored(initial);
    abort.current = new AbortController();
    dispatch({ type: "stage", stage: "draft", round: 1 });
    try {
      await api.forge(session.id, dispatch, abort.current.signal);
      setSession(await api.get(session.id));
    } catch (e) {
      dispatch({ type: "error", message: (e as Error).message });
    }
  };

  const state = forge.rounds.length || forge.running || forge.error ? forge : restoredState;
  const canForge = !!session.brief.purpose && session.brief.steps.length > 0 && !forge.running;

  return (
    <main className="page session">
      <section className="interview">
        <header>
          <button className="link" onClick={() => navigate("/")}>
            ← Register
          </button>
          <span className="label">Interview</span>
        </header>
        <div className="log" ref={log}>
          {session.messages.map((m, i) => (
            <p key={i} className={m.role}>
              {m.content}
            </p>
          ))}
          {thinking && <p className="assistant pencil">sketching…</p>}
        </div>
        {error && <p className="error">{error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            say();
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                say();
              }
            }}
            placeholder="Answer, or describe your workflow…"
            rows={3}
            aria-label="Your answer"
          />
          <button className="btn" disabled={!draft.trim() || thinking}>
            Send
          </button>
        </form>
      </section>

      <section className="workspace">
        <nav className="tabs">
          <button className={tab === "spec" ? "on" : ""} onClick={() => setTab("spec")}>
            A · Spec sheet
          </button>
          <button className={tab === "forge" ? "on" : ""} onClick={() => setTab("forge")}>
            B · Forge bench
          </button>
          <button className="btn orange forge-btn" disabled={!canForge} onClick={startForge} title={canForge ? "Draft, lint, test and fix" : "The brief needs a purpose and steps first"}>
            {forge.running ? "Forging…" : state.rounds.length ? "Re-forge" : session.ready ? "Forge the skill →" : "Forge early"}
          </button>
        </nav>
        {tab === "spec" ? (
          <SpecSheet
            brief={session.brief}
            completeness={session.completeness}
            onSave={async (b) => setSession(await api.saveBrief(session.id, b))}
          />
        ) : state.rounds.length || state.running || state.error ? (
          <ForgeBench state={state} sessionId={session.id} name={session.brief.name || "skill"} />
        ) : (
          <div className="empty-bench">
            <p>Nothing forged yet. When the spec sheet is complete, forge the skill: SkillSmith drafts it, lints it against the Agent Skills format, generates tests (including near-misses), runs them, and fixes what fails.</p>
          </div>
        )}
      </section>
    </main>
  );
}
