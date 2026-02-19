import {
  IconPercentage,
  IconClock,
  IconGauge,
  IconUsers,
  IconAlertTriangle,
  IconClick,
} from "@tabler/icons-react";
import type { RunMetrics } from "../types";

interface MetricsGridProps {
  metrics: RunMetrics;
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  return (
    <div className="sidebar-section">
      <h2>Metrics</h2>
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="label">
            <IconPercentage size={12} /> Success Rate
          </div>
          <div
            className={`value ${metrics.successRate >= 0.95 ? "pass" : "fail"}`}
          >
            {(metrics.successRate * 100).toFixed(1)}%
          </div>
        </div>
        <div className="metric-card">
          <div className="label">
            <IconClock size={12} /> Median Time
          </div>
          <div className="value">
            {(metrics.medianTaskTimeMs / 1000).toFixed(1)}s
          </div>
        </div>
        <div className="metric-card">
          <div className="label">
            <IconGauge size={12} /> p95 Time
          </div>
          <div className="value">
            {(metrics.p95TaskTimeMs / 1000).toFixed(1)}s
          </div>
        </div>
        <div className="metric-card">
          <div className="label">
            <IconUsers size={12} /> Sessions
          </div>
          <div className="value">{metrics.totalSessions}</div>
        </div>
        <div className="metric-card">
          <div className="label">
            <IconAlertTriangle size={12} /> Errors
          </div>
          <div
            className={`value ${metrics.totalErrors > 0 ? "fail" : "pass"}`}
          >
            {metrics.totalErrors}
          </div>
        </div>
        <div className="metric-card">
          <div className="label">
            <IconClick size={12} /> Rage Clicks
          </div>
          <div
            className={`value ${metrics.totalRageClicks > 0 ? "fail" : "pass"}`}
          >
            {metrics.totalRageClicks}
          </div>
        </div>
      </div>
    </div>
  );
}
