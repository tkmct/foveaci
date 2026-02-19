import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { SessionResult } from "../runner.js";
import type { RunMetrics } from "../metrics.js";
import type { AdvisorReport } from "../advisor.js";
import type { MainReportData, ReportSessionData } from "../types/report-data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function generateReport(
  sessions: SessionResult[],
  metrics: RunMetrics,
  outDir: string,
  advisorReport?: AdvisorReport | null
): Promise<void> {
  const reportDir = path.join(outDir, "report");
  fs.mkdirSync(reportDir, { recursive: true });

  // Load rrweb events for each session
  const sessionData: ReportSessionData[] = sessions.map((session) => {
    let events: unknown[] = [];
    try {
      events = JSON.parse(fs.readFileSync(session.rrwebEventsFile, "utf-8"));
    } catch {
      // Empty events
    }
    return {
      sessionId: session.sessionId,
      taskId: session.taskId,
      personaId: session.personaId,
      success: session.success,
      startTime: session.startTime,
      endTime: session.endTime,
      taskTimeMs: session.taskTimeMs,
      errors: session.errors,
      steps: session.steps,
      events,
    };
  });

  // Write report-data.json
  const reportData: MainReportData = {
    kind: "main",
    generatedAt: new Date().toISOString(),
    metrics,
    advisor: advisorReport ?? null,
    sessions: sessionData,
  };
  fs.writeFileSync(
    path.join(reportDir, "report-data.json"),
    JSON.stringify(reportData),
  );

  // Copy static assets
  copyStaticAssets(reportDir);
}

function copyStaticAssets(reportDir: string): void {
  const staticDir = path.join(__dirname, "static");

  function copyRecursive(src: string, dest: string): void {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      for (const entry of fs.readdirSync(src)) {
        copyRecursive(path.join(src, entry), path.join(dest, entry));
      }
    } else {
      fs.copyFileSync(src, dest);
    }
  }

  copyRecursive(staticDir, reportDir);
}
