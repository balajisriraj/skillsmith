// Pass 1 of the promo: run the real SkillSmith (the API on the scripted model, and the Vite UI), drive it like a
// user would, and save DOM snapshots of each moment to promo/out/snaps. Pass 2 (kit/render.mjs) films them.
//
//   cd promo && pnpm install --ignore-workspace && node capture.mjs
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { film, freePort, launch, serve, sleep, snapper, until } from "./kit/snap.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const SNAPS = resolve(import.meta.dirname, "out/snaps");
rmSync(SNAPS, { recursive: true, force: true });
const data = resolve(import.meta.dirname, "out/data");
rmSync(data, { recursive: true, force: true });

const api = await freePort();
const web = await freePort();
const stopApi = await serve("pnpm", ["exec", "tsx", "src/main.ts"], {
  cwd: resolve(ROOT, "apps/server"),
  env: { SKILLSMITH_LLM: "scripted", SKILLSMITH_SCRIPTED_DELAY: "25", SKILLSMITH_DATA_DIR: data, PORT: String(api) },
  url: `http://127.0.0.1:${api}/api/health`,
});
const stopWeb = await serve("pnpm", ["exec", "vite", "--host", "127.0.0.1", "--port", String(web), "--strictPort"], {
  cwd: resolve(ROOT, "apps/web"),
  env: { SKILLSMITH_API: `http://127.0.0.1:${api}` },
  url: `http://127.0.0.1:${web}/`,
});

const { browser, page } = await launch();
const shot = snapper(page, SNAPS);
await page.goto(`http://127.0.0.1:${web}/`);
await until(page, () => document.querySelectorAll(".examples .card").length === 3 && document.querySelector(".titleblock div:last-child dd")?.textContent === "scripted");
await sleep(400);
await shot("home");

// The interview: one question at a time, the spec sheet filling in as it goes.
await page.click(".btn.orange.big");
await until(page, () => document.querySelector(".interview .log p.assistant"));
await sleep(500);
await shot("open");

const ANSWERS = [
  "Write customer-facing release notes from a list of merged pull requests.",
  "when someone pastes merged pull requests and asks for release notes; when preparing a changelog for a version release",
  "a list of merged pull request titles and descriptions; the version number",
  "group changes into new features, improvements and fixes; rewrite each change in plain customer language; drop internal refactors and test-only changes; lead with the most important change",
  "a markdown document with a version heading, a one-line summary and grouped bullet lists",
  "never mention internal ticket numbers; every bullet starts with a verb; keep each bullet under 20 words",
  "reviewing the code in a pull request; writing an internal engineering changelog",
];
for (const [i, answer] of ANSWERS.entries()) {
  const n = i + 1;
  const before = await page.$$eval(".interview .log p", (ps) => ps.length);
  await page.click(".interview textarea");
  await page.keyboard.type(answer, { delay: 2 });
  if (n === 1) await shot("typed-1");
  await page.keyboard.press("Enter");
  await until(page, () => document.querySelector(".log .pencil"));
  await sleep(120);
  await shot(`think-${n}`);
  await until(page, (k) => !document.querySelector(".log .pencil") && document.querySelectorAll(".interview .log p").length >= k + 2, before);
  await sleep(800); // the log's smooth scroll and the sheet's ink-in
  await shot(`turn-${n}`);
}

// Editable spec sheet: click a field, add a rule, save it.
await page.click(".sheet .row:nth-child(7) .value");
await sleep(300);
await page.evaluate(() => {
  const t = document.querySelector(".sheet .edit textarea");
  t.focus();
  t.setSelectionRange(t.value.length, t.value.length);
});
await shot("sheet-type-00");
const RULE = "\nnever use em dashes, only plain hyphens";
for (let i = 0, k = 1; i < RULE.length; i += 4, k++) {
  await page.keyboard.type(RULE.slice(i, i + 4), { delay: 4 });
  await shot(`sheet-type-${String(k).padStart(2, "0")}`);
}
await shot("sheet-type-done");
await page.click(".sheet .edit .btn");
await until(page, () => !document.querySelector(".sheet .edit"));
await sleep(500);
await shot("sheet-saved");

// The forge: draft, lint, test, fix, package, streamed.
await page.click(".forge-btn");
await sleep(150);
const frames = await film(page, shot, "forge", () => !!document.querySelector(".ship"), { every: 250, max: 80 });
await sleep(700);
await shot("forge-done");
console.log(`forge: ${frames} frames`);

// Round 1, for the before/after.
const round = (n) => page.evaluate((n) => [...document.querySelectorAll(".rounds button")].find((b) => b.textContent.startsWith(`Round ${n}`))?.click(), n);
await round(1);
await sleep(300);
await shot("round-1");
await round(2);
await sleep(300);

// Ship it: the zip and the three targets.
await page.evaluate(() => document.querySelector(".ship").scrollIntoView({ block: "center" }));
await sleep(400);
await shot("ship");
await page.evaluate(() => scrollTo(0, 0));
await sleep(300);

// The same linter, live in the browser: rename the skill to something the format forbids.
await page.evaluate(() => {
  const t = document.querySelector(".code textarea");
  const start = t.value.indexOf("name: ") + 6;
  const end = t.value.indexOf("\n", start);
  t.focus();
  t.setSelectionRange(start, end);
});
await shot("edit-00");
const BAD = "claude-notes";
for (let i = 0; i < BAD.length; i += 2) {
  await page.keyboard.type(BAD.slice(i, i + 2), { delay: 20 });
  await sleep(40);
  await shot(`edit-${String(i / 2 + 1).padStart(2, "0")}`);
}
await sleep(300);
await shot("edit-done");

// Back to the register: the forged skill is on file.
await page.click(".brand");
await until(page, () => document.querySelector(".register tbody tr"));
await sleep(500);
await page.evaluate(() => document.querySelector(".register").scrollIntoView({ block: "center" }));
await sleep(400);
await shot("register");

await browser.close();
stopWeb();
stopApi();
console.log(`${shot.names.length} snapshots in promo/out/snaps`);
process.exit(0);
