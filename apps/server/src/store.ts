// Sessions are small JSON documents on disk: one file each, written atomically.
import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Brief, emptyBrief, type Round } from "@skillsmith/core";
import type { Message } from "./llm.ts";

export type Session = {
  id: string;
  created: string;
  title: string;
  messages: Message[];
  brief: Brief;
  ready: boolean;
  rounds: Round[];
  best: number | null;
};

export class Store {
  constructor(private readonly dir: string) {
    mkdirSync(join(dir, "sessions"), { recursive: true });
  }
  private path = (id: string) => join(this.dir, "sessions", `${id}.json`);

  create(opening: string, title = "New skill"): Session {
    const s: Session = { id: randomUUID().replaceAll("-", "").slice(0, 12), created: new Date().toISOString(), title, messages: [{ role: "assistant", content: opening }], brief: emptyBrief(), ready: false, rounds: [], best: null };
    this.save(s);
    return s;
  }

  get(id: string): Session | null {
    if (!/^[a-f0-9]{12}$/.test(id)) return null;
    try {
      return JSON.parse(readFileSync(this.path(id), "utf8")) as Session;
    } catch {
      return null;
    }
  }

  save(s: Session) {
    const tmp = `${this.path(s.id)}.tmp`;
    writeFileSync(tmp, JSON.stringify(s, null, 2));
    renameSync(tmp, this.path(s.id));
  }

  list() {
    return readdirSync(join(this.dir, "sessions"))
      .filter((f) => f.endsWith(".json"))
      .map((f) => this.get(f.slice(0, -5)))
      .filter((s): s is Session => !!s)
      .sort((a, b) => b.created.localeCompare(a.created))
      .map((s) => ({ id: s.id, title: s.title, created: s.created, name: s.brief.name, ready: s.ready, score: s.best ? s.rounds[s.best - 1]?.score ?? null : null }));
  }

  delete(id: string) {
    if (!this.get(id)) return false;
    rmSync(this.path(id));
    return true;
  }
}
