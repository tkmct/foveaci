import type { RunMetrics } from "../metrics.js";
import type { AdvisorReport } from "../advisor.js";
import type { StepResult } from "../runner.js";
import type { DiffResult } from "../diff.js";

export interface ReportSessionData {
  sessionId: string;
  taskId: string;
  personaId: string;
  success: boolean;
  startTime: number;
  endTime: number;
  taskTimeMs: number;
  errors: string[];
  steps: StepResult[];
  events: unknown[];
}

export interface MainReportData {
  kind: "main";
  generatedAt: string;
  metrics: RunMetrics;
  advisor: AdvisorReport | null;
  sessions: ReportSessionData[];
}

export interface DiffReportData {
  kind: "diff";
  generatedAt: string;
  diff: DiffResult;
}

export type ReportData = MainReportData | DiffReportData;
