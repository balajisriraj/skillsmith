import type { Brief } from "@skillsmith/core";
import { useEffect, useState } from "react";

const FIELDS: { key: keyof Brief; label: string; list?: boolean; hint: string }[] = [
  { key: "purpose", label: "Purpose", hint: "What the skill lets Claude do" },
  { key: "triggers", label: "Use when", list: true, hint: "Situations and phrasings" },
  { key: "not_for", label: "Not for", list: true, hint: "Near-misses to reject" },
  { key: "inputs", label: "Inputs", list: true, hint: "What the user provides" },
  { key: "steps", label: "Steps", list: true, hint: "The workflow, in order" },
  { key: "outputs", label: "Output", hint: "What done looks like" },
  { key: "quality_bar", label: "Quality bar", list: true, hint: "Rules every result follows" },
];

function Gauge({ value }: { value: number }) {
  const r = 34, c = 2 * Math.PI * r;
  return (
    <svg className="gauge" viewBox="0 0 90 90" role="img" aria-label={`Brief ${value}% complete`}>
      <circle cx="45" cy="45" r={r} className="track" />
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * 2 * Math.PI;
        return <line key={i} x1={45 + Math.cos(a) * 40} y1={45 + Math.sin(a) * 40} x2={45 + Math.cos(a) * (i % 6 ? 42 : 44)} y2={45 + Math.sin(a) * (i % 6 ? 42 : 44)} />;
      })}
      <circle cx="45" cy="45" r={r} className="fill" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform="rotate(-90 45 45)" />
      <text x="45" y="50">{value}%</text>
    </svg>
  );
}

export function SpecSheet({ brief, completeness, onSave }: { brief: Brief; completeness: number; onSave: (b: Brief) => Promise<void> }) {
  const [editing, setEditing] = useState<keyof Brief | null>(null);
  const [draft, setDraft] = useState("");
  useEffect(() => setEditing(null), [brief]);

  const commit = async () => {
    if (!editing) return;
    const field = FIELDS.find((f) => f.key === editing)!;
    const value = field.list ? draft.split("\n").map((l) => l.trim()).filter(Boolean) : draft.trim();
    await onSave({ ...brief, [editing]: value });
    setEditing(null);
  };

  return (
    <section className="sheet">
      <header className="sheet-head">
        <div>
          <span className="label">Spec sheet</span>
          <h2>{brief.name || "untitled-skill"}</h2>
        </div>
        <Gauge value={completeness} />
      </header>
      <dl>
        {FIELDS.map((f) => {
          const v = brief[f.key] as string | string[];
          const empty = Array.isArray(v) ? !v.length : !v;
          return (
            <div key={f.key} className={`row ${empty ? "empty" : "set"}`}>
              <dt>
                <span className="tick">{empty ? "○" : "●"}</span>
                {f.label}
              </dt>
              <dd>
                {editing === f.key ? (
                  <div className="edit">
                    <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={f.list ? 5 : 3} placeholder={f.list ? "One per line" : f.hint} />
                    <div>
                      <button className="btn small" onClick={commit}>
                        Save
                      </button>
                      <button className="link" onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="value"
                    onClick={() => {
                      setEditing(f.key);
                      setDraft(Array.isArray(v) ? v.join("\n") : v);
                    }}
                    title="Edit"
                  >
                    {empty ? <i>{f.hint}</i> : Array.isArray(v) ? <ul>{v.map((x, i) => <li key={i}>{x}</li>)}</ul> : v}
                  </button>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
