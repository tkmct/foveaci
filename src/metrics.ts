import * as fs from "node:fs";
import type { SessionResult } from "./runner.js";
import type { GateConfig } from "./config.js";

export interface RunMetrics {
  totalSessions: number;
  successCount: number;
  failCount: number;
  successRate: number;
  taskTimes: number[];
  medianTaskTimeMs: number;
  p95TaskTimeMs: number;
  totalErrors: number;
  errorRate: number;
  totalRageClicks: number;
  sessions: SessionMetricsSummary[];
}

interface SessionMetricsSummary {
  sessionId: string;
  taskId: string;
  personaId: string;
  success: boolean;
  taskTimeMs: number;
  numErrors: number;
  numRageClicks: number;
}

export interface GateResult {
  passed: boolean;
  results: GateCheckResult[];
}

interface GateCheckResult {
  metric: string;
  op: string;
  threshold: number;
  actual: number;
  passed: boolean;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

export function extractRunMetrics(sessions: SessionResult[]): RunMetrics {
  const successCount = sessions.filter((s) => s.success).length;
  const failCount = sessions.length - successCount;
  const taskTimes = sessions.map((s) => s.taskTimeMs);
  const totalErrors = sessions.reduce((sum, s) => sum + s.errors.length, 0);

  // Read rage clicks from saved metrics files
  let totalRageClicks = 0;
  const sessionSummaries: SessionMetricsSummary[] = [];

  for (const session of sessions) {
    let numRageClicks = 0;
    try {
      const metricsData = JSON.parse(
        fs.readFileSync(session.metricsFile, "utf-8")
      );
      numRageClicks = metricsData.numRageClicks || 0;
      totalRageClicks += numRageClicks;
    } catch {
      // Ignore file read errors
    }

    sessionSummaries.push({
      sessionId: session.sessionId,
      taskId: session.taskId,
      personaId: session.personaId,
      success: session.success,
      taskTimeMs: session.taskTimeMs,
      numErrors: session.errors.length,
      numRageClicks,
    });
  }

  return {
    totalSessions: sessions.length,
    successCount,
    failCount,
    successRate: sessions.length > 0 ? successCount / sessions.length : 0,
    taskTimes,
    medianTaskTimeMs: median(taskTimes),
    p95TaskTimeMs: percentile(taskTimes, 95),
    totalErrors,
    errorRate: sessions.length > 0 ? totalErrors / sessions.length : 0,
    totalRageClicks,
    sessions: sessionSummaries,
  };
}

export function evaluateGates(
  gates: GateConfig[],
  metrics: RunMetrics
): GateResult {
  const results: GateCheckResult[] = [];

  for (const gate of gates) {
    let actual: number;

    switch (gate.metric) {
      case "taskSuccessRate":
      case "successRate":
        actual = metrics.successRate;
        break;
      case "medianTaskTimeMs":
      case "medianTime":
        actual = metrics.medianTaskTimeMs;
        break;
      case "p95TaskTimeMs":
        actual = metrics.p95TaskTimeMs;
        break;
      case "errorRate":
        actual = metrics.errorRate;
        break;
      case "totalErrors":
        actual = metrics.totalErrors;
        break;
      default:
        console.warn(`[fov] Unknown gate metric: ${gate.metric}, skipping`);
        continue;
    }

    let passed: boolean;
    switch (gate.op) {
      case ">=":
        passed = actual >= gate.value;
        break;
      case "<=":
        passed = actual <= gate.value;
        break;
      case ">":
        passed = actual > gate.value;
        break;
      case "<":
        passed = actual < gate.value;
        break;
      case "==":
        passed = actual === gate.value;
        break;
      case "!=":
        passed = actual !== gate.value;
        break;
      default:
        console.warn(`[fov] Unknown gate operator: ${gate.op}, skipping`);
        continue;
    }

    results.push({
      metric: gate.metric,
      op: gate.op,
      threshold: gate.value,
      actual: Math.round(actual * 10000) / 10000,
      passed,
    });
  }

  return {
    passed: results.every((r) => r.passed),
    results,
  };
}
