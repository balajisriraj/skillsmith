// Forges every worked example end to end and reports how the loop did.
// Run: pnpm eval  (SKILLSMITH_LLM=scripted for offline, or with ANTHROPIC_API_KEY for Claude)
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hasErrors } from "@skillsmith/core";
import { config } from "./config.ts";
import { EXAMPLES } from "./examples.ts";
import { makeLLM } from "./llm.ts";
import { createApp } from "./server.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = async (r: Response | Promise<Response>): Promise<any> => (await r).json();

const app = createApp({ ...config, dataDir: mkdtempSync(join(tmpdir(), "skillsmith-eval-")) }, await makeLLM(config));
let ok = true;

for (const ex of EXAMPLES) {
  const session = await json(app.request(`/api/sessions/example/${ex.id}`, { method: "POST" }));
  const text = await (await app.request(`/api/sessions/${session.id}/forge`, { method: "POST" })).text();
  const events = text.split("\n").filter((l) => l.startsWith("data:")).map((l) => JSON.parse(l.slice(5)));
  const rounds = events.filter((e) => e.type === "round").map((e) => e.round);
  const done = events.find((e) => e.type === "done");
  const best = rounds[done.best - 1];
  const neg = best.results.filter((r: { should_trigger: boolean }) => !r.should_trigger);
  const pos = best.results.filter((r: { should_trigger: boolean }) => r.should_trigger);
  const passed = done.score === 1 && !hasErrors(best.lint) && neg.every((r: { triggered: boolean }) => !r.triggered);
  ok &&= passed;
  console.log(`${passed ? "PASS" : "FAIL"}  ${ex.title}`);
  console.log(`      brief ${session.completeness}% · rounds ${rounds.map((r: { score: number }) => `${Math.round(r.score * 100)}%`).join(" → ")}`);
  console.log(`      triggers ${pos.filter((r: { triggered: boolean }) => r.triggered).length}/${pos.length} · near-misses rejected ${neg.filter((r: { triggered: boolean }) => !r.triggered).length}/${neg.length} · lint ${best.lint.length ? best.lint.map((i: { rule: string }) => i.rule).join(", ") : "clean"}`);
}
process.exit(ok ? 0 : 1);
