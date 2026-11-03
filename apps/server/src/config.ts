import { resolve } from "node:path";

const env = process.env;
const ROOT = resolve(import.meta.dirname, "..");

export const config = {
  llm: (env.SKILLSMITH_LLM ?? "anthropic") as "anthropic" | "scripted",
  model: env.SKILLSMITH_MODEL ?? "claude-opus-5-5",
  scriptedDelay: Number(env.SKILLSMITH_SCRIPTED_DELAY ?? 0),
  dataDir: resolve(env.SKILLSMITH_DATA_DIR ?? resolve(ROOT, "data")),
  port: Number(env.PORT ?? 8000),
  maxRounds: Number(env.SKILLSMITH_MAX_ROUNDS ?? 3),
  // Live runs upload the skill to the Skills API and execute a test on Claude, then delete it.
  liveRuns: env.SKILLSMITH_LIVE_RUNS === "true",
  effort: { interview: "low", draft: "medium", test: "low", judge: "low" } as const,
};
export type Config = typeof config;
