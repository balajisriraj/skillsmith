import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Draft, type SkillFile } from "@skillsmith/core";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { config } from "../src/config.ts";
import { EXAMPLES } from "../src/examples.ts";
import type { LLM, Message } from "../src/llm.ts";
import { ScriptedLLM } from "../src/scripted.ts";
import { createApp } from "../src/server.ts";

const make = (llm: LLM = new ScriptedLLM(), extra: Partial<typeof config> = {}) =>
  createApp({ ...config, llm: "scripted", liveRuns: false, ...extra, dataDir: mkdtempSync(join(tmpdir(), "ss-test-")) }, llm);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = async (r: Response | Promise<Response>): Promise<any> => (await r).json();

const sse = (text: string) => text.split("\n").filter((l) => l.startsWith("data:")).map((l) => JSON.parse(l.slice(5)));
const post = (app: ReturnType<typeof make>, path: string, body?: unknown) =>
  app.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

/** Wraps the scripted model but makes every draft try to write outside the folder, or never produce a SKILL.md. */
class Hostile extends ScriptedLLM {
  constructor(private readonly mode: "escape" | "broken") {
    super();
  }
  override async structured<T extends z.ZodType>(system: string, messages: Message[], schema: T, effort: "low" | "medium" | "high") {
    const out = await super.structured(system, messages, schema, effort);
    if (schema !== (Draft as z.ZodType)) return out;
    const draft = out as Draft;
    const files: SkillFile[] =
      this.mode === "escape" ? [...draft.files, { path: "../../etc/evil.sh", content: "rm -rf /" }, { path: "/abs.md", content: "x" }] : [{ path: "README.md", content: "no skill here" }];
    return { ...draft, files } as z.infer<T>;
  }
}

describe("interview", () => {
  it("fills the brief one answer at a time until it is ready", async () => {
    const app = make();
    const s = await json(post(app, "/api/sessions"));
    expect(s.messages[0].role).toBe("assistant");
    let view = s;
    for (const answer of EXAMPLES[0].answers) view = await json(post(app, `/api/sessions/${s.id}/messages`, { content: answer }));
    expect(view.ready).toBe(true);
    expect(view.completeness).toBe(100);
    expect(view.brief.name).toBe("customer-facing-release-notes");
    expect(view.brief.steps).toHaveLength(4);
    expect(view.messages.at(-1).content).toMatch(/everything I need/);
  });

  it("validates input", async () => {
    const app = make();
    const s = await json(post(app, "/api/sessions"));
    expect((await post(app, `/api/sessions/${s.id}/messages`, { content: "" })).status).toBe(422);
    expect((await app.request(`/api/sessions/${s.id}/brief`, { method: "PUT", body: JSON.stringify({ name: 1 }) })).status).toBe(422);
    expect((await post(app, `/api/sessions/${s.id}/forge`)).status).toBe(409);
    expect((await app.request("/api/sessions/../../etc")).status).toBe(404);
  });
});

describe("forge", () => {
  it("drafts, tests, fixes and packages a skill", async () => {
    const app = make();
    const s = await json(post(app, "/api/sessions/example/release-notes"));
    const events = sse(await (await post(app, `/api/sessions/${s.id}/forge`)).text());
    const stages = events.filter((e) => e.type === "stage").map((e) => `${e.stage}${e.round}`);
    expect(stages.slice(0, 4)).toEqual(["draft1", "lint1", "test1", "fix2"]);
    const done = events.at(-1);
    expect(done).toMatchObject({ type: "done", score: 1 });
    const plans = events.filter((e) => e.type === "plan");
    expect(plans).toHaveLength(1); // one fixed test plan for every round

    const zip = unzipSync(new Uint8Array(await (await app.request(`/api/sessions/${s.id}/download`)).arrayBuffer()));
    expect(Object.keys(zip).sort()).toEqual(["customer-facing-release-notes/SKILL.md", "customer-facing-release-notes/reference/examples.md"]);
    expect(strFromU8(zip["customer-facing-release-notes/SKILL.md"])).toMatch(/^---\nname: customer-facing-release-notes\n/);
  });

  it("drops files that would land outside the skill folder", async () => {
    const app = make(new Hostile("escape"));
    const s = await json(post(app, "/api/sessions/example/sales-summary"));
    const events = sse(await (await post(app, `/api/sessions/${s.id}/forge`)).text());
    const paths = events.filter((e) => e.type === "files").flatMap((e) => e.files.map((f: SkillFile) => f.path));
    expect(paths.some((p: string) => p.includes("..") || p.startsWith("/"))).toBe(false);
  });

  it("stops after the round limit and refuses to package a broken skill", async () => {
    const app = make(new Hostile("broken"), { maxRounds: 2 });
    const s = await json(post(app, "/api/sessions/example/incident-postmortem"));
    const events = sse(await (await post(app, `/api/sessions/${s.id}/forge`)).text());
    expect(events.filter((e) => e.type === "round")).toHaveLength(2);
    expect(events.find((e) => e.type === "lint").issues[0].rule).toBe("skill-md");
    expect(events.at(-1)).toMatchObject({ type: "done", score: 0 });
    expect((await app.request(`/api/sessions/${s.id}/download`)).status).toBe(409);
  });

  it("keeps live runs off unless configured", async () => {
    const app = make();
    const s = await json(post(app, "/api/sessions/example/release-notes"));
    expect((await post(app, `/api/sessions/${s.id}/live`, { content: "hi" })).status).toBe(403);
  });
});
