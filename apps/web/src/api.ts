import type { Brief, CaseResult, LintIssue, Round, SkillFile, TestCase } from "@skillsmith/core";

export type Message = { role: "user" | "assistant"; content: string };
export type Session = {
  id: string;
  created: string;
  title: string;
  messages: Message[];
  brief: Brief;
  ready: boolean;
  rounds: Round[];
  best: number | null;
  completeness: number;
};
export type SessionSummary = { id: string; title: string; created: string; name: string; ready: boolean; score: number | null };

export type ForgeEvent =
  | { type: "stage"; stage: "draft" | "lint" | "test" | "fix" | "package"; round: number }
  | { type: "files"; round: number; files: SkillFile[]; notes: string }
  | { type: "lint"; round: number; issues: LintIssue[] }
  | { type: "plan"; round: number; cases: TestCase[] }
  | { type: "case"; round: number; result: CaseResult }
  | { type: "round"; round: Round }
  | { type: "done"; best: number; rounds: number; score: number }
  | { type: "error"; message: string };

export function parseSSE<T>(buffer: string, emit: (e: T) => void): string {
  const frames = buffer.split(/\r?\n\r?\n/);
  const rest = frames.pop() ?? "";
  for (const frame of frames) {
    const data = frame
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart())
      .join("\n");
    if (data) emit(JSON.parse(data) as T);
  }
  return rest;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

const send = (url: string, method: string, body?: unknown) =>
  fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  health: () => fetch("/api/health").then(json<{ llm: string; model: string; live: boolean }>),
  examples: () => fetch("/api/examples").then(json<{ id: string; title: string }[]>),
  list: () => fetch("/api/sessions").then(json<SessionSummary[]>),
  get: (id: string) => fetch(`/api/sessions/${id}`).then(json<Session>),
  create: () => send("/api/sessions", "POST").then(json<Session>),
  example: (id: string) => send(`/api/sessions/example/${id}`, "POST").then(json<Session>),
  remove: (id: string) => send(`/api/sessions/${id}`, "DELETE").then(json<{ deleted: boolean }>),
  say: (id: string, content: string) => send(`/api/sessions/${id}/messages`, "POST", { content }).then(json<Session>),
  saveBrief: (id: string, brief: Brief) => send(`/api/sessions/${id}/brief`, "PUT", brief).then(json<Session>),
  live: (id: string, content: string) => send(`/api/sessions/${id}/live`, "POST", { content }).then(json<{ text: string; usedSkill: boolean }>),
  forge: async (id: string, onEvent: (e: ForgeEvent) => void, signal: AbortSignal) => {
    const res = await send(`/api/sessions/${id}/forge`, "POST");
    if (!res.ok || !res.body) return json(res).then(() => undefined);
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    signal.addEventListener("abort", () => reader.cancel());
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer = parseSSE(buffer + value, onEvent);
    }
  },
};
