import { serve } from "@hono/node-server";
import { config } from "./config.ts";
import { makeLLM } from "./llm.ts";
import { createApp } from "./server.ts";

const app = createApp(config, await makeLLM(config));
serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`SkillSmith API on http://localhost:${info.port} (${config.llm === "anthropic" ? config.model : "scripted model"})`);
});
