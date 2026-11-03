// The SkillSmith loop: interview → draft → lint → test → fix, until the skill passes or rounds run out.
//
//   interview ──> brief ──> draft ──> lint ─┬─(errors)──> fix ──┐
//                                           └─> test ─┬─ pass ──> package
//                                                     └─ fail ──> fix ──> lint …
import {
  type Brief,
  type CaseResult,
  Draft,
  Grade,
  hasErrors,
  InterviewTurn,
  lint,
  Pick,
  type Round,
  safePath,
  type SkillFile,
  skillMeta,
  slug,
  type TestCase,
  TestPlan,
} from "@skillsmith/core";
import type { Config } from "./config.ts";
import type { LLM, Message } from "./llm.ts";

const STYLE = "British spelling. Never use em dashes; use a plain hyphen.";

export const INTERVIEWER = `You are SkillSmith's interviewer. You help someone turn a workflow they know well into an Agent Skill: a folder with a SKILL.md that teaches Claude to do the task their way.
Interview like a sharp colleague: one question at a time, concrete, building on what they said. Cover, in roughly this order: what the skill is for, when it should and should not be used, what the user provides, the steps, what a finished result looks like, the quality bar, and a worked example if they have one.
Keep every reply under 60 words. Update the brief with everything learnt so far, keeping earlier answers. Set ready when purpose, triggers, steps and outputs are clear. ${STYLE}`;

export const DRAFTER = `You write Agent Skills. A skill is a folder whose SKILL.md has YAML frontmatter (name, description) and markdown instructions, plus optional reference files and scripts.
Rules:
- name: lowercase letters, numbers and hyphens, at most 64 characters, never "anthropic" or "claude".
- description: third person, at most 1024 characters, says what the skill does AND when to use it, including the words a user would actually say. This is the only text Claude sees when deciding to load the skill, so make it specific. Mention near-misses it is not for when they could be confused.
- Body: concise and imperative, under 500 lines. Lead with the workflow as numbered steps, then the output format, then the quality checklist. Assume Claude is capable; don't explain what it already knows.
- Progressive disclosure: put long examples, templates or reference material in files like reference/examples.md and link to them from SKILL.md with relative markdown links. Only add a script when a step needs deterministic code.
- Every bundled file must be linked from SKILL.md. ${STYLE}`;

export const TESTER = `You write test cases for an Agent Skill. Include realistic user messages that should trigger it, phrased the way people actually ask (not copied from the description), and at least two near-misses that sound related but should not trigger it. For triggering cases, list checkable expectations drawn from the skill's steps, output format and quality bar.`;

export const PICKER = `You route a user's message to at most one skill. You see only each skill's name and description, exactly as Claude would. Pick the single skill whose description clearly fits the request, or "none" if no skill fits well.`;

export const JUDGE = `You grade an answer against expectations. For each expectation, decide strictly whether the answer meets it and quote the evidence (or say what is missing).`;

/** Realistic neighbours the new skill competes with when Claude decides what to load. */
export const DISTRACTORS: SkillFile[] = [
  ["pdf", "Extract text and tables from PDF files, fill forms and merge documents. Use when working with PDF files or when the user mentions PDFs or forms."],
  ["xlsx", "Create and edit spreadsheets with formulas, formatting and charts. Use when the user asks for Excel files, spreadsheets or tabular analysis."],
  ["meeting-minutes", "Turns meeting transcripts into minutes with decisions, owners and action items. Use when the user shares a meeting transcript or call notes."],
  ["code-review", "Reviews code changes for bugs, security issues and style. Use when the user shares a diff or pull request or asks for a code review."],
  ["travel-planner", "Plans trips with itineraries, bookings and budgets. Use when the user is planning travel or asks for an itinerary."],
].map(([name, description]) => ({ path: name, content: description }));

export type ForgeEvent =
  | { type: "stage"; stage: "draft" | "lint" | "test" | "fix" | "package"; round: number; detail?: string }
  | { type: "files"; round: number; files: SkillFile[]; notes: string }
  | { type: "lint"; round: number; issues: ReturnType<typeof lint> }
  | { type: "plan"; round: number; cases: TestCase[] }
  | { type: "case"; round: number; result: CaseResult }
  | { type: "round"; round: Round }
  | { type: "done"; best: number; rounds: number; score: number }
  | { type: "error"; message: string };

const briefText = (b: Brief) => JSON.stringify(b, null, 2);
const filesText = (files: SkillFile[]) => files.map((f) => `<file path="${f.path}">\n${f.content}\n</file>`).join("\n\n");

export class Forge {
  constructor(
    private readonly llm: LLM,
    private readonly cfg: Config,
  ) {}

  // ── interview ──
  async interview(messages: Message[], brief: Brief): Promise<InterviewTurn> {
    const context: Message[] = [
      { role: "user", content: `Current brief:\n${briefText(brief)}` },
      { role: "assistant", content: "Understood. I'll keep the brief updated." },
      ...messages,
    ];
    const turn = await this.llm.structured(INTERVIEWER, context, InterviewTurn, this.cfg.effort.interview);
    turn.brief.name = slug(turn.brief.name || turn.brief.purpose).replace(/(anthropic|claude)/g, "x");
    return turn;
  }

  // ── draft and fix ──
  private async draft(brief: Brief, previous?: { files: SkillFile[]; feedback: string }): Promise<Draft> {
    const ask = previous
      ? `Revise this skill to fix the problems found in testing. Keep what works.\n\n<brief>\n${briefText(brief)}\n</brief>\n\n<current_skill>\n${filesText(previous.files)}\n</current_skill>\n\n<problems>\n${previous.feedback}\n</problems>`
      : `Write the skill for this brief. Use "${brief.name}" as the name.\n\n<brief>\n${briefText(brief)}\n</brief>`;
    const draft = await this.llm.structured(DRAFTER, [{ role: "user", content: ask }], Draft, this.cfg.effort.draft);
    // Model output names the files, so every path is confined to the skill folder before it's kept.
    draft.files = draft.files.flatMap((f) => {
      const p = safePath(f.path);
      return p ? [{ path: p, content: f.content }] : [];
    });
    return draft;
  }

  // ── test ──
  async plan(brief: Brief, files: SkillFile[]): Promise<TestCase[]> {
    const ask = `<brief>\n${briefText(brief)}\n</brief>\n\n<skill>\n${filesText(files.filter((f) => f.path === "SKILL.md"))}\n</skill>`;
    return (await this.llm.structured(TESTER, [{ role: "user", content: ask }], TestPlan, this.cfg.effort.test)).cases;
  }

  async runCase(files: SkillFile[], c: TestCase): Promise<CaseResult> {
    const meta = skillMeta(files);
    const catalogue = [{ path: meta.name, content: meta.description }, ...DISTRACTORS]
      .map((s) => `- ${s.path}: ${s.content}`)
      .join("\n");
    const pick = await this.llm.structured(
      PICKER,
      [{ role: "user", content: `<skills>\n${catalogue}\n</skills>\n\n<message>${c.prompt}</message>` }],
      Pick,
      this.cfg.effort.test,
    );
    const triggered = pick.skill.trim().toLowerCase() === meta.name;
    const result: CaseResult = { id: c.id, prompt: c.prompt, should_trigger: c.should_trigger, picked: pick.skill, triggered, trigger_ok: triggered === c.should_trigger, passed: false };
    if (!c.should_trigger || !triggered) {
      result.passed = result.trigger_ok;
      return result;
    }
    // Behaviour: answer with the skill loaded the way Claude loads it (SKILL.md plus linked files).
    const system = `The skill "${meta.name}" is loaded. Follow it exactly.\n\n${filesText(files)}`;
    result.output = await this.llm.text(system, [{ role: "user", content: c.prompt }], this.cfg.effort.test);
    const grade = await this.llm.structured(
      JUDGE,
      [{ role: "user", content: `<expectations>\n${c.expectations.map((e) => `- ${e}`).join("\n")}\n</expectations>\n\n<answer>\n${result.output}\n</answer>` }],
      Grade,
      this.cfg.effort.judge,
    );
    result.grades = grade.results;
    result.passed = result.trigger_ok && grade.results.every((g) => g.passed);
    return result;
  }

  private feedback(issues: ReturnType<typeof lint>, results: CaseResult[]): string {
    const lines = issues.filter((i) => i.level === "error").map((i) => `- Lint (${i.rule}): ${i.message}`);
    for (const r of results.filter((x) => !x.passed)) {
      if (!r.trigger_ok)
        lines.push(
          r.should_trigger
            ? `- Not picked for "${r.prompt}" (picked ${r.picked}). The description needs to cover this phrasing.`
            : `- Wrongly picked for "${r.prompt}", which it should not handle. Narrow the description.`,
        );
      for (const g of r.grades?.filter((x) => !x.passed) ?? []) lines.push(`- For "${r.prompt}": expected "${g.expectation}". ${g.evidence}`);
    }
    return lines.join("\n");
  }

  // ── the loop ──
  async *run(brief: Brief): AsyncGenerator<ForgeEvent> {
    const rounds: Round[] = [];
    let cases: TestCase[] = [];
    let previous: { files: SkillFile[]; feedback: string } | undefined;

    for (let n = 1; n <= this.cfg.maxRounds; n++) {
      yield { type: "stage", stage: n === 1 ? "draft" : "fix", round: n };
      const draft = await this.draft(brief, previous);
      yield { type: "files", round: n, files: draft.files, notes: draft.notes };

      yield { type: "stage", stage: "lint", round: n };
      const issues = lint(draft.files);
      yield { type: "lint", round: n, issues };

      const results: CaseResult[] = [];
      if (!hasErrors(issues)) {
        yield { type: "stage", stage: "test", round: n };
        if (!cases.length) {
          // One fixed test plan for every round, so scores are comparable and fixes can't game new tests.
          cases = await this.plan(brief, draft.files);
          yield { type: "plan", round: n, cases };
        }
        for (const c of cases) {
          const r = await this.runCase(draft.files, c);
          results.push(r);
          yield { type: "case", round: n, result: r };
        }
      }
      const score = results.length ? results.filter((r) => r.passed).length / results.length : 0;
      const round: Round = { round: n, files: draft.files, lint: issues, results, score };
      rounds.push(round);
      yield { type: "round", round };
      if (score === 1) break;
      previous = { files: draft.files, feedback: this.feedback(issues, results) };
    }

    const best = rounds.reduce((b, r, i) => (r.score > rounds[b].score ? i : b), 0);
    yield { type: "stage", stage: "package", round: rounds[best].round };
    yield { type: "done", best: rounds[best].round, rounds: rounds.length, score: rounds[best].score };
  }
}
