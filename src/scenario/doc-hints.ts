import { execSync } from "node:child_process";
import type { DocHint } from "./types.js";

function safeExec(command: string): string {
  try {
    return execSync(command, { encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

function parseAddedLine(line: string): string | null {
  if (!line.startsWith("+") || line.startsWith("+++")) return null;
  const text = line.slice(1).trim();
  if (!text) return null;
  // Skip markdown heading decorations and code fences only lines.
  if (text === "---" || text === "```") return null;
  return text.slice(0, 240);
}

export function collectDocHints(baseRef: string, headRef: string): DocHint[] {
  const diffText = safeExec(
    `git diff --unified=0 ${baseRef}...${headRef} -- README.md SPEC.md docs`
  );
  if (!diffText) return [];

  const hints: DocHint[] = [];
  let currentFile = "";
  let currentLine = 0;

  for (const line of diffText.split("\n")) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice("+++ b/".length).trim();
      continue;
    }

    if (line.startsWith("@@")) {
      const match = line.match(/\+(\d+)(?:,\d+)?/);
      if (match) {
        currentLine = parseInt(match[1], 10);
      }
      continue;
    }

    const added = parseAddedLine(line);
    if (added && currentFile) {
      hints.push({
        file: currentFile,
        line: currentLine,
        text: added,
      });
      currentLine += 1;
      continue;
    }

    if (line.startsWith(" ") || line.startsWith("-")) {
      currentLine += 1;
    }
  }

  return hints.slice(0, 40);
}

