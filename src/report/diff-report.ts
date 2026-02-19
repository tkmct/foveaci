import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { DiffResult } from "../diff.js";
import type { DiffReportData } from "../types/report-data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function generateDiffReport(diff: DiffResult, outDir: string): void {
  fs.mkdirSync(outDir, { recursive: true });

  // Write report-data.json
  const reportData: DiffReportData = {
    kind: "diff",
    generatedAt: new Date().toISOString(),
    diff,
  };
  fs.writeFileSync(
    path.join(outDir, "report-data.json"),
    JSON.stringify(reportData),
  );

  // Copy static assets
  copyStaticAssets(outDir);
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
