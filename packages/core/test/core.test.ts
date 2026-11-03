import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { completeness, emptyBrief, hasErrors, joinFrontmatter, lint, safePath, slug, zipSkill } from "../src/index.ts";

const skill = (name: string, description: string, body = "# Do it\n\nFollow the steps.") => ({ path: "SKILL.md", content: joinFrontmatter(name, description, body) });
const good = "Writes weekly sales summaries from a CSV export. Use when the user shares sales data and asks for a weekly report.";

describe("lint", () => {
  it("accepts a well-formed skill", () => {
    expect(lint([skill("weekly-sales-report", good)])).toEqual([]);
  });
  it("enforces the name rules", () => {
    const rules = (name: string) => lint([skill(name, good)]).map((i) => i.message);
    expect(rules("Weekly Sales")).toContain("name may only use lowercase letters, numbers and single hyphens.");
    expect(rules("my-claude-helper").join()).toMatch(/reserved word "claude"/);
    expect(rules("a".repeat(65)).join()).toMatch(/limit is 64/);
  });
  it("enforces the description rules", () => {
    expect(hasErrors(lint([skill("x-y", "")]))).toBe(true);
    expect(lint([skill("x-y", "x".repeat(1025) + " use when")]).map((i) => i.rule)).toContain("description");
    expect(lint([skill("x-y", "Formats <b>tables</b>. Use when asked.")]).some((i) => /XML/.test(i.message))).toBe(true);
    expect(lint([skill("x-y", "Formats tables nicely for reports and dashboards in a consistent house style.")]).map((i) => i.level)).toEqual(["warn"]);
  });
  it("checks links, orphans and paths", () => {
    const files = [
      skill("x-y", good, "See [the style guide](reference/style.md) and [missing](reference/nope.md)."),
      { path: "reference/style.md", content: "style" },
      { path: "scripts/unused.py", content: "print(1)" },
      { path: "../escape.md", content: "!" },
    ];
    const messages = lint(files).map((i) => `${i.level}:${i.rule}`);
    expect(messages).toEqual(expect.arrayContaining(["error:links", "warn:orphan", "error:path"]));
    expect(messages).not.toContain("warn:orphan:reference/style.md");
  });
  it("requires SKILL.md and a frontmatter block", () => {
    expect(lint([{ path: "README.md", content: "hi" }])[0].rule).toBe("skill-md");
    expect(lint([{ path: "SKILL.md", content: "# no frontmatter" }]).map((i) => i.rule)).toContain("frontmatter");
  });
});

describe("helpers", () => {
  it("slugs and guards paths", () => {
    expect(slug("Weekly Sales Report!")).toBe("weekly-sales-report");
    expect(safePath("./reference/a.md")).toBe("reference/a.md");
    expect(safePath("/etc/passwd")).toBeNull();
    expect(safePath("a/../../b")).toBeNull();
  });
  it("zips into a single named folder", () => {
    const zip = unzipSync(zipSkill("x-y", [skill("x-y", good), { path: "reference/a.md", content: "A" }]));
    expect(Object.keys(zip).sort()).toEqual(["x-y/SKILL.md", "x-y/reference/a.md"]);
    expect(strFromU8(zip["x-y/reference/a.md"])).toBe("A");
  });
  it("scores brief completeness", () => {
    const b = emptyBrief();
    expect(completeness(b)).toBe(0);
    b.purpose = "p"; b.triggers = ["t"]; b.steps = ["s"];
    expect(completeness(b)).toBe(60);
  });
});
