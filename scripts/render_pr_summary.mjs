#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const MARKER = "<!-- fov-pr-ux-eval -->";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    args[name] = value;
  }
  return args;
}

function pct(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function num(value, digits = 2) {
  return Number(value || 0).toFixed(digits);
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function maybeLoadJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return loadJson(filePath);
}

function relPath(filePath) {
  return path.relative(process.cwd(), path.resolve(filePath));
}

const args = parseArgs(process.argv);
const scenarioFile = args["scenario-file"];
const outputFile = args.output;
const prMetadataFile = args["pr-metadata"];
const candidateDir = args["candidate-dir"];
const diffDir = args["diff-dir"];
const previewFile = args["preview-file"];
const artifactName = args["artifact-name"];
const localServeCmd = args["local-serve-cmd"];
const localOpenCmd = args["local-open-cmd"] || "http://localhost:4173/index.html";

if (!scenarioFile || !outputFile) {
  console.error(
    "Usage: node scripts/render_pr_summary.mjs --scenario-file <file.yml> --output <comment.md> [--pr-metadata <pr.json>] [--candidate-dir <dir>] [--diff-dir <dir>] [--preview-file <file>] [--artifact-name <name>] [--local-serve-cmd <cmd>] [--local-open-cmd <url>]"
  );
  process.exit(1);
}

const scenariosDoc = yaml.load(fs.readFileSync(scenarioFile, "utf-8"));
if (!scenariosDoc || typeof scenariosDoc !== "object" || !Array.isArray(scenariosDoc.scenarios)) {
  console.error(`Invalid scenario file: ${scenarioFile}`);
  process.exit(1);
}

const pr = prMetadataFile && fs.existsSync(prMetadataFile) ? loadJson(prMetadataFile) : null;
const runMetrics = maybeLoadJson(candidateDir ? path.join(candidateDir, "run-metrics.json") : "");
const diffReport = maybeLoadJson(diffDir ? path.join(diffDir, "report-data.json") : "");
const advisorReport = maybeLoadJson(candidateDir ? path.join(candidateDir, "advisor-report.json") : "");

const approvedCount = scenariosDoc.scenarios.filter((scenario) => scenario.approved).length;
const status = runMetrics
  ? "Executed"
  : approvedCount > 0
    ? "Approved, waiting for run"
    : "Preview only, waiting for approval";

const lines = [];
lines.push(MARKER);
lines.push("## FoveaCI PR UX Evaluation");
lines.push("");
if (pr) {
  lines.push(`- PR: #${pr.number} ${pr.title}`);
}
lines.push(`- Status: **${status}**`);
lines.push(`- Scenarios: ${approvedCount}/${scenariosDoc.scenarios.length} approved`);
lines.push("- Approval label: `ux-eval-approved`");
lines.push("");

lines.push("### Proposed Scenarios");
lines.push("");
lines.push("| ID | Approved | Confidence | Entry | Goal |");
lines.push("| --- | --- | --- | --- | --- |");
for (const scenario of scenariosDoc.scenarios) {
  lines.push(
    `| ${scenario.id} | ${scenario.approved ? "yes" : "no"} | ${num(scenario.confidence, 2)} | \`${scenario.task?.entry || "/"}\` | ${scenario.goal || ""} |`
  );
}
lines.push("");

if (runMetrics) {
  lines.push("### Candidate Run Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Total sessions | ${runMetrics.totalSessions} |`);
  lines.push(`| Success rate | ${pct(runMetrics.successRate)} |`);
  lines.push(`| Median task time | ${num(runMetrics.medianTaskTimeMs, 0)} ms |`);
  lines.push(`| Total errors | ${runMetrics.totalErrors} |`);
  lines.push("");
}

if (advisorReport && Array.isArray(advisorReport.topSuggestions) && advisorReport.topSuggestions.length > 0) {
  lines.push("### Advisor Top Suggestions");
  lines.push("");
  lines.push("| Rank | Suggestion | Impact | Score | Rationale |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const suggestion of advisorReport.topSuggestions.slice(0, 3)) {
    lines.push(
      `| ${suggestion.rank} | ${suggestion.title} | ${suggestion.expectedImpact} | ${num(suggestion.priorityScore, 2)} | ${suggestion.rationale || ""} |`
    );
  }
  lines.push("");
}

if (diffReport && diffReport.kind === "diff") {
  const deltas = diffReport.diff?.deltas || {};
  lines.push("### Baseline Diff");
  lines.push("");
  lines.push("| Delta metric | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Success rate | ${(Number(deltas.deltaSuccessRate || 0) * 100).toFixed(2)}% |`);
  lines.push(`| Median task time | ${num(deltas.deltaMedianTaskTimeMs, 0)} ms |`);
  lines.push(`| Error rate | ${num(deltas.deltaErrorRate, 4)} |`);
  lines.push(`| Total errors | ${num(deltas.deltaTotalErrors, 0)} |`);
  lines.push("");
}

lines.push("### Review Flow");
lines.push("");
lines.push("1. Confirm proposed scenarios match the feature changes in this PR.");
lines.push("2. Add PR label `ux-eval-approved` to approve execution.");
lines.push("3. Workflow executes approved scenarios and updates this comment.");
lines.push("");

lines.push("### Artifacts");
lines.push("");
if (artifactName) {
  lines.push(`- Artifact name: \`${artifactName}\``);
}
lines.push(`- Scenario file: \`${relPath(scenarioFile)}\``);
if (previewFile) {
  lines.push(`- Preview: \`${relPath(previewFile)}\``);
}
if (candidateDir) {
  lines.push(`- Candidate run: \`${relPath(candidateDir)}\``);
}
if (diffDir) {
  lines.push(`- Diff report: \`${relPath(diffDir)}\``);
}
lines.push("");

if (artifactName || localServeCmd) {
  lines.push("### Open Replay Locally");
  lines.push("");
  lines.push("1. Download and extract the workflow artifact.");
  if (artifactName) {
    lines.push(`2. Use artifact: \`${artifactName}\``);
  }
  if (localServeCmd) {
    lines.push(`3. Run local server: \`${localServeCmd}\``);
  } else {
    lines.push("3. Run local server from foveaci repo:");
    lines.push("   `node ./dist/bin/fov.js serve-report --dir ./artifacts/pr-eval/report --port 4173`");
  }
  lines.push(`4. Open replay UI: \`${localOpenCmd}\``);
  lines.push("");
}

lines.push(`_Updated: ${new Date().toISOString()}_`);
lines.push("");

const out = lines.join("\n");
const outPath = path.resolve(outputFile);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out);
console.log(`[fov] Wrote ${outPath}`);
