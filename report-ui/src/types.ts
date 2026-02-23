// Report data types — mirrors src/types/report-data.ts but without Node.js imports
// These are the shapes of the JSON contract between CLI and React app.

export interface StepResult {
  kind: string;
  success: boolean;
  timeMs: number;
  error?: string;
}

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

export interface SessionMetricsSummary {
  sessionId: string;
  taskId: string;
  personaId: string;
  success: boolean;
  taskTimeMs: number;
  numErrors: number;
  numRageClicks: number;
}

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

export interface Evidence {
  sessionId: string;
  timestamp?: number;
  stepIndex?: number;
  description: string;
}

export interface Finding {
  id: string;
  title: string;
  description: string;
  evidence: Evidence[];
  severity: "high" | "medium" | "low";
}

export interface Hypothesis {
  category:
    | "information_deficit"
    | "input_burden"
    | "feedback_deficit"
    | "trust_deficit"
    | "performance"
    | "error"
    | "other";
  description: string;
  confidence: "high" | "medium" | "low";
}

export interface Suggestion {
  title: string;
  description: string;
  expectedImpact: "high" | "medium" | "low";
  implementation?: string;
}

export interface PrioritizedSuggestion extends Suggestion {
  rank: number;
  priorityScore: number;
  rationale: string;
  relatedFocusAreas: string[];
}

export interface AdvisorFocusArea {
  id: string;
  title: string;
  entry?: string;
  tags?: string[];
  confidence?: number;
}

export interface Verification {
  method: string;
  expectedOutcome: string;
  metrics?: string[];
}

export interface AdvisorReport {
  timestamp: number;
  summary: {
    totalFindings: number;
    highSeverityCount: number;
    mediumSeverityCount: number;
    lowSeverityCount: number;
  };
  findings: Finding[];
  hypotheses: Hypothesis[];
  suggestions: Suggestion[];
  topSuggestions?: PrioritizedSuggestion[];
  context?: {
    focusAreas: AdvisorFocusArea[];
  };
  verification: Verification[];
}

export interface MetricDeltas {
  deltaSuccessRate: number;
  deltaMedianTaskTimeMs: number;
  deltaP95TaskTimeMs: number;
  deltaErrorRate: number;
  deltaTotalErrors: number;
  deltaRageClicks: number;
}

export interface DiffResult {
  baseline: RunMetrics;
  candidate: RunMetrics;
  deltas: MetricDeltas;
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
