import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import yaml from "js-yaml";
import { collectDocHints } from "./doc-hints.js";
import { deriveScenarioProposals } from "./derive.js";
import type { PrMetadata, ScenarioDiscoveryOutput } from "./types.js";

function safeExec(command: string): string {
  try {
    return execSync(command, { encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

export function getChangedFiles(baseRef: string, headRef: string): string[] {
  const output = safeExec(`git diff --name-only ${baseRef}...${headRef}`);
  if (!output) return [];
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function discoverScenarios(
  baseRef: string,
  headRef: string,
  pr: PrMetadata
): ScenarioDiscoveryOutput {
  const changedFiles = getChangedFiles(baseRef, headRef);
  const docHints = collectDocHints(baseRef, headRef);
  const scenarios = deriveScenarioProposals({
    pr,
    changedFiles,
    docHints,
  });

  return {
    generatedAt: new Date().toISOString(),
    baseRef,
    headRef,
    pr,
    changedFiles,
    docHints,
    scenarios,
  };
}

function renderSources(scenario: ScenarioDiscoveryOutput["scenarios"][number]): string {
  return scenario.sources
    .map((source) => {
      if (source.file) {
        return `${source.type}: ${source.file} - ${source.excerpt}`;
      }
      return `${source.type}: ${source.excerpt}`;
    })
    .join("; ");
}

function previewMarkdown(doc: ScenarioDiscoveryOutput): string {
  const lines: string[] = [];
  lines.push("# Scenario Preview");
  lines.push("");
  lines.push(`- Generated: ${doc.generatedAt}`);
  lines.push(`- Base: \`${doc.baseRef}\``);
  lines.push(`- Head: \`${doc.headRef}\``);
  if (doc.pr.number !== undefined) {
    lines.push(`- PR: #${doc.pr.number}`);
  }
  lines.push(`- Title: ${doc.pr.title}`);
  lines.push(`- Labels: ${(doc.pr.labels || []).join(", ") || "(none)"}`);
  lines.push("");
  lines.push("## Proposed Scenarios");
  lines.push("");
  lines.push("| ID | Approved | Confidence | Entry | Goal | Sources |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const scenario of doc.scenarios) {
    lines.push(
      `| ${scenario.id} | ${scenario.approved ? "yes" : "no"} | ${scenario.confidence.toFixed(2)} | \`${scenario.task.entry}\` | ${scenario.goal} | ${renderSources(scenario)} |`
    );
  }
  lines.push("");
  lines.push("## Review and Approval Flow");
  lines.push("");
  lines.push("1. Review `discovered-scenarios.yml` and set `approved: true` only for scenarios you want to execute.");
  lines.push("2. Add PR label `ux-eval-approved` after scenario review is complete.");
  lines.push(
    "3. Run: `fov pr-eval --config <config.yml> --scenario-file <discovered-scenarios.yml> --pr-metadata <pr.json> --out <dir>`"
  );
  lines.push("");
  lines.push("## Input Sources");
  lines.push("");
  lines.push("- PR metadata: title/body/labels");
  lines.push("- Code diff: changed files between base and head");
  lines.push("- Docs diff (added lines only): `README.md`, `SPEC.md`, `docs/`");
  return `${lines.join("\n")}\n`;
}

export function writeScenarioDiscoveryArtifacts(
  outDir: string,
  doc: ScenarioDiscoveryOutput
): { scenarioFile: string; previewFile: string } {
  fs.mkdirSync(outDir, { recursive: true });

  const scenarioFile = path.join(outDir, "discovered-scenarios.yml");
  const previewFile = path.join(outDir, "scenario-preview.md");

  fs.writeFileSync(scenarioFile, yaml.dump(doc, { lineWidth: 120 }));
  fs.writeFileSync(previewFile, previewMarkdown(doc));

  return { scenarioFile, previewFile };
}

export function loadScenarioDiscoveryFile(
  filePath: string
): ScenarioDiscoveryOutput {
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = yaml.load(raw) as ScenarioDiscoveryOutput;
  if (!parsed || !Array.isArray(parsed.scenarios)) {
    throw new Error(`Invalid scenario file: ${filePath}`);
  }
  return parsed;
}

