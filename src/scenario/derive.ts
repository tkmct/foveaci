import type { TaskConfig } from "../config.js";
import { scoreScenarioConfidence } from "./confidence.js";
import { tokenizePrText } from "./pr-context.js";
import type {
  DocHint,
  PrMetadata,
  ScenarioProposal,
  ScenarioSource,
} from "./types.js";

interface DeriveInput {
  pr: PrMetadata;
  changedFiles: string[];
  docHints: DocHint[];
  maxScenarios?: number;
}

const GENERIC_TOKENS = new Set([
  "src",
  "apps",
  "app",
  "components",
  "component",
  "hooks",
  "hook",
  "utils",
  "types",
  "docs",
  "doc",
  "readme",
  "spec",
  "report",
  "report-ui",
  "index",
  "main",
  "test",
  "tests",
  "feature",
  "fix",
  "update",
  "updates",
  "add",
  "remove",
  "change",
  "changes",
  "minor",
  "major",
  "task",
  "flow",
  "this",
  "that",
  "with",
  "from",
  "into",
  "onto",
  "over",
  "under",
  "after",
  "before",
  "around",
  "then",
  "and",
  "for",
  "the",
  "use",
  "using",
]);

interface Candidate {
  key: string;
  score: number;
  sources: ScenarioSource[];
}

function splitPathTokens(file: string): string[] {
  return file
    .toLowerCase()
    .split(/[\/._-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !GENERIC_TOKENS.has(token));
}

function cleanToken(token: string): string | null {
  const normalized = token.toLowerCase().replace(/[^a-z0-9/-]/g, "").trim();
  if (normalized.length < 3) return null;
  if (GENERIC_TOKENS.has(normalized)) return null;
  return normalized;
}

function titleCase(text: string): string {
  return text
    .split(/[-_/]+/)
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(" ");
}

function pathFromToken(token: string): string {
  if (token.includes("/")) {
    return token.startsWith("/") ? token : `/${token}`;
  }
  return `/${token}`;
}

function buildTask(token: string, index: number): TaskConfig {
  const routePath = pathFromToken(token);
  const title = titleCase(token);

  return {
    id: `pr_${token.replace(/[\/-]+/g, "_")}_${index + 1}`,
    entry: routePath,
    goal: `Evaluate ${title} UX flow introduced or modified in this PR`,
    steps: [
      { kind: "goto", url: routePath },
      { kind: "wait", value: "1200" },
      { kind: "snapshot" },
      { kind: "scroll" },
      { kind: "wait", value: "600" },
    ],
  };
}

function addCandidate(
  map: Map<string, Candidate>,
  token: string,
  score: number,
  source: ScenarioSource
): void {
  const cleaned = cleanToken(token);
  if (!cleaned) return;

  const current = map.get(cleaned);
  if (current) {
    current.score += score;
    current.sources.push(source);
    return;
  }

  map.set(cleaned, {
    key: cleaned,
    score,
    sources: [source],
  });
}

export function deriveScenarioProposals(input: DeriveInput): ScenarioProposal[] {
  const candidates = new Map<string, Candidate>();
  const maxScenarios = input.maxScenarios || 4;

  for (const token of tokenizePrText(input.pr)) {
    addCandidate(candidates, token, 2, {
      type: "pr",
      excerpt: `PR text mentions "${token}"`,
    });
  }

  for (const file of input.changedFiles) {
    for (const token of splitPathTokens(file)) {
      addCandidate(candidates, token, 1.6, {
        type: "code",
        file,
        excerpt: `Changed file path token "${token}"`,
      });
    }
  }

  for (const hint of input.docHints) {
    const lineTokens = hint.text
      .toLowerCase()
      .split(/[^a-z0-9/_-]+/)
      .filter((token) => token.length >= 3);
    for (const token of lineTokens) {
      addCandidate(candidates, token, 1.4, {
        type: "docs",
        file: `${hint.file}:${hint.line}`,
        excerpt: hint.text,
      });
    }
  }

  const sorted = Array.from(candidates.values()).sort((a, b) => b.score - a.score);
  const selected = sorted.slice(0, maxScenarios);

  const scenarios: ScenarioProposal[] = selected.map((candidate, index) => {
    const title = titleCase(candidate.key);
    const confidence = scoreScenarioConfidence(candidate.sources);
    return {
      id: `scenario_${candidate.key.replace(/[\/-]+/g, "_")}_${index + 1}`,
      title: `PR UX: ${title}`,
      goal: `Validate user experience around ${title} changes in this PR`,
      tags: [candidate.key, "auto-generated", "pr-diff"],
      confidence,
      approved: false,
      sources: candidate.sources.slice(0, 5),
      task: buildTask(candidate.key, index),
    };
  });

  if (scenarios.length > 0) {
    return scenarios;
  }

  return [
    {
      id: "scenario_fallback_1",
      title: "PR UX: Fallback Smoke",
      goal: "Run a fallback smoke scenario when no confident feature token is found",
      tags: ["fallback", "auto-generated", "pr-diff"],
      confidence: 0.2,
      approved: false,
      sources: [
        {
          type: "pr",
          excerpt: "No feature-specific token found from PR diff and metadata",
        },
      ],
      task: {
        id: "pr_fallback_1",
        entry: "/",
        goal: "Fallback UX smoke run",
        steps: [
          { kind: "goto", url: "/" },
          { kind: "wait", value: "1200" },
          { kind: "snapshot" },
        ],
      },
    },
  ];
}
