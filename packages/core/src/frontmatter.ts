import { parse } from "yaml";

export type Frontmatter = { data: Record<string, unknown>; body: string; error?: string };

/** Split a SKILL.md into its YAML frontmatter and markdown body. */
export function splitFrontmatter(text: string): Frontmatter {
  const m = text.replace(/^﻿/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text, error: "SKILL.md must start with a YAML frontmatter block between --- lines." };
  try {
    const data = parse(m[1]);
    if (!data || typeof data !== "object" || Array.isArray(data)) return { data: {}, body: m[2], error: "Frontmatter must be a YAML mapping." };
    return { data: data as Record<string, unknown>, body: m[2] };
  } catch (e) {
    return { data: {}, body: m[2], error: `Frontmatter is not valid YAML: ${(e as Error).message.split("\n")[0]}` };
  }
}

export function joinFrontmatter(name: string, description: string, body: string): string {
  const quote = (s: string) => (/[:#\n"']|^\s|\s$/.test(s) ? JSON.stringify(s) : s);
  return `---\nname: ${quote(name)}\ndescription: ${quote(description)}\n---\n\n${body.trim()}\n`;
}
