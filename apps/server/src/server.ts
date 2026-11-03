// HTTP API. The forge loop streams its progress as Server-Sent Events.
import { type Brief, Brief as BriefSchema, completeness, hasErrors, lint, zipSkill } from "@skillsmith/core";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import type { Config } from "./config.ts";
import { EXAMPLES } from "./examples.ts";
import { Forge } from "./forge.ts";
import { liveRun } from "./live.ts";
import { type LLM, Refusal } from "./llm.ts";
import { type Session, Store } from "./store.ts";

const OPENING = "What workflow should this skill handle? Describe the job in a sentence or two.";
const Content = z.object({ content: z.string().min(1).max(6000) });

export function createApp(cfg: Config, llm: LLM, store = new Store(cfg.dataDir)) {
  const forge = new Forge(llm, cfg);
  const app = new Hono();
  app.use("/api/*", cors());

  const load = (id: string) => store.get(id);
  const view = (s: Session) => ({ ...s, completeness: completeness(s.brief) });

  async function answer(s: Session, content: string) {
    s.messages.push({ role: "user", content });
    const turn = await forge.interview(s.messages, s.brief);
    s.brief = turn.brief;
    s.ready = turn.ready;
    if (s.brief.name) s.title = s.brief.name;
    s.messages.push({ role: "assistant", content: turn.reply });
    store.save(s);
  }

  app.get("/api/health", (c) => c.json({ status: "ok", llm: cfg.llm, model: cfg.llm === "anthropic" ? cfg.model : "scripted", live: cfg.liveRuns }));
  app.get("/api/examples", (c) => c.json(EXAMPLES.map(({ id, title }) => ({ id, title }))));
  app.get("/api/sessions", (c) => c.json(store.list()));
  app.post("/api/sessions", (c) => c.json(view(store.create(OPENING)), 201));

  // Replays a worked interview through the real interviewer, so the brief is built the normal way.
  app.post("/api/sessions/example/:id", async (c) => {
    const ex = EXAMPLES.find((e) => e.id === c.req.param("id"));
    if (!ex) return c.json({ detail: "No such example." }, 404);
    const s = store.create(OPENING, ex.title);
    for (const a of ex.answers) await answer(s, a);
    if (ex.extra) s.brief.examples = ex.extra.examples;
    store.save(s);
    return c.json(view(s), 201);
  });

  app.get("/api/sessions/:id", (c) => {
    const s = load(c.req.param("id"));
    return s ? c.json(view(s)) : c.json({ detail: "No such session." }, 404);
  });

  app.delete("/api/sessions/:id", (c) => c.json({ deleted: store.delete(c.req.param("id")) }));

  app.post("/api/sessions/:id/messages", async (c) => {
    const s = load(c.req.param("id"));
    if (!s) return c.json({ detail: "No such session." }, 404);
    const body = Content.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ detail: "Send a message." }, 422);
    try {
      await answer(s, body.data.content);
    } catch (e) {
      s.messages.pop();
      return c.json({ detail: e instanceof Refusal ? "Claude declined to continue this interview." : "The interviewer hit an error. Try again?" }, 502);
    }
    return c.json(view(s));
  });

  app.put("/api/sessions/:id/brief", async (c) => {
    const s = load(c.req.param("id"));
    if (!s) return c.json({ detail: "No such session." }, 404);
    const brief = BriefSchema.safeParse(await c.req.json().catch(() => null));
    if (!brief.success) return c.json({ detail: "That brief isn't valid." }, 422);
    s.brief = brief.data as Brief;
    store.save(s);
    return c.json(view(s));
  });

  app.post("/api/sessions/:id/forge", (c) => {
    const s = load(c.req.param("id"));
    if (!s) return c.json({ detail: "No such session." }, 404);
    if (!s.brief.purpose || !s.brief.steps.length) return c.json({ detail: "Finish the interview first: the brief needs a purpose and steps." }, 409);
    return streamSSE(c, async (stream) => {
      s.rounds = [];
      s.best = null;
      try {
        for await (const event of forge.run(s.brief)) {
          if (event.type === "round") s.rounds.push(event.round);
          if (event.type === "done") s.best = event.best;
          await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
        }
      } catch (e) {
        const message = e instanceof Refusal ? "Claude declined to forge this skill." : "Forging failed. Try again?";
        console.error(e);
        await stream.writeSSE({ event: "error", data: JSON.stringify({ type: "error", message }) });
      } finally {
        store.save(s);
      }
    });
  });

  app.get("/api/sessions/:id/download", (c) => {
    const s = load(c.req.param("id"));
    const round = s?.best ? s.rounds[s.best - 1] : null;
    if (!s || !round) return c.json({ detail: "Forge the skill first." }, 404);
    if (hasErrors(lint(round.files))) return c.json({ detail: "The best round still has lint errors." }, 409);
    const zip = zipSkill(s.brief.name, round.files);
    return c.body(zip as unknown as ArrayBuffer, 200, {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${s.brief.name}.zip"`,
    });
  });

  app.post("/api/sessions/:id/live", async (c) => {
    if (!cfg.liveRuns || cfg.llm !== "anthropic") return c.json({ detail: "Live runs are off. Set SKILLSMITH_LIVE_RUNS=true with an API key." }, 403);
    const s = load(c.req.param("id"));
    const round = s?.best ? s.rounds[s.best - 1] : null;
    const body = Content.safeParse(await c.req.json().catch(() => null));
    if (!s || !round || !body.success) return c.json({ detail: "Forge the skill first, then send a prompt." }, 409);
    try {
      return c.json(await liveRun(cfg.model, s.brief.name, round.files, body.data.content));
    } catch (e) {
      console.error(e);
      return c.json({ detail: "The live run failed." }, 502);
    }
  });

  return app;
}
