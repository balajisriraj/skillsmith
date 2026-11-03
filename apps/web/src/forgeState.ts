import type { CaseResult, LintIssue, SkillFile, TestCase } from "@skillsmith/core";
import type { ForgeEvent } from "./api";

export type RoundView = { round: number; files: SkillFile[]; notes: string; lint: LintIssue[]; results: CaseResult[]; score: number | null };
export type ForgeState = {
  running: boolean;
  stage: string | null;
  round: number;
  cases: TestCase[];
  rounds: RoundView[];
  best: number | null;
  error: string | null;
};

export const initial: ForgeState = { running: false, stage: null, round: 0, cases: [], rounds: [], best: null, error: null };

const upsert = (rounds: RoundView[], n: number, patch: Partial<RoundView>) => {
  const existing = rounds.find((r) => r.round === n) ?? { round: n, files: [], notes: "", lint: [], results: [], score: null };
  return [...rounds.filter((r) => r.round !== n), { ...existing, ...patch }].sort((a, b) => a.round - b.round);
};

/** Fold one streamed forge event into the view state. */
export function reduce(s: ForgeState, e: ForgeEvent): ForgeState {
  switch (e.type) {
    case "stage":
      return { ...s, running: true, stage: e.stage, round: e.round };
    case "files":
      return { ...s, rounds: upsert(s.rounds, e.round, { files: e.files, notes: e.notes }) };
    case "lint":
      return { ...s, rounds: upsert(s.rounds, e.round, { lint: e.issues }) };
    case "plan":
      return { ...s, cases: e.cases };
    case "case": {
      const r = s.rounds.find((x) => x.round === e.round);
      return { ...s, rounds: upsert(s.rounds, e.round, { results: [...(r?.results ?? []).filter((x) => x.id !== e.result.id), e.result] }) };
    }
    case "round":
      return { ...s, rounds: upsert(s.rounds, e.round.round, { score: e.round.score }) };
    case "done":
      return { ...s, running: false, stage: "done", best: e.best };
    case "error":
      return { ...s, running: false, error: e.message };
  }
}
