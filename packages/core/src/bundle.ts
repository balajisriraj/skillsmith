import { strToU8, zipSync } from "fflate";
import { splitFrontmatter } from "./frontmatter.ts";
import { type Brief, type SkillFile } from "./schemas.ts";
import { safePath } from "./lint.ts";

/** Zip the skill as a single top-level folder named after the skill, the layout every surface accepts. */
export function zipSkill(name: string, files: SkillFile[]): Uint8Array {
  const tree: Record<string, Uint8Array> = {};
  for (const f of files) {
    const p = safePath(f.path);
    if (p) tree[`${name}/${p}`] = strToU8(f.content);
  }
  return zipSync(tree, { level: 9, mtime: new Date("2026-01-01T00:00:00Z") });
}

export function skillMeta(files: SkillFile[]): { name: string; description: string } {
  const skill = files.find((f) => safePath(f.path) === "SKILL.md");
  const { data } = splitFrontmatter(skill?.content ?? "");
  return { name: String(data.name ?? ""), description: String(data.description ?? "") };
}

const FIELDS: [keyof Brief, number][] = [
  ["purpose", 2], ["triggers", 2], ["steps", 2], ["outputs", 1], ["inputs", 1], ["not_for", 1], ["quality_bar", 1],
];

/** 0-100: how much of the brief is filled in. The interview aims for 80+ before drafting. */
export function completeness(brief: Brief): number {
  const total = FIELDS.reduce((n, [, w]) => n + w, 0);
  const have = FIELDS.reduce((n, [field, w]) => {
    const v = brief[field];
    return n + (Array.isArray(v) ? (v.length ? w : 0) : String(v).trim() ? w : 0);
  }, 0);
  return Math.round((have / total) * 100);
}
