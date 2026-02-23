import type { ScenarioSource } from "./types.js";

function uniqueSourceTypes(sources: ScenarioSource[]): Set<string> {
  return new Set(sources.map((s) => s.type));
}

export function scoreScenarioConfidence(sources: ScenarioSource[]): number {
  const sourceTypes = uniqueSourceTypes(sources);
  let score = 0.35;

  if (sourceTypes.has("code")) score += 0.25;
  if (sourceTypes.has("pr")) score += 0.2;
  if (sourceTypes.has("docs")) score += 0.2;

  if (sources.length >= 4) score += 0.05;

  return Math.max(0.05, Math.min(0.95, Math.round(score * 100) / 100));
}

