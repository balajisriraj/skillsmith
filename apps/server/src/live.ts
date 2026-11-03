// Optional: run a test case against the real Skills runtime. Uploads the bundle with the Skills API, runs one
// prompt with the skill mounted in a code-execution container, then deletes the skill again.
import Anthropic, { toFile } from "@anthropic-ai/sdk";
import { zipSkill, type SkillFile } from "@skillsmith/core";

export async function liveRun(model: string, name: string, files: SkillFile[], prompt: string) {
  const client = new Anthropic();
  const zip = zipSkill(name, files);
  const skill = await client.skills.create({ files: [await toFile(Buffer.from(zip), `${name}.zip`)] });
  try {
    const res = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      container: { skills: [{ type: "custom", skill_id: skill.id, version: "latest" }] },
      tools: [{ type: "code_execution_20260521", name: "code_execution" }],
      betas: ["code-execution-2025-08-25"],
      messages: [{ role: "user", content: prompt }],
    } as Parameters<typeof client.beta.messages.create>[0]);
    const content = "content" in res ? res.content : [];
    const text = content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
    const usedSkill = JSON.stringify(content).includes(`/skills/${name}/`);
    return { text, usedSkill, stop: "stop_reason" in res ? res.stop_reason : null };
  } finally {
    await client.skills.delete(skill.id).catch(() => {});
  }
}
