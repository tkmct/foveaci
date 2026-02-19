import * as fs from "node:fs";
import type { SessionResult } from "./runner.js";
import type { RunMetrics } from "./metrics.js";

/**
 * Evidence links to specific points in time/sessions
 */
export interface Evidence {
  sessionId: string;
  timestamp?: number;
  stepIndex?: number;
  description: string;
}

/**
 * Factual observation from the data
 */
export interface Finding {
  id: string;
  title: string;
  description: string;
  evidence: Evidence[];
  severity: "high" | "medium" | "low";
}

/**
 * Root cause hypothesis categorized by UX issue type
 */
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

/**
 * Actionable suggestion for improvement
 */
export interface Suggestion {
  title: string;
  description: string;
  expectedImpact: "high" | "medium" | "low";
  implementation?: string;
}

/**
 * How to verify the fix worked
 */
export interface Verification {
  method: string;
  expectedOutcome: string;
  metrics?: string[];
}

/**
 * Complete advisor report
 */
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
  verification: Verification[];
}

interface SessionMetricsData {
  sessionId: string;
  taskId: string;
  personaId: string;
  success: boolean;
  taskTimeMs: number;
  numErrors: number;
  numRageClicks: number;
  scrollOscillation: number;
  steps: Array<{
    kind: string;
    success: boolean;
    timeMs: number;
    error?: string;
  }>;
  errors: string[];
}

/**
 * Load detailed session metrics from file
 */
function loadSessionMetrics(session: SessionResult): SessionMetricsData | null {
  try {
    const data = JSON.parse(fs.readFileSync(session.metricsFile, "utf-8"));
    return data as SessionMetricsData;
  } catch {
    return null;
  }
}

/**
 * Rule 1: Detect rage clicks
 */
function detectRageClickIssues(
  sessions: SessionResult[],
  findings: Finding[],
  hypotheses: Hypothesis[],
  suggestions: Suggestion[],
  verifications: Verification[]
): void {
  const rageClickSessions: SessionMetricsData[] = [];

  for (const session of sessions) {
    const metrics = loadSessionMetrics(session);
    if (metrics && metrics.numRageClicks > 0) {
      rageClickSessions.push(metrics);
    }
  }

  if (rageClickSessions.length === 0) return;

  const totalRageClicks = rageClickSessions.reduce(
    (sum, m) => sum + m.numRageClicks,
    0
  );

  findings.push({
    id: "rage-clicks",
    title: "Rage Clicks Detected",
    description: `Users exhibited rage clicking behavior in ${rageClickSessions.length} session(s), with a total of ${totalRageClicks} rage click event(s). This indicates frustration with unresponsive or unclear interactive elements.`,
    evidence: rageClickSessions.map((m) => ({
      sessionId: m.sessionId,
      description: `${m.numRageClicks} rage click(s) detected`,
    })),
    severity: totalRageClicks > 5 ? "high" : "medium",
  });

  hypotheses.push({
    category: "feedback_deficit",
    description:
      "Elements are not providing adequate feedback when clicked, or buttons appear clickable but do not respond immediately. Users may be clicking repeatedly because they don't see visual confirmation that their action was registered.",
    confidence: "high",
  });

  suggestions.push({
    title: "Add Visual Feedback to Interactive Elements",
    description:
      "Implement loading states, button disabled states, or visual feedback (ripple effects, color changes) immediately on click. Consider adding hover states to clarify which elements are interactive.",
    expectedImpact: "high",
    implementation:
      "Add CSS transitions for :hover and :active states, implement loading spinners for async actions, use aria-busy attribute during processing.",
  });

  verifications.push({
    method: "Re-run the same tasks after implementing visual feedback",
    expectedOutcome: "Rage click count should decrease to near zero",
    metrics: ["numRageClicks", "taskTimeMs"],
  });
}

/**
 * Rule 2: Detect high error rate
 */
function detectErrorIssues(
  sessions: SessionResult[],
  metrics: RunMetrics,
  findings: Finding[],
  hypotheses: Hypothesis[],
  suggestions: Suggestion[],
  verifications: Verification[]
): void {
  if (metrics.totalErrors === 0) return;

  const errorSessions = sessions.filter((s) => s.errors.length > 0);
  const consoleErrors = new Set<string>();

  for (const session of errorSessions) {
    for (const error of session.errors) {
      consoleErrors.add(error);
    }
  }

  const severity: "high" | "medium" | "low" =
    metrics.errorRate > 2 ? "high" : metrics.errorRate > 1 ? "medium" : "low";

  findings.push({
    id: "console-errors",
    title: "Console Errors Detected",
    description: `${metrics.totalErrors} console error(s) occurred across ${errorSessions.length} session(s). Error rate: ${metrics.errorRate.toFixed(2)} errors per session. Unique errors: ${consoleErrors.size}`,
    evidence: errorSessions.slice(0, 5).map((s) => ({
      sessionId: s.sessionId,
      description: `${s.errors.length} error(s): ${s.errors.slice(0, 2).join("; ")}${s.errors.length > 2 ? "..." : ""}`,
    })),
    severity,
  });

  hypotheses.push({
    category: "error",
    description:
      "JavaScript errors are occurring during task execution, which may indicate broken functionality, missing error handling, or compatibility issues.",
    confidence: "high",
  });

  suggestions.push({
    title: "Fix Console Errors",
    description: `Review and fix the ${consoleErrors.size} unique console error(s). These errors may be preventing proper functionality or degrading user experience.`,
    expectedImpact: severity === "high" ? "high" : "medium",
    implementation:
      "Check browser console during manual testing, add error boundaries, implement proper null checks and error handling.",
  });

  verifications.push({
    method: "Re-run sessions and monitor console logs",
    expectedOutcome: "Zero console errors in all sessions",
    metrics: ["totalErrors", "errorRate"],
  });
}

/**
 * Rule 3: Analyze failed steps
 */
function detectFailedStepPatterns(
  sessions: SessionResult[],
  findings: Finding[],
  hypotheses: Hypothesis[],
  suggestions: Suggestion[],
  verifications: Verification[]
): void {
  const stepFailures = new Map<string, number>();
  const failedSessionsWithSteps: Array<{
    session: SessionResult;
    failedSteps: Array<{ kind: string; error?: string; index: number }>;
  }> = [];

  for (const session of sessions) {
    const failedSteps: Array<{ kind: string; error?: string; index: number }> =
      [];
    session.steps.forEach((step, index) => {
      if (!step.success) {
        stepFailures.set(step.kind, (stepFailures.get(step.kind) || 0) + 1);
        failedSteps.push({ kind: step.kind, error: step.error, index });
      }
    });
    if (failedSteps.length > 0) {
      failedSessionsWithSteps.push({ session, failedSteps });
    }
  }

  if (stepFailures.size === 0) return;

  const mostFailedStep = Array.from(stepFailures.entries()).sort(
    (a, b) => b[1] - a[1]
  )[0];
  const totalFailedSteps = Array.from(stepFailures.values()).reduce(
    (sum, n) => sum + n,
    0
  );

  findings.push({
    id: "failed-steps",
    title: "Step Execution Failures",
    description: `${totalFailedSteps} step(s) failed across ${failedSessionsWithSteps.length} session(s). Most common failure: "${mostFailedStep[0]}" (${mostFailedStep[1]} time(s))`,
    evidence: failedSessionsWithSteps.slice(0, 5).map(({ session, failedSteps }) => ({
      sessionId: session.sessionId,
      stepIndex: failedSteps[0].index,
      description: `Failed step: ${failedSteps[0].kind}${failedSteps[0].error ? ` - ${failedSteps[0].error}` : ""}`,
    })),
    severity: failedSessionsWithSteps.length > sessions.length * 0.3 ? "high" : "medium",
  });

  if (mostFailedStep[0] === "click") {
    hypotheses.push({
      category: "information_deficit",
      description:
        "Click targets are not being found or are not visible. This could indicate that elements are not loading, are hidden, or selectors are incorrect.",
      confidence: "high",
    });

    suggestions.push({
      title: "Verify Element Visibility and Selectors",
      description:
        "Check that clickable elements are visible and accessible. Review element selectors to ensure they match the actual DOM structure. Consider adding wait conditions for dynamic content.",
      expectedImpact: "high",
      implementation:
        "Add explicit wait conditions before clicks, verify z-index and visibility CSS, check for overlay elements blocking clicks.",
    });
  } else if (mostFailedStep[0] === "type") {
    hypotheses.push({
      category: "input_burden",
      description:
        "Input fields are not accessible or not accepting input. This may indicate timing issues, disabled fields, or incorrect field selectors.",
      confidence: "high",
    });

    suggestions.push({
      title: "Verify Input Field Accessibility",
      description:
        "Ensure input fields are enabled and focusable. Check for JavaScript that might be interfering with input. Verify field selectors are correct.",
      expectedImpact: "high",
      implementation:
        "Add aria-labels to inputs, check disabled attributes, verify field names match labels.",
    });
  } else if (mostFailedStep[0] === "expect") {
    hypotheses.push({
      category: "feedback_deficit",
      description:
        "Expected content or confirmation is not appearing. Users are not receiving feedback that their actions succeeded.",
      confidence: "high",
    });

    suggestions.push({
      title: "Add Clear Success States and Feedback",
      description:
        "Implement clear success messages, page transitions, or confirmation screens. Ensure expected content appears reliably after actions complete.",
      expectedImpact: "high",
      implementation:
        "Add toast notifications, confirmation messages, or redirect to success pages. Ensure async operations complete before showing success.",
    });
  } else {
    hypotheses.push({
      category: "other",
      description: `Steps of type "${mostFailedStep[0]}" are failing consistently. This requires investigation of the specific step implementation and target elements.`,
      confidence: "medium",
    });

    suggestions.push({
      title: `Investigate ${mostFailedStep[0]} Step Failures`,
      description: `Review the ${mostFailedStep[1]} failed "${mostFailedStep[0]}" step(s) to identify common patterns. Check timing, element availability, and execution context.`,
      expectedImpact: "medium",
    });
  }

  verifications.push({
    method: "Re-run tasks with improved elements/selectors",
    expectedOutcome: "Step success rate should increase to >95%",
    metrics: ["successRate", "taskSuccessRate"],
  });
}

/**
 * Rule 4: Detect slow tasks
 */
function detectSlowTasks(
  sessions: SessionResult[],
  metrics: RunMetrics,
  findings: Finding[],
  hypotheses: Hypothesis[],
  suggestions: Suggestion[],
  verifications: Verification[]
): void {
  const threshold = metrics.medianTaskTimeMs * 1.5;
  const slowSessions = sessions.filter((s) => s.taskTimeMs > threshold);

  if (slowSessions.length === 0 || metrics.medianTaskTimeMs < 10000) return;

  // Find slowest steps
  const stepTimings = new Map<string, number[]>();
  for (const session of slowSessions) {
    for (const step of session.steps) {
      if (!stepTimings.has(step.kind)) {
        stepTimings.set(step.kind, []);
      }
      stepTimings.get(step.kind)!.push(step.timeMs);
    }
  }

  const avgStepTimes = Array.from(stepTimings.entries())
    .map(([kind, times]) => ({
      kind,
      avgTime: times.reduce((sum, t) => sum + t, 0) / times.length,
    }))
    .sort((a, b) => b.avgTime - a.avgTime);

  findings.push({
    id: "slow-tasks",
    title: "Slow Task Completion",
    description: `${slowSessions.length} session(s) took longer than ${(threshold / 1000).toFixed(1)}s to complete. Median task time: ${(metrics.medianTaskTimeMs / 1000).toFixed(1)}s, p95: ${(metrics.p95TaskTimeMs / 1000).toFixed(1)}s`,
    evidence: slowSessions.slice(0, 5).map((s) => ({
      sessionId: s.sessionId,
      description: `Took ${(s.taskTimeMs / 1000).toFixed(1)}s to complete`,
    })),
    severity: metrics.p95TaskTimeMs > 30000 ? "high" : "medium",
  });

  if (avgStepTimes[0].avgTime > 5000) {
    hypotheses.push({
      category: "performance",
      description: `Steps of type "${avgStepTimes[0].kind}" are taking unusually long (avg ${(avgStepTimes[0].avgTime / 1000).toFixed(1)}s). This indicates performance bottlenecks or elements that are slow to appear.`,
      confidence: "high",
    });

    suggestions.push({
      title: "Optimize Slow Operations",
      description: `Focus on improving "${avgStepTimes[0].kind}" operations which are the slowest. Consider optimizing page load times, reducing API latency, or improving element rendering speed.`,
      expectedImpact: "high",
      implementation:
        "Profile page load performance, optimize API calls, implement skeleton screens, reduce bundle size.",
    });
  } else {
    hypotheses.push({
      category: "information_deficit",
      description:
        "Users are taking longer to complete tasks, possibly because they need to search for elements or read multiple sections before proceeding.",
      confidence: "medium",
    });

    suggestions.push({
      title: "Improve Information Hierarchy and Navigation",
      description:
        "Make primary actions more prominent and easier to find. Consider improving visual hierarchy, reducing distractions, or simplifying the flow.",
      expectedImpact: "medium",
      implementation:
        "Use stronger visual hierarchy (color, size, position), add progress indicators, simplify navigation paths.",
    });
  }

  verifications.push({
    method: "Re-run tasks after optimizations",
    expectedOutcome: "Median task time should decrease by at least 20%",
    metrics: ["medianTaskTimeMs", "p95TaskTimeMs"],
  });
}

/**
 * Rule 5: Detect scroll oscillation issues
 */
function detectScrollIssues(
  sessions: SessionResult[],
  findings: Finding[],
  hypotheses: Hypothesis[],
  suggestions: Suggestion[],
  verifications: Verification[]
): void {
  const scrollIssueSessions: SessionMetricsData[] = [];

  for (const session of sessions) {
    const metrics = loadSessionMetrics(session);
    if (metrics && metrics.scrollOscillation > 0) {
      scrollIssueSessions.push(metrics);
    }
  }

  if (scrollIssueSessions.length === 0) return;

  findings.push({
    id: "scroll-oscillation",
    title: "Excessive Scrolling Detected",
    description: `Users scrolled back and forth in ${scrollIssueSessions.length} session(s), indicating difficulty finding content or understanding page layout.`,
    evidence: scrollIssueSessions.map((m) => ({
      sessionId: m.sessionId,
      description: "Scroll oscillation detected",
    })),
    severity: "medium",
  });

  hypotheses.push({
    category: "information_deficit",
    description:
      "Content is hard to locate or the page layout is unclear. Users are scrolling up and down trying to find what they need.",
    confidence: "high",
  });

  suggestions.push({
    title: "Improve Content Discoverability",
    description:
      "Make important content more visible and improve page layout. Consider adding sticky navigation, table of contents, or better visual anchors.",
    expectedImpact: "medium",
    implementation:
      "Add sticky headers, implement jump links, improve visual hierarchy, use clearer section headings.",
  });

  verifications.push({
    method: "Re-run tasks after layout improvements",
    expectedOutcome: "Scroll oscillation events should decrease significantly",
    metrics: ["scrollOscillation", "taskTimeMs"],
  });
}

/**
 * Generate overall success rate insights
 */
function analyzeSuccessRate(
  metrics: RunMetrics,
  findings: Finding[],
  hypotheses: Hypothesis[],
  suggestions: Suggestion[],
  verifications: Verification[]
): void {
  if (metrics.successRate >= 0.95) return;

  const severity: "high" | "medium" | "low" =
    metrics.successRate < 0.5 ? "high" : metrics.successRate < 0.8 ? "medium" : "low";

  findings.push({
    id: "low-success-rate",
    title: "Low Task Success Rate",
    description: `Only ${(metrics.successRate * 100).toFixed(1)}% of sessions completed successfully (${metrics.successCount}/${metrics.totalSessions}). This indicates significant usability issues preventing task completion.`,
    evidence: [
      {
        sessionId: "aggregate",
        description: `${metrics.failCount} failed sessions out of ${metrics.totalSessions} total`,
      },
    ],
    severity,
  });

  if (metrics.successRate < 0.5) {
    hypotheses.push({
      category: "trust_deficit",
      description:
        "The low success rate suggests fundamental issues with the flow. Users may not trust the interface, encounter blocking errors, or find the process too complex.",
      confidence: "high",
    });

    suggestions.push({
      title: "Conduct Comprehensive UX Review",
      description:
        "The success rate is critically low. Review the entire user flow, simplify steps, remove blockers, and ensure all functionality works correctly.",
      expectedImpact: "high",
      implementation:
        "Map full user journey, identify drop-off points, simplify or remove non-essential steps, add help text.",
    });
  } else {
    hypotheses.push({
      category: "other",
      description:
        "Multiple factors may be contributing to task failures. Review individual session failures to identify common patterns.",
      confidence: "medium",
    });

    suggestions.push({
      title: "Address Specific Failure Points",
      description:
        "Focus on the most common failure reasons identified in other findings. Incremental improvements to specific pain points should increase success rate.",
      expectedImpact: "medium",
    });
  }

  verifications.push({
    method: "Re-run all tasks after implementing fixes",
    expectedOutcome: "Success rate should reach 95% or higher",
    metrics: ["successRate", "successCount"],
  });
}

/**
 * Main function to generate advisor report
 */
export function generateAdvisorReport(
  sessions: SessionResult[],
  metrics: RunMetrics
): AdvisorReport {
  const findings: Finding[] = [];
  const hypotheses: Hypothesis[] = [];
  const suggestions: Suggestion[] = [];
  const verifications: Verification[] = [];

  // Run all rule-based detectors
  detectRageClickIssues(sessions, findings, hypotheses, suggestions, verifications);
  detectErrorIssues(sessions, metrics, findings, hypotheses, suggestions, verifications);
  detectFailedStepPatterns(sessions, findings, hypotheses, suggestions, verifications);
  detectSlowTasks(sessions, metrics, findings, hypotheses, suggestions, verifications);
  detectScrollIssues(sessions, findings, hypotheses, suggestions, verifications);
  analyzeSuccessRate(metrics, findings, hypotheses, suggestions, verifications);

  // Calculate summary
  const highSeverityCount = findings.filter((f) => f.severity === "high").length;
  const mediumSeverityCount = findings.filter((f) => f.severity === "medium").length;
  const lowSeverityCount = findings.filter((f) => f.severity === "low").length;

  return {
    timestamp: Date.now(),
    summary: {
      totalFindings: findings.length,
      highSeverityCount,
      mediumSeverityCount,
      lowSeverityCount,
    },
    findings,
    hypotheses,
    suggestions,
    verification: verifications,
  };
}
