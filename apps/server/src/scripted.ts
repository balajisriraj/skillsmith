// A deterministic stand-in for Claude, so the whole loop runs offline and in CI.
// It reads the same prompts the real model gets and answers with simple, explainable heuristics.
import { type Brief, Draft, emptyBrief, Grade, InterviewTurn, joinFrontmatter, Pick, slug, TestPlan } from "@skillsmith/core";
import type { z } from "zod";
import type { Effort, LLM, Message } from "./llm.ts";

const STOP = new Set("a an and are as at be but by for from has have i in is it of on or so that the this to was we with you your can me my do please help want need use when some any into".split(" "));
const words = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => !STOP.has(w) && w.length > 2) ?? [];
const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, "");
const bag = (s: string) => new Set(words(s).map(stem));
// Answers list items on separate lines or separated by semicolons; commas stay inside an item.
const list = (s: string) => s.split(/\n|;/).map((x) => x.replace(/^\s*(?:[-*\u2022]|\d+\.)\s*/, "").trim()).filter((x) => x.length > 2);
const clause = (t: string) => t.trim().replace(/^(when|whenever|if)\s+/i, "").replace(/[.?!]+$/, "");
/** "Write customer-facing release notes from …" -> "customer-facing-release-notes" */
const nameFrom = (purpose: string) => {
  const rest = purpose.toLowerCase().replace(/[.]/g, "").split(/\s+/).slice(1);
  const cut = rest.findIndex((w) => ["from", "for", "of", "into", "with", "by", "using", "a", "an", "the"].includes(w) && rest.indexOf(w) > 0);
  return slug((cut > 0 ? rest.slice(0, cut) : rest).filter((w) => !["a", "an", "the"].includes(w)).slice(0, 5).join(" "));
};

const ORDER: { field: keyof Brief; ask: string }[] = [
  { field: "purpose", ask: "What workflow should this skill handle? Describe the job in a sentence or two." },
  { field: "triggers", ask: "When should Claude reach for it? List the situations or the way people usually ask." },
  { field: "inputs", ask: "What will the user hand over to start: files, data, links, context?" },
  { field: "steps", ask: "Walk me through how you do it, step by step." },
  { field: "outputs", ask: "What does a finished result look like: format, length, sections?" },
  { field: "quality_bar", ask: "What separates a great result from an okay one? Any rules it must always follow?" },
  { field: "not_for", ask: "Anything that sounds similar but this skill should not handle?" },
];

export class ScriptedLLM implements LLM {
  constructor(private readonly delay = 0) {}
  private pause = (k = 1) => (this.delay ? new Promise((r) => setTimeout(r, this.delay * k)) : Promise.resolve());

  async structured<T extends z.ZodType>(system: string, messages: Message[], schema: T, _effort: Effort): Promise<z.infer<T>> {
    await this.pause(20);
    const last = messages[messages.length - 1].content;
    if (schema === (InterviewTurn as z.ZodType)) return this.interview(messages) as z.infer<T>;
    if (schema === (Draft as z.ZodType)) return this.draft(last) as z.infer<T>;
    if (schema === (TestPlan as z.ZodType)) return this.plan(last) as z.infer<T>;
    if (schema === (Pick as z.ZodType)) return this.pick(last) as z.infer<T>;
    if (schema === (Grade as z.ZodType)) return this.grade(last) as z.infer<T>;
    throw new Error(`ScriptedLLM has no script for this schema (${system.slice(0, 40)}…)`);
  }

  async text(system: string, messages: Message[]): Promise<string> {
    await this.pause(20);
    // "Follow the skill": restate its steps, output format and checklist, applied to the request.
    const body = system.split("<file path=\"SKILL.md\">")[1] ?? system;
    const lines = body.split("\n").filter((l) => /^\s*(\d+\.|-)\s+/.test(l)).map((l) => l.replace(/^\s*(\d+\.|-)\s+/, ""));
    return `For: ${messages[messages.length - 1].content}\n\n${lines.map((l, i) => `${i + 1}. ${l}`).join("\n")}`;
  }

  private interview(messages: Message[]): InterviewTurn {
    const brief: Brief = emptyBrief();
    const current = messages[0].content.match(/Current brief:\n([\s\S]*)$/);
    if (current) Object.assign(brief, JSON.parse(current[1]));
    const answer = messages[messages.length - 1].content;
    // The answer fills whichever field was asked about last.
    const asked = [...messages].reverse().find((m) => m.role === "assistant" && ORDER.some((o) => m.content.includes(o.ask)));
    const slot = ORDER.find((o) => asked?.content.includes(o.ask)) ?? ORDER.find((o) => isEmpty(brief[o.field]));
    if (slot && messages.length > 2) {
      const v = brief[slot.field];
      const field = slot.field as "purpose" | "outputs" | "triggers" | "not_for" | "inputs" | "steps" | "quality_bar";
      if (Array.isArray(v)) (brief[field] as string[]) = [...(v as string[]), ...list(answer)];
      else (brief[field] as string) = answer.trim();
      if (slot.field === "purpose" && !brief.name) brief.name = nameFrom(answer);
    }
    const next = ORDER.find((o) => isEmpty(brief[o.field]));
    const ready = !next;
    return { reply: ready ? "That's everything I need. Forge the skill when you're ready." : `Got it. ${next.ask}`, brief, ready };
  }

  private draft(prompt: string): Draft {
    const brief = JSON.parse(prompt.match(/<brief>\n([\s\S]*?)\n<\/brief>/)![1]) as Brief;
    const problems = prompt.match(/<problems>\n([\s\S]*?)\n<\/problems>/)?.[1] ?? "";
    // A first draft describes only the purpose; revisions add the trigger phrasings testing showed were missing.
    const missed = [...problems.matchAll(/Not picked for "([^"]+)"/g)].map((m) => clause(m[1].replace(/^I need help: /, "")));
    const known = brief.triggers.map(clause);
    const when = (problems ? [...new Set([...known, ...missed])] : known.slice(0, 1)).join(", or when ") || "asked";
    const notFor = problems && brief.not_for.length ? ` Not for ${brief.not_for.join(" or ")}.` : "";
    const description = `${brief.purpose.replace(/\.$/, "")}. Use when ${when}.${notFor}`.slice(0, 1024);
    const examples = brief.examples.length > 0;
    const body = [
      `# ${brief.name.split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ")}`,
      `## Inputs\n${brief.inputs.map((i) => `- ${i}`).join("\n")}`,
      `## Steps\n${brief.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
      `## Output\n- ${brief.outputs}`,
      `## Quality checklist\n${brief.quality_bar.map((q) => `- ${q}`).join("\n")}`,
      examples ? "## Examples\nSee [worked examples](reference/examples.md)." : "",
    ].filter(Boolean).join("\n\n");
    const files = [{ path: "SKILL.md", content: joinFrontmatter(brief.name, description, body) }];
    if (examples) files.push({ path: "reference/examples.md", content: brief.examples.map((e, i) => `## Example ${i + 1}\n\n**Input**\n\n${e.input}\n\n**Output**\n\n${e.output}`).join("\n\n") });
    return { files, notes: problems ? "Broadened the description to the phrasings testing missed." : "Kept SKILL.md short; examples live in a reference file." };
  }

  private plan(prompt: string): TestPlan {
    const brief = JSON.parse(prompt.match(/<brief>\n([\s\S]*?)\n<\/brief>/)![1]) as Brief;
    const expectations = [...brief.quality_bar.slice(0, 2), brief.steps[0]].filter(Boolean);
    const cases = [
      ...brief.triggers.map((t, i) => ({ id: `ask-${i + 1}`, prompt: `I need help: ${clause(t)}.`, should_trigger: true, expectations })),
      ...brief.not_for.slice(0, 2).map((t, i) => ({ id: `near-miss-${i + 1}`, prompt: `Can you help me with ${clause(t)}?`, should_trigger: false, expectations: [] })),
    ];
    return { cases };
  }

  private pick(prompt: string): Pick {
    const message = prompt.match(/<message>([\s\S]*)<\/message>/)![1];
    const skills = [...prompt.matchAll(/^- ([a-z0-9-]+): (.+)$/gm)].map((m) => ({ name: m[1], description: m[2] }));
    const asked = bag(message);
    // Positive evidence from "Use when …", negative evidence from "Not for …".
    const score = (d: string) => {
      const [use, not = ""] = d.split(/\bNot for\b/);
      const hits = [...bag(use)].filter((w) => asked.has(w)).length;
      const vetoes = [...bag(not)].filter((w) => asked.has(w)).length;
      // One shared word with a near-miss isn't a veto ("outage review" vs "reviewing code"); two or more is.
      return vetoes >= 2 ? hits - 2 * vetoes : hits;
    };
    const best = skills.map((s) => ({ ...s, score: score(s.description) })).sort((a, b) => b.score - a.score)[0];
    return best && best.score >= 2 ? { skill: best.name, reason: `Matches ${best.score} terms.` } : { skill: "none", reason: "Nothing fits well." };
  }

  private grade(prompt: string): Grade {
    const expectations = [...prompt.matchAll(/^- (.+)$/gm)].map((m) => m[1]);
    const answer = bag(prompt.split("<answer>")[1] ?? "");
    return {
      results: expectations.map((e) => {
        const need = [...bag(e)];
        const hit = need.filter((w) => answer.has(w)).length;
        const passed = need.length === 0 || hit / need.length >= 0.5;
        return { expectation: e, passed, evidence: passed ? `Covers ${hit}/${need.length} key terms.` : `Mentions only ${hit}/${need.length} key terms.` };
      }),
    };
  }
}

function isEmpty(v: unknown) {
  return Array.isArray(v) ? v.length === 0 : !String(v ?? "").trim();
}
