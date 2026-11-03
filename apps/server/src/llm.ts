// Model layer. Every decision is a structured output validated by the same Zod schemas the UI uses.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { Config } from "./config.ts";

export type Message = { role: "user" | "assistant"; content: string };
export type Effort = "low" | "medium" | "high";

export interface LLM {
  structured<T extends z.ZodType>(system: string, messages: Message[], schema: T, effort: Effort): Promise<z.infer<T>>;
  text(system: string, messages: Message[], effort: Effort): Promise<string>;
}

export class Refusal extends Error {}

// Server-side fallback: a declined request is re-run on the recommended fallback model in the same call.
const fallback = () => ({ betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const });

export class ClaudeLLM implements LLM {
  readonly client = new Anthropic();
  constructor(private readonly model: string) {}

  async structured<T extends z.ZodType>(system: string, messages: Message[], schema: T, effort: Effort) {
    const res = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: 16000,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages,
      output_config: { effort, format: zodOutputFormat(schema) },
      ...fallback(),
    });
    if (res.stop_reason === "refusal") throw new Refusal("Claude declined this request.");
    if (res.parsed_output == null) throw new Error("Claude's answer didn't match the schema.");
    return res.parsed_output as z.infer<T>;
  }

  async text(system: string, messages: Message[], effort: Effort) {
    const stream = this.client.beta.messages.stream({
      model: this.model,
      max_tokens: 8000,
      system,
      messages,
      output_config: { effort },
      ...fallback(),
    });
    const res = await stream.finalMessage();
    if (res.stop_reason === "refusal") throw new Refusal("Claude declined this request.");
    return res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  }
}

export async function makeLLM(cfg: Config): Promise<LLM> {
  if (cfg.llm === "scripted") {
    const { ScriptedLLM } = await import("./scripted.ts");
    return new ScriptedLLM(cfg.scriptedDelay);
  }
  return new ClaudeLLM(cfg.model);
}
