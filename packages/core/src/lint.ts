// Deterministic checks against the Agent Skills format. These run on every draft, in the server and in the browser.
import { splitFrontmatter } from "./frontmatter.ts";
import type { LintIssue, SkillFile } from "./schemas.ts";

export const LIMITS = { name: 64, description: 1024, bodyLines: 500, totalBytes: 30 * 1024 * 1024, files: 200 };
const RESERVED = ["anthropic", "claude"];
const XML = /<\/?[a-zA-Z][\w-]*[^>]*>/;

export function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, LIMITS.name).replace(/-+$/, "");
}

/** Normalise a model-supplied path, or return null if it escapes the skill folder. */
export function safePath(path: string): string | null {
  const clean = path.replace(/\\/g, "/").replace(/^\.\//, "").trim();
  if (!clean || clean.startsWith("/") || /^[a-zA-Z]:/.test(clean)) return null;
  if (clean.split("/").some((part) => part === ".." || part === "" || part === ".")) return null;
  return clean;
}

export function lint(files: SkillFile[]): LintIssue[] {
  const issues: LintIssue[] = [];
  const err = (rule: string, message: string, file?: string) => issues.push({ level: "error", rule, message, file });
  const warn = (rule: string, message: string, file?: string) => issues.push({ level: "warn", rule, message, file });

  const paths = new Set<string>();
  let bytes = 0;
  for (const f of files) {
    const p = safePath(f.path);
    if (!p) err("path", `"${f.path}" points outside the skill folder.`, f.path);
    else if (paths.has(p)) err("path", `"${p}" appears twice.`, p);
    else paths.add(p);
    bytes += new TextEncoder().encode(f.content).length;
  }
  if (files.length > LIMITS.files) err("size", `${files.length} files; keep it under ${LIMITS.files}.`);
  if (bytes > LIMITS.totalBytes) err("size", "The bundle is over 30 MB uncompressed.");

  const skill = files.find((f) => safePath(f.path) === "SKILL.md");
  if (!skill) {
    err("skill-md", "Every skill needs a SKILL.md at its root.");
    return issues;
  }
  const { data, body, error } = splitFrontmatter(skill.content);
  if (error) err("frontmatter", error, "SKILL.md");

  const name = data.name;
  if (typeof name !== "string" || !name) err("name", "Frontmatter needs a name.", "SKILL.md");
  else {
    if (name.length > LIMITS.name) err("name", `name is ${name.length} characters; the limit is ${LIMITS.name}.`, "SKILL.md");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) err("name", "name may only use lowercase letters, numbers and single hyphens.", "SKILL.md");
    for (const word of RESERVED) if (name.includes(word)) err("name", `name can't contain the reserved word "${word}".`, "SKILL.md");
    if (XML.test(name)) err("name", "name can't contain XML tags.", "SKILL.md");
  }

  const description = data.description;
  if (typeof description !== "string" || !description.trim()) err("description", "Frontmatter needs a description.", "SKILL.md");
  else {
    if (description.length > LIMITS.description)
      err("description", `description is ${description.length} characters; the limit is ${LIMITS.description}.`, "SKILL.md");
    if (XML.test(description)) err("description", "description can't contain XML tags.", "SKILL.md");
    if (!/\b(use|used|when|whenever|if)\b/i.test(description))
      warn("description", "Say when to use the skill, not just what it does; the description is how it gets picked.", "SKILL.md");
    if (/^\s*(i|you|we)\b/i.test(description)) warn("description", "Write the description in the third person.", "SKILL.md");
    if (description.length < 60) warn("description", "A very short description gives Claude little to match against.", "SKILL.md");
  }

  const lines = body.split("\n").length;
  if (lines > LIMITS.bodyLines) warn("body", `SKILL.md body is ${lines} lines; move detail into reference files.`, "SKILL.md");
  if (!body.trim()) err("body", "SKILL.md has no instructions after the frontmatter.", "SKILL.md");

  // Every relative link from SKILL.md should resolve to a bundled file.
  for (const m of body.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
    const target = m[1];
    if (/^[a-z]+:/i.test(target)) continue;
    const p = safePath(target);
    if (!p || !paths.has(p)) err("links", `SKILL.md links to "${target}", which isn't in the bundle.`, "SKILL.md");
  }
  for (const f of files) {
    const p = safePath(f.path);
    if (p && p !== "SKILL.md" && !skill.content.includes(p.split("/").pop()!))
      warn("orphan", `${p} isn't referenced from SKILL.md, so Claude will never read it.`, p);
  }
  return issues;
}

export const hasErrors = (issues: LintIssue[]) => issues.some((i) => i.level === "error");
