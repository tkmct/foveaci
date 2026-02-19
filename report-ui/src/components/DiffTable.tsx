import type { DiffResult } from "../types";
import {
  formatDelta,
  formatPercentDelta,
  getDeltaClass,
  deltaIcon,
} from "./diff-utils";

interface DiffTableProps {
  diff: DiffResult;
}

interface MetricRow {
  name: string;
  baseline: string;
  candidate: string;
  delta: number;
  deltaFormatted: string;
  metricType: "higher-better" | "lower-better";
}

export function DiffTable({ diff }: DiffTableProps) {
  const { baseline, candidate, deltas } = diff;

  const rows: MetricRow[] = [
    {
      name: "Success Rate",
      baseline: `${(baseline.successRate * 100).toFixed(2)}%`,
      candidate: `${(candidate.successRate * 100).toFixed(2)}%`,
      delta: deltas.deltaSuccessRate,
      deltaFormatted: formatPercentDelta(deltas.deltaSuccessRate),
      metricType: "higher-better",
    },
    {
      name: "Median Task Time",
      baseline: `${baseline.medianTaskTimeMs.toFixed(0)}ms`,
      candidate: `${candidate.medianTaskTimeMs.toFixed(0)}ms`,
      delta: deltas.deltaMedianTaskTimeMs,
      deltaFormatted: formatDelta(deltas.deltaMedianTaskTimeMs, "ms"),
      metricType: "lower-better",
    },
    {
      name: "P95 Task Time",
      baseline: `${baseline.p95TaskTimeMs.toFixed(0)}ms`,
      candidate: `${candidate.p95TaskTimeMs.toFixed(0)}ms`,
      delta: deltas.deltaP95TaskTimeMs,
      deltaFormatted: formatDelta(deltas.deltaP95TaskTimeMs, "ms"),
      metricType: "lower-better",
    },
    {
      name: "Error Rate",
      baseline: baseline.errorRate.toFixed(4),
      candidate: candidate.errorRate.toFixed(4),
      delta: deltas.deltaErrorRate,
      deltaFormatted: formatDelta(deltas.deltaErrorRate),
      metricType: "lower-better",
    },
    {
      name: "Total Errors",
      baseline: String(baseline.totalErrors),
      candidate: String(candidate.totalErrors),
      delta: deltas.deltaTotalErrors,
      deltaFormatted: formatDelta(deltas.deltaTotalErrors),
      metricType: "lower-better",
    },
    {
      name: "Total Rage Clicks",
      baseline: String(baseline.totalRageClicks),
      candidate: String(candidate.totalRageClicks),
      delta: deltas.deltaRageClicks,
      deltaFormatted: formatDelta(deltas.deltaRageClicks),
      metricType: "lower-better",
    },
  ];

  return (
    <div className="diff-table-card">
      <h2>Metric Comparison</h2>
      <table className="diff-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Baseline</th>
            <th>Candidate</th>
            <th>Delta</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const cls = getDeltaClass(row.delta, row.metricType);
            return (
              <tr key={row.name}>
                <td className="metric-name">{row.name}</td>
                <td className="metric-value">{row.baseline}</td>
                <td className="metric-value">{row.candidate}</td>
                <td>
                  <div className={`delta ${cls}`}>
                    <span>{deltaIcon(row.delta)}</span>
                    <span>{row.deltaFormatted}</span>
                  </div>
                </td>
                <td>
                  <span className={`status-badge ${cls}`}>{cls}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
