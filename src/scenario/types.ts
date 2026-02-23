import type { TaskConfig } from "../config.js";

export type ScenarioSourceType = "pr" | "code" | "docs";

export interface ScenarioSource {
  type: ScenarioSourceType;
  file?: string;
  excerpt: string;
}

export interface DocHint {
  file: string;
  line: number;
  text: string;
}

export interface PrMetadata {
  number?: number;
  title: string;
  body?: string;
  labels?: string[];
  url?: string;
}

export interface ScenarioProposal {
  id: string;
  title: string;
  goal: string;
  tags: string[];
  confidence: number;
  approved: boolean;
  sources: ScenarioSource[];
  task: TaskConfig;
}

export interface ScenarioDiscoveryOutput {
  generatedAt: string;
  baseRef: string;
  headRef: string;
  pr: PrMetadata;
  changedFiles: string[];
  docHints: DocHint[];
  scenarios: ScenarioProposal[];
}

