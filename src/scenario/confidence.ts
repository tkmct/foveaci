import type { ScenarioSource } from "./types.js";

function uniqueSourceTypes(sources: ScenarioSource[]): Set<string> {
  return new Set(sources.map((s) => s.type));
}

export function scoreScenarioConfidence(sources: ScenarioSource[]): number {
  const sourceTypes = uniqueSourceTypes(sources);
  const hasCode = sourceTypes.has("code");
  const hasDocs = sourceTypes.has("docs");
  const hasPr = sourceTypes.has("pr");
  let score = 0.15;

  if (hasCode) score += 0.4;
  if (hasDocs) score += 0.35;
  if (hasPr) score += 0.1;

  // Boost scenarios supported by both implementation and docs.
  if (hasCode && hasDocs) score += 0.1;
  if (sources.length >= 3) score += 0.05;

  // PR-only scenarios are too weak for auto-approval.
  if (!hasCode && !hasDocs && hasPr) {
    score = Math.min(score, 0.35);
  }

  return Math.max(0.05, Math.min(0.95, Math.round(score * 100) / 100));
}
