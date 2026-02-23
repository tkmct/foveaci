#!/usr/bin/env node
import { Command } from "commander";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig, type FovConfig, type TaskConfig } from "../src/config.js";
import { runSessions } from "../src/runner.js";
import { extractRunMetrics, evaluateGates, type RunMetrics } from "../src/metrics.js";
import { generateReport } from "../src/report/index.js";
import {
  generateAdvisorReport,
  type AdvisorFocusArea,
  type AdvisorOptions,
} from "../src/advisor.js";
import { loadRunMetrics, computeDiff, type DiffResult } from "../src/diff.js";
import { generateDiffReport } from "../src/report/diff-report.js";
import {
  discoverScenarios,
  loadScenarioDiscoveryFile,
  writeScenarioDiscoveryArtifacts,
} from "../src/scenario/discovery.js";
import { hasApprovalLabel, loadPrMetadata } from "../src/scenario/pr-context.js";
import type { ScenarioProposal } from "../src/scenario/types.js";

const APPROVAL_LABEL = "ux-eval-approved";
const program = new Command();

interface RunExecutionResult {
  runMetrics: RunMetrics;
}

function printDiffSummary(diff: DiffResult): void {
  console.log("\n[fov] Delta Summary:");
  console.log(
    `  Success Rate: ${diff.deltas.deltaSuccessRate >= 0 ? "+" : ""}${(diff.deltas.deltaSuccessRate * 100).toFixed(2)}%`
  );
  console.log(
    `  Median Time: ${diff.deltas.deltaMedianTaskTimeMs >= 0 ? "+" : ""}${diff.deltas.deltaMedianTaskTimeMs.toFixed(0)}ms`
  );
  console.log(
    `  P95 Time: ${diff.deltas.deltaP95TaskTimeMs >= 0 ? "+" : ""}${diff.deltas.deltaP95TaskTimeMs.toFixed(0)}ms`
  );
  console.log(
    `  Error Rate: ${diff.deltas.deltaErrorRate >= 0 ? "+" : ""}${diff.deltas.deltaErrorRate.toFixed(4)}`
  );
  console.log(
    `  Total Errors: ${diff.deltas.deltaTotalErrors >= 0 ? "+" : ""}${diff.deltas.deltaTotalErrors}`
  );
  console.log(
    `  Rage Clicks: ${diff.deltas.deltaRageClicks >= 0 ? "+" : ""}${diff.deltas.deltaRageClicks}`
  );
}

function detectRegressions(diff: DiffResult): boolean {
  return (
    diff.deltas.deltaSuccessRate < 0 ||
    diff.deltas.deltaMedianTaskTimeMs > 0 ||
    diff.deltas.deltaP95TaskTimeMs > 0 ||
    diff.deltas.deltaErrorRate > 0 ||
    diff.deltas.deltaTotalErrors > 0 ||
    diff.deltas.deltaRageClicks > 0
  );
}

function runCompare(baselineDir: string, candidateDir: string, outDir: string): DiffResult {
  console.log("[fov] Loading baseline metrics...");
  const baseline = loadRunMetrics(baselineDir);
  console.log(
    `[fov] Baseline: ${baseline.totalSessions} sessions, ${(baseline.successRate * 100).toFixed(1)}% success rate`
  );

  console.log("[fov] Loading candidate metrics...");
  const candidate = loadRunMetrics(candidateDir);
  console.log(
    `[fov] Candidate: ${candidate.totalSessions} sessions, ${(candidate.successRate * 100).toFixed(1)}% success rate`
  );

  console.log("[fov] Computing diff...");
  const diff = computeDiff(baseline, candidate);
  printDiffSummary(diff);

  console.log("\n[fov] Generating comparison report...");
  generateDiffReport(diff, outDir);
  console.log(`[fov] Comparison report generated at ${outDir}/index.html`);

  if (detectRegressions(diff)) {
    console.log("\n[fov] Regressions detected");
  } else {
    console.log("\n[fov] No regressions detected");
  }

  return diff;
}

async function executeRun(
  config: FovConfig,
  outDir: string,
  advisorMode: "on" | "off",
  advisorOptions?: AdvisorOptions
): Promise<RunExecutionResult> {
  fs.mkdirSync(path.join(outDir, "sessions"), { recursive: true });
  fs.mkdirSync(path.join(outDir, "report"), { recursive: true });

  console.log(`[fov] Running project: ${config.project.name}`);
  console.log(`[fov] Base URL: ${config.project.baseUrl}`);
  console.log(`[fov] Tasks: ${config.tasks.map((t) => t.id).join(", ")}`);
  console.log(`[fov] Personas: ${config.personas.map((p) => p.id).join(", ")}`);

  const sessionResults = await runSessions(config, outDir);
  const runMetrics = extractRunMetrics(sessionResults);

  fs.writeFileSync(
    path.join(outDir, "run-metrics.json"),
    JSON.stringify(runMetrics, null, 2)
  );
  console.log(`[fov] Run metrics saved to ${outDir}/run-metrics.json`);

  let advisorReport = null;
  if (advisorMode !== "off") {
    advisorReport = generateAdvisorReport(sessionResults, runMetrics, advisorOptions);
    fs.writeFileSync(
      path.join(outDir, "advisor-report.json"),
      JSON.stringify(advisorReport, null, 2)
    );
    console.log(`[fov] Advisor report saved to ${outDir}/advisor-report.json`);

    if (advisorReport.findings.length > 0) {
      console.log(`[fov] Advisor found ${advisorReport.summary.totalFindings} issue(s):`);
      for (const finding of advisorReport.findings) {
        const icon =
          finding.severity === "high" ? "!" : finding.severity === "medium" ? "*" : "-";
        console.log(`  ${icon} [${finding.severity}] ${finding.title}`);
      }
    } else {
      console.log("[fov] Advisor: No issues detected");
    }
  }

  await generateReport(sessionResults, runMetrics, outDir, advisorReport);
  console.log(`[fov] Report generated at ${outDir}/report/index.html`);

  return { runMetrics };
}

function toApprovedTasks(scenarios: ScenarioProposal[]): TaskConfig[] {
  return scenarios.map((scenario, index) => ({
    ...scenario.task,
    id: scenario.task.id || `approved_scenario_${index + 1}`,
  }));
}

function toFocusAreas(scenarios: ScenarioProposal[]): AdvisorFocusArea[] {
  return scenarios.map((scenario) => ({
    id: scenario.id,
    title: scenario.title,
    entry: scenario.task.entry,
    tags: scenario.tags,
    confidence: scenario.confidence,
  }));
}

program.name("fov").description("Synthetic User Swarm FoveaCI Tool").version("0.1.0");

program
  .command("run")
  .description("Run synthetic user sessions")
  .requiredOption("--config <path>", "Path to config YAML")
  .requiredOption("--out <dir>", "Output directory for artifacts")
  .option("--headed", "Run in headed mode", false)
  .option("--advisor <on|off>", "Enable/disable advisor report", "on")
  .action(async (opts: { config: string; out: string; headed: boolean; advisor: "on" | "off" }) => {
    const config = loadConfig(opts.config);
    const outDir = path.resolve(opts.out);

    if (opts.headed) {
      config.run.headless = false;
    }

    await executeRun(config, outDir, opts.advisor);

    if (config.gates && config.gates.length > 0) {
      const runMetrics = loadRunMetrics(outDir);
      const gateResult = evaluateGates(config.gates, runMetrics);
      console.log(`[fov] Gate evaluation: ${gateResult.passed ? "PASS" : "FAIL"}`);
      for (const result of gateResult.results) {
        const icon = result.passed ? "PASS" : "FAIL";
        console.log(
          `  ${icon} ${result.metric} ${result.op} ${result.threshold} (actual: ${result.actual})`
        );
      }
      if (!gateResult.passed) {
        process.exit(1);
      }
    }

    console.log("[fov] Done.");
  });

program
  .command("discover")
  .description("Auto-generate PR scenarios from diff, PR metadata, and changed docs")
  .requiredOption("--base <ref>", "Base git ref (for example: origin/main)")
  .requiredOption("--head <ref>", "Head git ref (for example: HEAD)")
  .requiredOption("--pr-metadata <path>", "Path to PR metadata JSON")
  .requiredOption("--out <dir>", "Output directory for discovery artifacts")
  .action((opts: { base: string; head: string; prMetadata: string; out: string }) => {
    const outDir = path.resolve(opts.out);
    const pr = loadPrMetadata(opts.prMetadata);

    const discovery = discoverScenarios(opts.base, opts.head, pr);
    const artifacts = writeScenarioDiscoveryArtifacts(outDir, discovery);

    console.log(`[fov] Discovered ${discovery.scenarios.length} scenario(s)`);
    console.log(`[fov] Scenario file: ${artifacts.scenarioFile}`);
    console.log(`[fov] Preview file: ${artifacts.previewFile}`);
    console.log(
      `[fov] Approval flow: review scenarios, set approved=true, then add PR label '${APPROVAL_LABEL}'`
    );
  });

program
  .command("pr-eval")
  .description("Run approved PR scenarios after ux-eval-approved label is present")
  .requiredOption("--config <path>", "Path to base config YAML")
  .requiredOption("--scenario-file <path>", "Path to discovered-scenarios.yml")
  .requiredOption("--pr-metadata <path>", "Path to PR metadata JSON")
  .requiredOption("--out <dir>", "Output directory for candidate run artifacts")
  .option("--baseline <dir>", "Optional baseline run directory for diff report")
  .option("--headed", "Run in headed mode", false)
  .option("--advisor <on|off>", "Enable/disable advisor report", "on")
  .option("--skip-label-check", "Run even without approval label", false)
  .action(
    async (opts: {
      config: string;
      scenarioFile: string;
      prMetadata: string;
      out: string;
      baseline?: string;
      headed: boolean;
      advisor: "on" | "off";
      skipLabelCheck: boolean;
    }) => {
      const outDir = path.resolve(opts.out);
      const pr = loadPrMetadata(opts.prMetadata);

      if (!opts.skipLabelCheck && !hasApprovalLabel(pr, APPROVAL_LABEL)) {
        throw new Error(
          `PR label '${APPROVAL_LABEL}' is required before execution. Use --skip-label-check for local dry runs.`
        );
      }

      const scenarioDoc = loadScenarioDiscoveryFile(opts.scenarioFile);
      const approvedScenarios = scenarioDoc.scenarios.filter((s) => s.approved);
      if (approvedScenarios.length === 0) {
        throw new Error(
          "No approved scenarios found. Set approved=true for at least one scenario in the scenario file."
        );
      }

      const baseConfig = loadConfig(opts.config);
      const evalConfig: FovConfig = {
        ...baseConfig,
        tasks: toApprovedTasks(approvedScenarios),
        gates: [],
      };

      if (opts.headed) {
        evalConfig.run.headless = false;
      }

      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(
        path.join(outDir, "pr-eval-context.json"),
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            approvalLabel: APPROVAL_LABEL,
            pr,
            scenarioFile: path.resolve(opts.scenarioFile),
            approvedScenarios: approvedScenarios.map((scenario) => ({
              id: scenario.id,
              title: scenario.title,
              confidence: scenario.confidence,
              taskId: scenario.task.id,
              entry: scenario.task.entry,
            })),
          },
          null,
          2
        )
      );

      const focusAreas = toFocusAreas(approvedScenarios);
      await executeRun(evalConfig, outDir, opts.advisor, {
        focusAreas,
        maxTopSuggestions: 3,
      });

      if (opts.baseline) {
        const baselineDir = path.resolve(opts.baseline);
        const diffOut = path.join(outDir, "diff");
        runCompare(baselineDir, outDir, diffOut);
      }

      console.log("[fov] PR evaluation done.");
    }
  );

program
  .command("compare")
  .description("Compare baseline and candidate runs")
  .requiredOption("--baseline <dir>", "Path to baseline run directory")
  .requiredOption("--candidate <dir>", "Path to candidate run directory")
  .requiredOption("--out <dir>", "Output directory for comparison report")
  .action(async (opts: { baseline: string; candidate: string; out: string }) => {
    const baselineDir = path.resolve(opts.baseline);
    const candidateDir = path.resolve(opts.candidate);
    const outDir = path.resolve(opts.out);
    runCompare(baselineDir, candidateDir, outDir);
    console.log("[fov] Done.");
  });

program.parse();
