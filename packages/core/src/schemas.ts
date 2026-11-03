// Shared by the server (to validate model output and requests) and the browser (to render and lint).
import { z } from "zod";

/** What the interviewer has learnt about the workflow so far. Every field can be empty while interviewing. */
export const Brief = z.object({
  name: z.string().describe("Skill name: lowercase words joined by hyphens, e.g. weekly-sales-report."),
  purpose: z.string().describe("One sentence: what the skill lets Claude do."),
  triggers: z.array(z.string()).describe("Situations or phrasings where the skill should be used."),
  not_for: z.array(z.string()).describe("Near-misses where it should NOT be used."),
  inputs: z.array(z.string()).describe("What the user provides (files, data, context)."),
  steps: z.array(z.string()).describe("The workflow, in order."),
  outputs: z.string().describe("What a finished result looks like: format, length, location."),
  quality_bar: z.array(z.string()).describe("Rules a good result always follows."),
  examples: z.array(z.object({ input: z.string(), output: z.string() })).describe("Worked examples, if the user gave any."),
  open_questions: z.array(z.string()).describe("What is still unclear."),
});
export type Brief = z.infer<typeof Brief>;

export const emptyBrief = (): Brief => ({
  name: "", purpose: "", triggers: [], not_for: [], inputs: [], steps: [], outputs: "", quality_bar: [], examples: [], open_questions: [],
});

export const InterviewTurn = z.object({
  reply: z.string().describe("Your message to the user: acknowledge briefly, then ask the single most useful next question. When the brief is complete, say so."),
  brief: Brief.describe("The full updated brief, merging everything learnt so far."),
  ready: z.boolean().describe("True when the brief is complete enough to draft a good skill."),
});
export type InterviewTurn = z.infer<typeof InterviewTurn>;

export const SkillFile = z.object({
  path: z.string().describe("Path inside the skill folder, e.g. SKILL.md, reference/style.md, scripts/check.py."),
  content: z.string(),
});
export type SkillFile = z.infer<typeof SkillFile>;

export const Draft = z.object({
  files: z.array(SkillFile).describe("All files of the skill. Must include SKILL.md."),
  notes: z.string().describe("One or two sentences on the design choices, for the user."),
});
export type Draft = z.infer<typeof Draft>;

export const TestCase = z.object({
  id: z.string().describe("Short kebab-case id."),
  prompt: z.string().describe("A realistic user message."),
  should_trigger: z.boolean().describe("Whether the skill should be used for this message."),
  expectations: z.array(z.string()).describe("Checkable properties of a good answer. Empty for cases that should not trigger."),
});
export type TestCase = z.infer<typeof TestCase>;

export const TestPlan = z.object({
  cases: z.array(TestCase).describe("Four to eight cases: most should trigger; at least two are near-misses that should not."),
});
export type TestPlan = z.infer<typeof TestPlan>;

export const Pick = z.object({
  skill: z.string().describe("The name of the one skill to use, or none."),
  reason: z.string(),
});
export type Pick = z.infer<typeof Pick>;

export const Grade = z.object({
  results: z.array(z.object({ expectation: z.string(), passed: z.boolean(), evidence: z.string() })),
});
export type Grade = z.infer<typeof Grade>;

export type CaseResult = {
  id: string;
  prompt: string;
  should_trigger: boolean;
  picked: string;
  triggered: boolean;
  trigger_ok: boolean;
  output?: string;
  grades?: Grade["results"];
  passed: boolean;
};

export type Round = { round: number; files: SkillFile[]; lint: LintIssue[]; results: CaseResult[]; score: number };

export type LintIssue = { level: "error" | "warn"; rule: string; message: string; file?: string };
