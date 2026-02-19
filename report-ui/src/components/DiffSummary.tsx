import type { DiffResult } from "../types";
import { formatPercentDelta, formatDelta, getDeltaClass } from "./diff-utils";

interface DiffSummaryProps {
  diff: DiffResult;
}

export function DiffSummary({ diff }: DiffSummaryProps) {
  const { baseline, candidate, deltas } = diff;

  return (
    <div className="diff-summary">
      <h2>Run Summary</h2>
      <div className="summary-grid">
        <div className="summary-item">
          <div className="label">Baseline Sessions</div>
          <div className="value">{baseline.totalSessions}</div>
        </div>
        <div className="summary-item">
          <div className="label">Candidate Sessions</div>
          <div className="value">{candidate.totalSessions}</div>
        </div>
        <div className="summary-item">
          <div className="label">Success Rate Change</div>
          <div
            className={`value ${getDeltaClass(deltas.deltaSuccessRate, "higher-better")}`}
          >
            {formatPercentDelta(deltas.deltaSuccessRate)}
          </div>
        </div>
        <div className="summary-item">
          <div className="label">Median Time Change</div>
          <div
            className={`value ${getDeltaClass(deltas.deltaMedianTaskTimeMs, "lower-better")}`}
          >
            {formatDelta(deltas.deltaMedianTaskTimeMs, "ms")}
          </div>
        </div>
      </div>
    </div>
  );
}
