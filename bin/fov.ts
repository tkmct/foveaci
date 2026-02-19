#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "../src/config.js";
import { runSessions } from "../src/runner.js";
import { extractRunMetrics, evaluateGates } from "../src/metrics.js";
import { generateReport } from "../src/report/index.js";
import { generateAdvisorReport } from "../src/advisor.js";
import { loadRunMetrics, computeDiff } from "../src/diff.js";
import { generateDiffReport } from "../src/report/diff-report.js";
import * as fs from "node:fs";
import * as path from "node:path";

const program = new Command();

program
  .name("fov")
  .description("Synthetic User Swarm FoveaCI Tool")
  .version("0.1.0");

program
  .command("run")
  .description("Run synthetic user sessions")
  .requiredOption("--config <path>", "Path to config YAML")
  .requiredOption("--out <dir>", "Output directory for artifacts")
  .option("--headed", "Run in headed mode", false)
  .option("--advisor <on|off>", "Enable/disable advisor report", "on")
  .action(async (opts) => {
    const config = loadConfig(opts.config);
    const outDir = path.resolve(opts.out);

    // Override headless if --headed
    if (opts.headed) {
      config.run.headless = false;
    }

    // Create output directories
    fs.mkdirSync(path.join(outDir, "sessions"), { recursive: true });
    fs.mkdirSync(path.join(outDir, "report"), { recursive: true });

    console.log(`[fov] Running project: ${config.project.name}`);
    console.log(`[fov] Base URL: ${config.project.baseUrl}`);
    console.log(
      `[fov] Tasks: ${config.tasks.map((t) => t.id).join(", ")}`
    );
    console.log(
      `[fov] Personas: ${config.personas.map((p) => p.id).join(", ")}`
    );

    // Run sessions
    const sessionResults = await runSessions(config, outDir);

    // Extract metrics
    const runMetrics = extractRunMetrics(sessionResults);

    // Save run metrics
    fs.writeFileSync(
      path.join(outDir, "run-metrics.json"),
      JSON.stringify(runMetrics, null, 2)
    );
    console.log(`[fov] Run metrics saved to ${outDir}/run-metrics.json`);

    // Generate advisor report if enabled
    let advisorReport = null;
    if (opts.advisor !== "off") {
      advisorReport = generateAdvisorReport(sessionResults, runMetrics);
      fs.writeFileSync(
        path.join(outDir, "advisor-report.json"),
        JSON.stringify(advisorReport, null, 2)
      );
      console.log(`[fov] Advisor report saved to ${outDir}/advisor-report.json`);

      // Print summary to console
      if (advisorReport.findings.length > 0) {
        console.log(`[fov] Advisor found ${advisorReport.summary.totalFindings} issue(s):`);
        for (const finding of advisorReport.findings) {
          const icon = finding.severity === "high" ? "⚠" : finding.severity === "medium" ? "●" : "○";
          console.log(`  ${icon} [${finding.severity}] ${finding.title}`);
        }
      } else {
        console.log(`[fov] Advisor: No issues detected`);
      }
    }

    // Generate report
    await generateReport(sessionResults, runMetrics, outDir, advisorReport);
    console.log(
      `[fov] Report generated at ${outDir}/report/index.html`
    );

    // Gate evaluation
    if (config.gates && config.gates.length > 0) {
      const gateResult = evaluateGates(config.gates, runMetrics);
      console.log(`[fov] Gate evaluation: ${gateResult.passed ? "PASS" : "FAIL"}`);
      for (const r of gateResult.results) {
        const icon = r.passed ? "✓" : "✗";
        console.log(
          `  ${icon} ${r.metric} ${r.op} ${r.threshold} (actual: ${r.actual})`
        );
      }
      if (!gateResult.passed) {
        process.exit(1);
      }
    }

    console.log("[fov] Done.");
  });

program
  .command("compare")
  .description("Compare baseline and candidate runs")
  .requiredOption("--baseline <dir>", "Path to baseline run directory")
  .requiredOption("--candidate <dir>", "Path to candidate run directory")
  .requiredOption("--out <dir>", "Output directory for comparison report")
  .action(async (opts) => {
    const baselineDir = path.resolve(opts.baseline);
    const candidateDir = path.resolve(opts.candidate);
    const outDir = path.resolve(opts.out);

    console.log("[fov] Loading baseline metrics...");
    const baseline = loadRunMetrics(baselineDir);
    console.log(`[fov] Baseline: ${baseline.totalSessions} sessions, ${(baseline.successRate * 100).toFixed(1)}% success rate`);

    console.log("[fov] Loading candidate metrics...");
    const candidate = loadRunMetrics(candidateDir);
    console.log(`[fov] Candidate: ${candidate.totalSessions} sessions, ${(candidate.successRate * 100).toFixed(1)}% success rate`);

    console.log("[fov] Computing diff...");
    const diff = computeDiff(baseline, candidate);

    // Print summary
    console.log("\n[fov] Delta Summary:");
    console.log(`  Success Rate: ${diff.deltas.deltaSuccessRate >= 0 ? "+" : ""}${(diff.deltas.deltaSuccessRate * 100).toFixed(2)}%`);
    console.log(`  Median Time: ${diff.deltas.deltaMedianTaskTimeMs >= 0 ? "+" : ""}${diff.deltas.deltaMedianTaskTimeMs.toFixed(0)}ms`);
    console.log(`  P95 Time: ${diff.deltas.deltaP95TaskTimeMs >= 0 ? "+" : ""}${diff.deltas.deltaP95TaskTimeMs.toFixed(0)}ms`);
    console.log(`  Error Rate: ${diff.deltas.deltaErrorRate >= 0 ? "+" : ""}${diff.deltas.deltaErrorRate.toFixed(4)}`);
    console.log(`  Total Errors: ${diff.deltas.deltaTotalErrors >= 0 ? "+" : ""}${diff.deltas.deltaTotalErrors}`);
    console.log(`  Rage Clicks: ${diff.deltas.deltaRageClicks >= 0 ? "+" : ""}${diff.deltas.deltaRageClicks}`);

    // Generate report
    console.log("\n[fov] Generating comparison report...");
    generateDiffReport(diff, outDir);
    console.log(`[fov] Comparison report generated at ${outDir}/index.html`);

    // Detect regressions
    const hasRegressions =
      diff.deltas.deltaSuccessRate < 0 ||
      diff.deltas.deltaMedianTaskTimeMs > 0 ||
      diff.deltas.deltaP95TaskTimeMs > 0 ||
      diff.deltas.deltaErrorRate > 0 ||
      diff.deltas.deltaTotalErrors > 0 ||
      diff.deltas.deltaRageClicks > 0;

    if (hasRegressions) {
      console.log("\n[fov] ⚠ Regressions detected!");
    } else {
      console.log("\n[fov] ✓ No regressions detected");
    }

    console.log("[fov] Done.");
  });

program.parse();
