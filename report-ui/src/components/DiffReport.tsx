import { IconSun, IconMoon } from "@tabler/icons-react";
import { useTheme } from "../theme/ThemeProvider";
import { DiffSummary } from "./DiffSummary";
import { DiffTable } from "./DiffTable";
import type { DiffReportData } from "../types";

interface DiffReportProps {
  data: DiffReportData;
}

export function DiffReport({ data }: DiffReportProps) {
  const { theme, toggle } = useTheme();

  return (
    <div className="diff-app">
      <div className="diff-header">
        <h1>FoveaCI Comparison Report</h1>
        <p className="subtitle">Baseline vs Candidate</p>
        <button
          className="theme-toggle"
          onClick={toggle}
          style={{ marginLeft: "auto" }}
        >
          {theme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
        </button>
      </div>
      <div className="diff-container">
        <DiffSummary diff={data.diff} />
        <DiffTable diff={data.diff} />
        <div className="diff-legend">
          <h3>Legend</h3>
          <ul>
            <li>
              <span className="improvement-inline">Improvement</span>: Metric
              moved in a favorable direction (higher success rate, lower
              time/errors)
            </li>
            <li>
              <span className="regression-inline">Regression</span>: Metric
              moved in an unfavorable direction (lower success rate, higher
              time/errors)
            </li>
            <li>Neutral: No change in metric</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
