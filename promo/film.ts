// SkillSmith's promo: the problem, the product, then each step of the forge given room on the real UI (DOM snapshots
// from capture.mjs), and what's under the hood. 110 bpm; shots are counted in beats. The look is the app's own:
// a blueprint drafting table, chalk linework and one safety-orange accent.
import { big, chips, eyebrow, grad, makeFilm, stream, sub } from "./kit/film";

// The app's tokens (apps/web/src/styles.css).
const BLUE = "#0b3a66";
const CHALK = "#eef5ff";
const ORANGE = "#ff9f1c";
const COND = `"IBM Plex Sans Condensed", "Arial Narrow", "Helvetica Neue", sans-serif`;
const MONO = `"IBM Plex Mono", "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace`;
/** The drafting grid: minor lines every 16px, major every 80px, over a base. */
const grid = (base: string, major: string, minor: string) =>
  [
    `linear-gradient(${major} 1px, transparent 1px) 0 0 / 80px 80px`,
    `linear-gradient(90deg, ${major} 1px, transparent 1px) 0 0 / 80px 80px`,
    `linear-gradient(${minor} 1px, transparent 1px) 0 0 / 16px 16px`,
    `linear-gradient(90deg, ${minor} 1px, transparent 1px) 0 0 / 16px 16px`,
    base,
  ].join(", ");
const blueprint = grid(`radial-gradient(120% 80% at 50% 0%, #12518c, ${BLUE} 60%, #082c4f)`, "rgba(255,255,255,.14)", "rgba(255,255,255,.07)");
const paper = grid(CHALK, "rgba(11,58,102,.16)", "rgba(11,58,102,.07)");

const logo = `<div class="mark"><svg viewBox="0 0 32 32"><path d="M6 24l10-16 10 16z" /><circle cx="16" cy="8" r="2.4" /></svg></div>`;
const { word, ui, run, BEAT } = makeFilm({
  name: "skillsmith",
  style: "forge",
  bpm: 110,
  bgs: { dark: [blueprint, CHALK], light: [paper, BLUE] },
  grad: `linear-gradient(92deg, #ffc061 0%, ${ORANGE} 50%, #ff7a3d 100%)`,
  font: COND,
  stage: blueprint,
  caption: { bg: "rgba(8, 44, 79, .86)", ink: CHALK, shadow: "0 24px 60px -24px rgba(0,0,0,.8)" },
  logo,
  css: `
    #type .w { font-weight: 700; letter-spacing: -.012em; line-height: 1.02; }
    #type .sub { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-weight: 400; opacity: .78; }
    #type .eyebrow { font: 600 24px ${MONO}; letter-spacing: .24em; color: ${ORANGE}; opacity: 1; }
    #type[data-bg=light] .eyebrow { color: #c25e00; }
    #type[data-bg=light] .grad { background: linear-gradient(92deg, #e07a00, #ff5a1c); -webkit-background-clip: text; background-clip: text; }
    #type .chips span { border-radius: 0; border-width: 1.5px; font: 500 24px ${MONO}; letter-spacing: 0; padding: 12px 20px; }
    #type .mark { position: relative; width: 170px; height: 170px; margin: 0 auto 6px; display: grid; place-items: center; border: 1.5px solid rgba(238,245,255,.6); background: rgba(8,44,79,.55); }
    #type .mark::before { content: ""; position: absolute; inset: -9px; border: 1px solid rgba(238,245,255,.3);
      -webkit-mask: linear-gradient(#000 0 0) top left / 26px 26px no-repeat, linear-gradient(#000 0 0) top right / 26px 26px no-repeat, linear-gradient(#000 0 0) bottom left / 26px 26px no-repeat, linear-gradient(#000 0 0) bottom right / 26px 26px no-repeat; }
    #type .mark svg { width: 124px; height: 124px; fill: none; stroke: ${CHALK}; stroke-width: 1.6; stroke-linejoin: round; }
    #type .mark circle { fill: ${ORANGE}; stroke: none; }
    #type .o { color: ${ORANGE}; }
    #caption { border-radius: 0; border: 1.5px solid rgba(238,245,255,.55); padding: 14px 34px 16px; }
    #caption .eyebrow { font: 600 15px ${MONO}; letter-spacing: .2em; }
    #caption .title { font-family: ${COND}; font-size: 36px; font-weight: 600; letter-spacing: 0; }
    #camera.window { border-radius: 3px; box-shadow: 0 60px 140px -40px rgba(0,0,0,.75), 0 0 0 1.5px rgba(238,245,255,.6); }
    #ring { border-radius: 2px; box-shadow: 0 0 0 3px ${ORANGE}, 0 0 0 9px rgba(255,159,28,.22), 0 18px 50px -10px rgba(0,0,0,.5); }
  `,
});
const C = { x: 960, y: 540 };
/** Snapshots prefix-a … prefix-b as a timeline, one every `every` seconds from `from`. */
const seq = (prefix: string, a: number, b: number, from: number, every: number, pad = 2): [number, string][] =>
  Array.from({ length: b - a + 1 }, (_, i) => [from + i * every, `${prefix}-${String(a + i).padStart(pad, "0")}`]);

// The hook: what's broken.
word(4, big("You know the job inside out.", "s"), "dark");
word(4, big("Claude doesn't. Yet.", "m"), "dark");
word(5, `${big("So you explain it again. Every chat.", "s")}${sub("The steps. The format. The rules you never wrote down.")}`, "light");
word(5, big(`Teach it once.<br>${grad("Know it works.")}`, "m"), "dark");

// The product.
word(6, `${logo}${big('Skill<span class="o">Smith</span>')}${sub("Describe a workflow you know well. It interviews you, then drafts, tests and packages an Agent Skill for Claude.")}`, "dark", { mark: "reveal", hit: true });
ui(7, { snap: "home", cam: [0.7, C, 0.78, C], cursor: { path: [[0, { x: 1200, y: 820 }], [2.4, ".btn.orange.big"], [3.8, ".btn.orange.big"]], click: [2.9] } });

// 1. The interview.
word(4, `${eyebrow("01 · Interview")}${big("It interviews you.", "m")}${sub("One question at a time, like a sharp colleague, until it understands the job.")}`, "dark");
const A1 = "Write customer-facing release notes from a list of merged pull requests.";
// Held still while the answer is typed and sent, then the reply and the sheet's first line.
ui(7, {
  snap: [[0, "open"], [3.4, "think-1"]],
  type: { sel: ".interview textarea", text: A1, from: 0.3, to: 2.6, until: 3.4 },
  cursor: { path: [[0, { x: 640, y: 880 }], [2.7, ".interview form .btn"]], click: [3.0] },
  cam: [1.12, { x: 860, y: 600 }, 1.14, { x: 850, y: 600 }],
  caption: ["Interview", "One question at a time"],
});
ui(5, {
  snap: [[0, "think-1"], [0.6, "turn-1"]],
  cursor: { path: [[0, ".interview form .btn"], [1.2, { x: 1000, y: 420 }]] },
  cam: [1.14, { x: 850, y: 600 }, 1.3, { x: 780, y: 470 }],
  caption: ["Interview", "One question at a time"],
});
ui(11, {
  snap: [[0, "turn-1"], ...seq("turn", 2, 7, 0.7, 0.75, 1)],
  cam: [1.28, { x: 1165, y: 500 }, 1.34, { x: 1170, y: 480 }],
  ring: [{ sel: ".gauge", from: 4.9 }],
  caption: ["Spec sheet", "Every answer fills in the brief"],
});
ui(10, {
  snap: [[0, "turn-7"], ...stream("sheet-type", 1.0, 0.24), [4.4, "sheet-saved"]],
  cursor: { path: [[0, { x: 1300, y: 960 }], [0.6, ".sheet .row:nth-child(7) .value"], [1.0, ".sheet .row:nth-child(7) .value"], [3.6, ".sheet .edit .btn"], [4.4, ".sheet .edit .btn"], [5.2, { x: 1300, y: 900 }]], click: [0.8, 4.1] },
  cam: [1.36, { x: 1165, y: 700 }, 1.4, { x: 1165, y: 720 }],
  caption: ["Editable", "Fix anything, right on the sheet"],
});

// 2. The draft.
word(4, `${eyebrow("02 · Draft")}${big("Then it drafts the skill.", "s")}${sub("A SKILL.md in the Agent Skills format, linted the moment it exists.")}`, "dark");
ui(11, {
  snap: [[0, "sheet-saved"], ...seq("forge", 0, 3, 1.5, 0.5)],
  cursor: { path: [[0, { x: 1500, y: 400 }], [1.0, ".forge-btn"], [1.6, ".forge-btn"], [2.6, { x: 1500, y: 560 }]], click: [1.25] },
  cam: [1.0, C, 1.32, { x: 1180, y: 560 }],
  caption: ["Draft", "A SKILL.md, written from the brief"],
});
ui(8, {
  snap: "forge-03",
  cam: [1.75, { x: 1000, y: 470 }, 1.85, { x: 1000, y: 480 }],
  ring: [{ sel: ".tree .ok", from: 1.0 }],
  caption: ["Lint", "Checked against the format"],
});

// 3. The hero: it tests the skill, and fixes what fails.
word(4, big("A draft is only a guess.", "s"), "dark", { mark: "heroIn" });
word(5, `${big("Will Claude actually pick it?", "s")}${sub("Claude decides from the name and description alone.")}`, "light");
word(4, `${eyebrow("03 · Test")}${big(grad("So it tests it."))}`, "dark", { mark: "hero", hit: true });
ui(12, {
  snap: seq("forge", 4, 17, 0, 0.4),
  cam: [1.32, ".matrix", 1.38, ".matrix"],
  caption: ["Trigger evals", "Real requests, and near-misses"],
});
ui(8, {
  snap: "forge-17",
  cam: [1.34, ".matrix tbody tr:nth-child(2)", 1.38, ".matrix tbody tr:nth-child(2)"],
  ring: [{ sel: ".matrix tbody tr:nth-child(2)", from: 0.8 }],
  caption: ["Caught", "A phrasing the skill missed"],
});
ui(12, {
  snap: [...seq("forge", 18, 33, 0, 0.36), [5.9, "forge-done"]],
  cam: [1.32, ".matrix", 1.36, { x: 1175, y: 440 }],
  ring: [{ sel: ".matrix .totals", from: 5.0 }],
  caption: ["Fix and retest", "Same tests, round after round"],
});
ui(9, {
  snap: "forge-done",
  cam: [1.6, ".delta", 1.7, ".delta"],
  ring: [{ sel: ".delta ins", from: 1.4 }],
  caption: ["The fix", "The description, before and after"],
}, { mark: "heroEnd" });

// 4. One linter, live.
word(4, `${eyebrow("04 · Lint")}${big("One linter, two runtimes.", "s")}${sub("The checks the server runs also run in your browser, as you type.")}`, "dark");
ui(10, {
  snap: [[0, "forge-done"], ...stream("edit", 1.0, 0.42)],
  cursor: { path: [[0, { x: 1300, y: 800 }], [0.7, { x: 860, y: 654 }], [1.2, { x: 860, y: 654 }], [2.2, { x: 1100, y: 760 }]], click: [0.9] },
  cam: [1.7, { x: 1010, y: 600 }, 1.76, { x: 1010, y: 610 }],
  ring: [{ sel: ".tree .issues", from: 2.6 }],
  caption: ["Live lint", "Break a rule, see it at once"],
});

// 5. Package.
word(4, `${eyebrow("05 · Package")}${big("Then it ships.", "m")}${sub("One zip for the Claude apps, Claude Code and the Claude API.")}`, "dark");
ui(10, {
  snap: "ship",
  cursor: { path: [[0, { x: 1200, y: 700 }], [1.8, ".ship .btn"], [2.6, ".ship .btn"], [3.6, { x: 1250, y: 960 }]], click: [2.2] },
  cam: [1.65, { x: 1000, y: 900 }, 1.76, { x: 1000, y: 900 }],
  caption: ["Package", "Ready for three surfaces"],
});
ui(6, { snap: "register", cam: [0.74, C, 0.8, C], ring: [{ sel: ".register tbody tr", from: 1.2 }], caption: ["Register", "Every skill on file, with its score"] });

// The angles: how it's built, and who it's for.
word(8, `${eyebrow("Under the hood")}${big("An evaluator-optimizer loop.", "s")}${sub("Generate, test against a fixed set, revise from the failures, keep the best.")}${chips("TypeScript", "pnpm monorepo", "Zod", "Hono + SSE", "React", "Anthropic SDK", "Skills API")}`, "light");
word(6, `${big("For anyone with a workflow worth teaching.", "s")}${sub("And for engineers, a reference build of an agent that tests its own work.")}`, "dark");
word(7, `${logo}${big(grad("SkillSmith"))}${sub("Turn know-how into agent skills · by Balaji Sri Raj")}`, "dark", { mark: "outro" });

run((m) => ({ teaser: [m.reveal, m.reveal + 40 * BEAT], poster: [m.hero + 6 * BEAT, 0] }));
