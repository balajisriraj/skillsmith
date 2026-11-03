import { describe, expect, it } from "vitest";
import { parseSSE } from "./api";
import { initial, reduce } from "./forgeState";

describe("forge state", () => {
  it("builds rounds from streamed events", () => {
    let s = reduce(initial, { type: "stage", stage: "draft", round: 1 });
    s = reduce(s, { type: "files", round: 1, files: [{ path: "SKILL.md", content: "x" }], notes: "n" });
    s = reduce(s, { type: "lint", round: 1, issues: [] });
    s = reduce(s, { type: "plan", round: 1, cases: [{ id: "a", prompt: "p", should_trigger: true, expectations: [] }] });
    s = reduce(s, { type: "case", round: 1, result: { id: "a", prompt: "p", should_trigger: true, picked: "x", triggered: true, trigger_ok: true, passed: true } });
    s = reduce(s, { type: "round", round: { round: 1, files: [], lint: [], results: [], score: 1 } });
    s = reduce(s, { type: "done", best: 1, rounds: 1, score: 1 });
    expect(s.running).toBe(false);
    expect(s.best).toBe(1);
    expect(s.rounds[0]).toMatchObject({ round: 1, notes: "n", score: 1 });
    expect(s.rounds[0].results).toHaveLength(1);
  });
  it("records errors", () => {
    expect(reduce(initial, { type: "error", message: "boom" })).toMatchObject({ running: false, error: "boom" });
  });
  it("parses SSE frames", () => {
    const got: unknown[] = [];
    expect(parseSSE('data: {"type":"done"}\n\ndata: {', (e) => got.push(e))).toBe("data: {");
    expect(got).toEqual([{ type: "done" }]);
  });
});
