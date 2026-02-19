import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";

export interface ProjectConfig {
  name: string;
  baseUrl: string;
}

export interface RunConfig {
  browser: "chromium" | "firefox" | "webkit";
  headless: boolean;
  video: boolean;
  trace: boolean;
  concurrency: number;
  timeoutMs: number;
  seed?: number;
}

export interface RecordingConfig {
  rrweb: boolean;
  maskInputs: boolean;
  fakeCursor: boolean;
}

export interface PersonaConfig {
  id: string;
  speed: number;
  jitterPx: number;
  misclickRate: number;
  typoRate: number;
  patienceMs: number;
  hesitationMsRange?: [number, number];
}

export interface StepTarget {
  role?: string;
  name?: string;
  label?: string;
  text?: string;
  css?: string;
}

export interface TaskStep {
  kind: "goto" | "click" | "type" | "scroll" | "wait" | "expect" | "snapshot";
  target?: StepTarget;
  value?: string;
  url?: string;
}

export interface TaskConfig {
  id: string;
  entry: string;
  goal: string;
  steps: TaskStep[];
}

export interface GateConfig {
  metric: string;
  op: ">=" | "<=" | ">" | "<" | "==" | "!=";
  value: number;
}

export interface FovConfig {
  project: ProjectConfig;
  run: RunConfig;
  recording: RecordingConfig;
  personas: PersonaConfig[];
  tasks: TaskConfig[];
  gates: GateConfig[];
}

const DEFAULTS: Partial<FovConfig> = {
  run: {
    browser: "chromium",
    headless: true,
    video: false,
    trace: false,
    concurrency: 4,
    timeoutMs: 180000,
  },
  recording: {
    rrweb: true,
    maskInputs: true,
    fakeCursor: true,
  },
};

export function loadConfig(configPath: string): FovConfig {
  const absPath = path.resolve(configPath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Config file not found: ${absPath}`);
  }

  const raw = fs.readFileSync(absPath, "utf-8");
  const parsed = yaml.load(raw) as Record<string, unknown>;

  // Validate required fields
  if (!parsed.project || !(parsed.project as Record<string, unknown>).baseUrl) {
    throw new Error("Config must include project.baseUrl");
  }
  if (!parsed.tasks || !Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
    throw new Error("Config must include at least one task");
  }
  if (!parsed.personas || !Array.isArray(parsed.personas) || parsed.personas.length === 0) {
    throw new Error("Config must include at least one persona");
  }

  const config: FovConfig = {
    project: parsed.project as ProjectConfig,
    run: { ...DEFAULTS.run!, ...(parsed.run as Partial<RunConfig> || {}) },
    recording: { ...DEFAULTS.recording!, ...(parsed.recording as Partial<RecordingConfig> || {}) },
    personas: parsed.personas as PersonaConfig[],
    tasks: parsed.tasks as TaskConfig[],
    gates: (parsed.gates as GateConfig[]) || [],
  };

  return config;
}
