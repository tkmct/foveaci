import * as fs from "node:fs";
import * as path from "node:path";
import type { RunMetrics } from "./metrics.js";

export interface DiffResult {
  baseline: RunMetrics;
  candidate: RunMetrics;
  deltas: MetricDeltas;
}

export interface MetricDeltas {
  deltaSuccessRate: number;
  deltaMedianTaskTimeMs: number;
  deltaP95TaskTimeMs: number;
  deltaErrorRate: number;
  deltaTotalErrors: number;
  deltaRageClicks: number;
}

export function loadRunMetrics(dir: string): RunMetrics {
  const metricsPath = path.join(dir, "run-metrics.json");

  if (!fs.existsSync(metricsPath)) {
    throw new Error(`run-metrics.json not found in ${dir}`);
  }

  const raw = fs.readFileSync(metricsPath, "utf-8");
  const metrics = JSON.parse(raw) as RunMetrics;

  return metrics;
}

export function computeDiff(baseline: RunMetrics, candidate: RunMetrics): DiffResult {
  // Compute deltas (candidate - baseline)
  const deltas: MetricDeltas = {
    deltaSuccessRate: candidate.successRate - baseline.successRate,
    deltaMedianTaskTimeMs: candidate.medianTaskTimeMs - baseline.medianTaskTimeMs,
    deltaP95TaskTimeMs: candidate.p95TaskTimeMs - baseline.p95TaskTimeMs,
    deltaErrorRate: candidate.errorRate - baseline.errorRate,
    deltaTotalErrors: candidate.totalErrors - baseline.totalErrors,
    deltaRageClicks: candidate.totalRageClicks - baseline.totalRageClicks,
  };

  return {
    baseline,
    candidate,
    deltas,
  };
}
