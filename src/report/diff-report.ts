import * as fs from "node:fs";
import * as path from "node:path";
import type { DiffResult } from "../diff.js";

export function generateDiffReport(diff: DiffResult, outDir: string): void {
  fs.mkdirSync(outDir, { recursive: true });

  const html = generateDiffHtml(diff);
  fs.writeFileSync(path.join(outDir, "index.html"), html);
}

function formatDelta(delta: number, suffix = ""): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(4)}${suffix}`;
}

function formatPercentDelta(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${(delta * 100).toFixed(2)}%`;
}

function getDeltaClass(
  delta: number,
  metricType: "higher-better" | "lower-better"
): string {
  if (delta === 0) return "neutral";
  if (metricType === "higher-better") {
    return delta > 0 ? "improvement" : "regression";
  } else {
    return delta < 0 ? "improvement" : "regression";
  }
}

function generateDiffHtml(diff: DiffResult): string {
  const { baseline, candidate, deltas } = diff;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FoveaCI Comparison Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f1117;
      color: #e1e4e8;
      min-height: 100vh;
    }
    .header {
      background: #161b22;
      border-bottom: 1px solid #30363d;
      padding: 16px 24px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .header .subtitle {
      font-size: 14px;
      color: #8b949e;
    }

    .container { max-width: 1400px; margin: 0 auto; padding: 24px; }

    .summary {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .summary h2 {
      font-size: 18px;
      margin-bottom: 16px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
    }
    .summary-item {
      padding: 12px;
      background: #0d1117;
      border-radius: 6px;
      border: 1px solid #21262d;
    }
    .summary-item .label {
      font-size: 11px;
      color: #8b949e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .summary-item .value {
      font-size: 14px;
      font-weight: 600;
    }

    .comparison-table {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      overflow: hidden;
    }
    .comparison-table h2 {
      padding: 16px 20px;
      font-size: 18px;
      border-bottom: 1px solid #30363d;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    thead th {
      background: #0d1117;
      padding: 12px 20px;
      text-align: left;
      font-size: 13px;
      font-weight: 600;
      color: #8b949e;
      border-bottom: 1px solid #30363d;
    }
    tbody td {
      padding: 16px 20px;
      border-bottom: 1px solid #21262d;
      font-size: 14px;
    }
    tbody tr:last-child td {
      border-bottom: none;
    }
    tbody tr:hover {
      background: #0d1117;
    }
    .metric-name {
      font-weight: 500;
    }
    .metric-value {
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 13px;
    }
    .delta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 13px;
      font-weight: 600;
    }
    .delta.improvement { color: #3fb950; }
    .delta.regression { color: #f85149; }
    .delta.neutral { color: #8b949e; }
    .delta-icon {
      font-size: 14px;
      display: inline-block;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge.improvement { background: #238636; color: #fff; }
    .badge.regression { background: #da3633; color: #fff; }
    .badge.neutral { background: #6e7681; color: #fff; }

    .legend {
      margin-top: 24px;
      padding: 16px 20px;
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      font-size: 13px;
      color: #8b949e;
    }
    .legend h3 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #e1e4e8;
    }
    .legend ul {
      list-style: none;
      padding-left: 0;
    }
    .legend li {
      margin: 4px 0;
    }
    .legend .improvement-inline { color: #3fb950; font-weight: 600; }
    .legend .regression-inline { color: #f85149; font-weight: 600; }
  </style>
</head>
<body>
  <div class="header">
    <h1>FoveaCI Comparison Report</h1>
    <p class="subtitle">Baseline vs Candidate</p>
  </div>

  <div class="container">
    <div class="summary">
      <h2>Run Summary</h2>
      <div class="summary-grid">
        <div class="summary-item">
          <div class="label">Baseline Sessions</div>
          <div class="value">${baseline.totalSessions}</div>
        </div>
        <div class="summary-item">
          <div class="label">Candidate Sessions</div>
          <div class="value">${candidate.totalSessions}</div>
        </div>
        <div class="summary-item">
          <div class="label">Success Rate Change</div>
          <div class="value ${getDeltaClass(deltas.deltaSuccessRate, "higher-better")}">
            ${formatPercentDelta(deltas.deltaSuccessRate)}
          </div>
        </div>
        <div class="summary-item">
          <div class="label">Median Time Change</div>
          <div class="value ${getDeltaClass(deltas.deltaMedianTaskTimeMs, "lower-better")}">
            ${formatDelta(deltas.deltaMedianTaskTimeMs, "ms")}
          </div>
        </div>
      </div>
    </div>

    <div class="comparison-table">
      <h2>Metric Comparison</h2>
      <table>
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
          <tr>
            <td class="metric-name">Success Rate</td>
            <td class="metric-value">${(baseline.successRate * 100).toFixed(2)}%</td>
            <td class="metric-value">${(candidate.successRate * 100).toFixed(2)}%</td>
            <td>
              <div class="delta ${getDeltaClass(deltas.deltaSuccessRate, "higher-better")}">
                <span class="delta-icon">${deltas.deltaSuccessRate > 0 ? "↑" : deltas.deltaSuccessRate < 0 ? "↓" : "="}</span>
                <span>${formatPercentDelta(deltas.deltaSuccessRate)}</span>
              </div>
            </td>
            <td>
              <span class="badge ${getDeltaClass(deltas.deltaSuccessRate, "higher-better")}">
                ${getDeltaClass(deltas.deltaSuccessRate, "higher-better")}
              </span>
            </td>
          </tr>
          <tr>
            <td class="metric-name">Median Task Time</td>
            <td class="metric-value">${baseline.medianTaskTimeMs.toFixed(0)}ms</td>
            <td class="metric-value">${candidate.medianTaskTimeMs.toFixed(0)}ms</td>
            <td>
              <div class="delta ${getDeltaClass(deltas.deltaMedianTaskTimeMs, "lower-better")}">
                <span class="delta-icon">${deltas.deltaMedianTaskTimeMs > 0 ? "↑" : deltas.deltaMedianTaskTimeMs < 0 ? "↓" : "="}</span>
                <span>${formatDelta(deltas.deltaMedianTaskTimeMs, "ms")}</span>
              </div>
            </td>
            <td>
              <span class="badge ${getDeltaClass(deltas.deltaMedianTaskTimeMs, "lower-better")}">
                ${getDeltaClass(deltas.deltaMedianTaskTimeMs, "lower-better")}
              </span>
            </td>
          </tr>
          <tr>
            <td class="metric-name">P95 Task Time</td>
            <td class="metric-value">${baseline.p95TaskTimeMs.toFixed(0)}ms</td>
            <td class="metric-value">${candidate.p95TaskTimeMs.toFixed(0)}ms</td>
            <td>
              <div class="delta ${getDeltaClass(deltas.deltaP95TaskTimeMs, "lower-better")}">
                <span class="delta-icon">${deltas.deltaP95TaskTimeMs > 0 ? "↑" : deltas.deltaP95TaskTimeMs < 0 ? "↓" : "="}</span>
                <span>${formatDelta(deltas.deltaP95TaskTimeMs, "ms")}</span>
              </div>
            </td>
            <td>
              <span class="badge ${getDeltaClass(deltas.deltaP95TaskTimeMs, "lower-better")}">
                ${getDeltaClass(deltas.deltaP95TaskTimeMs, "lower-better")}
              </span>
            </td>
          </tr>
          <tr>
            <td class="metric-name">Error Rate</td>
            <td class="metric-value">${baseline.errorRate.toFixed(4)}</td>
            <td class="metric-value">${candidate.errorRate.toFixed(4)}</td>
            <td>
              <div class="delta ${getDeltaClass(deltas.deltaErrorRate, "lower-better")}">
                <span class="delta-icon">${deltas.deltaErrorRate > 0 ? "↑" : deltas.deltaErrorRate < 0 ? "↓" : "="}</span>
                <span>${formatDelta(deltas.deltaErrorRate)}</span>
              </div>
            </td>
            <td>
              <span class="badge ${getDeltaClass(deltas.deltaErrorRate, "lower-better")}">
                ${getDeltaClass(deltas.deltaErrorRate, "lower-better")}
              </span>
            </td>
          </tr>
          <tr>
            <td class="metric-name">Total Errors</td>
            <td class="metric-value">${baseline.totalErrors}</td>
            <td class="metric-value">${candidate.totalErrors}</td>
            <td>
              <div class="delta ${getDeltaClass(deltas.deltaTotalErrors, "lower-better")}">
                <span class="delta-icon">${deltas.deltaTotalErrors > 0 ? "↑" : deltas.deltaTotalErrors < 0 ? "↓" : "="}</span>
                <span>${formatDelta(deltas.deltaTotalErrors)}</span>
              </div>
            </td>
            <td>
              <span class="badge ${getDeltaClass(deltas.deltaTotalErrors, "lower-better")}">
                ${getDeltaClass(deltas.deltaTotalErrors, "lower-better")}
              </span>
            </td>
          </tr>
          <tr>
            <td class="metric-name">Total Rage Clicks</td>
            <td class="metric-value">${baseline.totalRageClicks}</td>
            <td class="metric-value">${candidate.totalRageClicks}</td>
            <td>
              <div class="delta ${getDeltaClass(deltas.deltaRageClicks, "lower-better")}">
                <span class="delta-icon">${deltas.deltaRageClicks > 0 ? "↑" : deltas.deltaRageClicks < 0 ? "↓" : "="}</span>
                <span>${formatDelta(deltas.deltaRageClicks)}</span>
              </div>
            </td>
            <td>
              <span class="badge ${getDeltaClass(deltas.deltaRageClicks, "lower-better")}">
                ${getDeltaClass(deltas.deltaRageClicks, "lower-better")}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="legend">
      <h3>Legend</h3>
      <ul>
        <li><span class="improvement-inline">Improvement</span>: Metric moved in a favorable direction (higher success rate, lower time/errors)</li>
        <li><span class="regression-inline">Regression</span>: Metric moved in an unfavorable direction (lower success rate, higher time/errors)</li>
        <li>Neutral: No change in metric</li>
      </ul>
    </div>
  </div>
</body>
</html>`;
}
