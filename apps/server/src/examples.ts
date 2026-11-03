// Worked interviews used by "Try an example" and the eval suite. Each is a real conversation shape:
// the interviewer's questions, then the answers someone would give.
export type Example = { id: string; title: string; answers: string[]; extra?: { examples: { input: string; output: string }[] } };

export const EXAMPLES: Example[] = [
  {
    id: "release-notes",
    title: "Release notes from merged PRs",
    answers: [
      "Write customer-facing release notes from a list of merged pull requests.",
      "when someone pastes merged pull requests and asks for release notes; when preparing a changelog for a version release",
      "a list of merged pull request titles and descriptions; the version number",
      "group changes into new features, improvements and fixes; rewrite each change in plain customer language; drop internal refactors and test-only changes; lead with the most important change",
      "a markdown document with a version heading, a one-line summary and grouped bullet lists",
      "never mention internal ticket numbers; every bullet starts with a verb; keep each bullet under 20 words",
      "reviewing the code in a pull request; writing an internal engineering changelog",
    ],
    extra: { examples: [{ input: "PR #412 Add CSV export to reports\nPR #415 Refactor auth middleware\nPR #417 Fix timezone bug in scheduler", output: "## v2.4\nReports can now be exported.\n\n### New\n- Export any report to CSV\n\n### Fixes\n- Scheduled jobs now respect your timezone" }] },
  },
  {
    id: "incident-postmortem",
    title: "Blameless incident postmortems",
    answers: [
      "Draft a blameless postmortem document from an incident timeline and chat logs.",
      "when someone shares an incident timeline and asks for a postmortem; when writing up an outage review",
      "the incident timeline; chat logs from the incident channel; the impact numbers",
      "build a timeline with timestamps; identify the trigger, the root cause and contributing factors; list what went well and what did not; propose action items with owners",
      "a markdown postmortem with summary, impact, timeline, root cause, contributing factors, action items",
      "blameless language that never names individuals as causes; every action item has an owner and a due date; separate root cause from contributing factors",
      "turning meeting transcripts into minutes; reviewing code changes",
    ],
  },
  {
    id: "sales-summary",
    title: "Weekly sales summary",
    answers: [
      "Turn a weekly sales CSV export into a short summary for the leadership team.",
      "when someone shares a sales export and asks for the weekly summary; when preparing the Monday sales update",
      "a CSV export of deals with region, amount, stage and close date",
      "total the closed revenue by region; compare against the previous week; call out the three largest deals; flag deals stuck in a stage for more than 30 days",
      "a one-page markdown summary with headline numbers, a region table and three bullet call-outs",
      "lead with the headline number; round money to the nearest thousand; never speculate beyond the data",
      "building a spreadsheet model with formulas; planning a sales offsite trip",
    ],
  },
];
