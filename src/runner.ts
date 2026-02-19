import { chromium, type Browser, type Page, type BrowserContext } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import type {
  FovConfig,
  PersonaConfig,
  TaskConfig,
  TaskStep,
  StepTarget,
} from "./config.js";
import {
  injectRecording,
  collectRrwebEvents,
  collectConsoleLogs,
  collectNetworkLogs,
} from "./recording.js";
import { humanClick, humanType, getElementCenter } from "./behavior/index.js";
import { createRng } from "./rng.js";

export interface SessionResult {
  sessionId: string;
  taskId: string;
  personaId: string;
  success: boolean;
  startTime: number;
  endTime: number;
  taskTimeMs: number;
  errors: string[];
  steps: StepResult[];
  rrwebEventsFile: string;
  consoleLogsFile: string;
  networkLogsFile: string;
  metricsFile: string;
  retried?: boolean;
}

export interface StepResult {
  kind: string;
  success: boolean;
  timeMs: number;
  error?: string;
}

interface ClickTracker {
  lastClickTime: number;
  lastClickX: number;
  lastClickY: number;
  rageClickCount: number;
  totalRageClicks: number;
}

function buildLocator(page: Page, target: StepTarget) {
  if (target.role && target.name) {
    return page.getByRole(target.role as Parameters<Page["getByRole"]>[0], {
      name: target.name,
    });
  }
  if (target.label) {
    return page.getByLabel(target.label);
  }
  if (target.text) {
    return page.getByText(target.text);
  }
  if (target.css) {
    return page.locator(target.css);
  }
  throw new Error(`Invalid step target: ${JSON.stringify(target)}`);
}

function resolveTemplateValue(value: string, runId: string): string {
  return value.replace(/\{\{runId\}\}/g, runId);
}

/** Mask sensitive values in strings (for logging) */
function maskSensitive(value: string): string {
  // Mask anything that looks like email/password
  return value
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "***@***.***")
    .replace(/password[=:]\s*\S+/gi, "password=***");
}

async function executeStep(
  page: Page,
  step: TaskStep,
  persona: PersonaConfig,
  runId: string,
  clickTracker: ClickTracker,
  rng: () => number
): Promise<StepResult> {
  const start = Date.now();
  try {
    switch (step.kind) {
      case "goto": {
        const url = step.url || step.value || "/";
        await page.goto(url, { waitUntil: "domcontentloaded" });
        return { kind: "goto", success: true, timeMs: Date.now() - start };
      }

      case "click": {
        if (!step.target) throw new Error("click step requires target");
        const locator = buildLocator(page, step.target);
        await locator.waitFor({ state: "visible", timeout: 10000 });
        const center = await getElementCenter(page, locator);
        if (!center) throw new Error("Could not get element position");

        // Track rage clicks
        const now = Date.now();
        if (
          now - clickTracker.lastClickTime < 500 &&
          Math.abs(center.x - clickTracker.lastClickX) < 30 &&
          Math.abs(center.y - clickTracker.lastClickY) < 30
        ) {
          clickTracker.rageClickCount++;
          if (clickTracker.rageClickCount >= 3) {
            clickTracker.totalRageClicks++;
          }
        } else {
          clickTracker.rageClickCount = 0;
        }
        clickTracker.lastClickTime = now;
        clickTracker.lastClickX = center.x;
        clickTracker.lastClickY = center.y;

        // Check for misclick
        if (rng() < persona.misclickRate) {
          // Import misclick
          const { misclick } = await import("./behavior/mouse.js");
          await misclick(page, center, persona, undefined, rng);
        }

        await humanClick(page, center, persona, undefined, rng);
        return { kind: "click", success: true, timeMs: Date.now() - start };
      }

      case "type": {
        if (!step.target) throw new Error("type step requires target");
        if (!step.value) throw new Error("type step requires value");
        const locator = buildLocator(page, step.target);
        await locator.waitFor({ state: "visible", timeout: 10000 });

        // Click to focus
        const center = await getElementCenter(page, locator);
        if (center) {
          await humanClick(page, center, persona, undefined, rng);
        } else {
          await locator.click();
        }

        // Small pause before typing
        await page.waitForTimeout(100 + rng() * 200);

        const resolvedValue = resolveTemplateValue(step.value, runId);
        await humanType(page, resolvedValue, persona, rng);
        return { kind: "type", success: true, timeMs: Date.now() - start };
      }

      case "scroll": {
        // Simple scroll implementation
        await page.mouse.wheel(0, 300);
        await page.waitForTimeout(200);
        return { kind: "scroll", success: true, timeMs: Date.now() - start };
      }

      case "wait": {
        const ms = step.value ? parseInt(step.value, 10) : 1000;
        await page.waitForTimeout(ms);
        return { kind: "wait", success: true, timeMs: Date.now() - start };
      }

      case "expect": {
        if (!step.target) throw new Error("expect step requires target");
        if (step.target.text) {
          await page.getByText(step.target.text).waitFor({
            state: "visible",
            timeout: 15000,
          });
        } else if (step.target.css) {
          await page.locator(step.target.css).waitFor({
            state: "visible",
            timeout: 15000,
          });
        } else if (step.target.role) {
          const loc = buildLocator(page, step.target);
          await loc.waitFor({ state: "visible", timeout: 15000 });
        } else {
          throw new Error("expect step needs text, css, or role target");
        }
        return { kind: "expect", success: true, timeMs: Date.now() - start };
      }

      case "snapshot": {
        // Take screenshot
        return { kind: "snapshot", success: true, timeMs: Date.now() - start };
      }

      default:
        throw new Error(`Unknown step kind: ${step.kind}`);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      kind: step.kind,
      success: false,
      timeMs: Date.now() - start,
      error: maskSensitive(errorMsg),
    };
  }
}

async function runSession(
  config: FovConfig,
  task: TaskConfig,
  persona: PersonaConfig,
  outDir: string,
  sessionIndex: number,
  isRetry: boolean = false
): Promise<SessionResult> {
  const runId = `${Date.now()}-${sessionIndex}`;
  const sessionId = `${task.id}_${persona.id}_${sessionIndex}`;
  const sessionDir = path.join(outDir, "sessions", sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });

  // Create RNG if seed is provided
  const rng = config.run.seed !== undefined
    ? createRng(config.run.seed + sessionIndex)
    : Math.random;

  const browser: Browser = await chromium.launch({
    headless: config.run.headless,
  });

  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ...(config.run.video
      ? { recordVideo: { dir: sessionDir, size: { width: 1280, height: 720 } } }
      : {}),
  });

  if (config.run.trace) {
    await context.tracing.start({ screenshots: true, snapshots: true });
  }

  const page: Page = await context.newPage();

  // Inject recording scripts
  await injectRecording(page, config.recording);

  const startTime = Date.now();
  const errors: string[] = [];
  const stepResults: StepResult[] = [];
  let success = true;

  // Capture console errors
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(maskSensitive(msg.text()));
    }
  });

  // Capture page errors
  page.on("pageerror", (err) => {
    errors.push(maskSensitive(err.message));
  });

  const clickTracker: ClickTracker = {
    lastClickTime: 0,
    lastClickX: 0,
    lastClickY: 0,
    rageClickCount: 0,
    totalRageClicks: 0,
  };

  try {
    // Navigate to entry
    const entryUrl = new URL(task.entry, config.project.baseUrl).href;
    await page.goto(entryUrl, {
      waitUntil: "domcontentloaded",
      timeout: config.run.timeoutMs,
    });

    // Wait for page to settle
    await page.waitForTimeout(500);

    // Execute each step
    for (const step of task.steps) {
      // Add hesitation between steps
      const hesitation =
        (persona.hesitationMsRange
          ? persona.hesitationMsRange[0] +
            rng() *
              (persona.hesitationMsRange[1] - persona.hesitationMsRange[0])
          : 300 + rng() * 500) / persona.speed;
      await page.waitForTimeout(hesitation);

      const result = await executeStep(page, step, persona, runId, clickTracker, rng);
      stepResults.push(result);

      if (!result.success) {
        success = false;
        if (result.error) errors.push(result.error);
        // Continue executing remaining steps even on failure (for recording)
      }
    }
  } catch (err) {
    success = false;
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push(maskSensitive(errorMsg));
  }

  const endTime = Date.now();

  // Collect artifacts
  const rrwebEvents = await collectRrwebEvents(page);
  const consoleLogs = await collectConsoleLogs(page);
  const networkLogs = await collectNetworkLogs(page);

  // Save artifacts
  const rrwebFile = path.join(sessionDir, "events.json");
  const consoleFile = path.join(sessionDir, "console.json");
  const networkFile = path.join(sessionDir, "network.json");

  fs.writeFileSync(rrwebFile, JSON.stringify(rrwebEvents, null, 2));
  fs.writeFileSync(consoleFile, JSON.stringify(consoleLogs, null, 2));
  fs.writeFileSync(networkFile, JSON.stringify(networkLogs, null, 2));

  // Save session metrics
  const sessionMetrics = {
    sessionId,
    taskId: task.id,
    personaId: persona.id,
    success,
    taskTimeMs: endTime - startTime,
    numErrors: errors.length,
    numRageClicks: clickTracker.totalRageClicks,
    scrollOscillation: 0, // TODO: implement scroll oscillation tracking
    steps: stepResults,
    errors,
  };
  const metricsFile = path.join(sessionDir, "metrics.json");
  fs.writeFileSync(metricsFile, JSON.stringify(sessionMetrics, null, 2));

  // Save trace if enabled
  if (config.run.trace) {
    await context.tracing.stop({
      path: path.join(sessionDir, "trace.zip"),
    });
  }

  await page.close();
  await context.close();
  await browser.close();

  console.log(
    `[fov] Session ${sessionId}: ${success ? "PASS" : "FAIL"} (${endTime - startTime}ms)`
  );

  return {
    sessionId,
    taskId: task.id,
    personaId: persona.id,
    success,
    startTime,
    endTime,
    taskTimeMs: endTime - startTime,
    errors,
    steps: stepResults,
    rrwebEventsFile: rrwebFile,
    consoleLogsFile: consoleFile,
    networkLogsFile: networkFile,
    metricsFile,
    ...(isRetry ? { retried: true } : {}),
  };
}

/**
 * Simple semaphore for controlling concurrency
 */
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  release(): void {
    this.permits++;
    const resolve = this.waiting.shift();
    if (resolve) {
      this.permits--;
      resolve();
    }
  }
}

export async function runSessions(
  config: FovConfig,
  outDir: string
): Promise<SessionResult[]> {
  const results: SessionResult[] = [];
  let sessionIndex = 0;

  // Build session queue
  const sessionQueue: Array<{
    task: TaskConfig;
    persona: PersonaConfig;
    index: number;
  }> = [];

  for (const task of config.tasks) {
    for (const persona of config.personas) {
      sessionQueue.push({ task, persona, index: sessionIndex++ });
    }
  }

  // Run sessions with concurrency control
  const semaphore = new Semaphore(config.run.concurrency);
  const promises: Array<Promise<void>> = [];

  for (const { task, persona, index } of sessionQueue) {
    const promise = (async () => {
      await semaphore.acquire();
      try {
        let result = await runSession(config, task, persona, outDir, index);

        // Retry logic: if failed, retry once
        if (!result.success) {
          console.log(`[fov] Session ${result.sessionId} failed, retrying...`);
          result = await runSession(config, task, persona, outDir, index, true);
        }

        results.push(result);
      } finally {
        semaphore.release();
      }
    })();

    promises.push(promise);
  }

  await Promise.all(promises);

  return results;
}
