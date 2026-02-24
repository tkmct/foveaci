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

interface HeadingLine {
  line: number;
  text: string;
}

function collectHeadings(headRef: string, file: string): HeadingLine[] {
  const fileText = safeExec(`git show ${headRef}:${file}`);
  if (!fileText) return [];
  const headings: HeadingLine[] = [];
  for (const [index, line] of fileText.split("\n").entries()) {
    const text = line.trim();
    if (!text.startsWith("##")) continue;
    headings.push({ line: index + 1, text });
  }
  return headings;
}

function nearestHeading(headings: HeadingLine[], line: number): string {
  let nearest = "";
  for (const heading of headings) {
    if (heading.line > line) break;
    nearest = heading.text;
  }
  return nearest;
}

export function collectDocHints(baseRef: string, headRef: string): DocHint[] {
  const diffText = safeExec(
    `git diff --unified=6 ${baseRef}...${headRef} -- README.md SPEC.md docs`
  );
  if (!diffText) return [];

  const hints: DocHint[] = [];
  let currentFile = "";
  let currentLine = 0;
  let currentContext = "";
  const headingCache = new Map<string, HeadingLine[]>();

  for (const line of diffText.split("\n")) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice("+++ b/".length).trim();
      currentContext = "";
      continue;
    }

    if (line.startsWith("@@")) {
      const match = line.match(/\+(\d+)(?:,\d+)?/);
      if (match) {
        currentLine = parseInt(match[1], 10);
      }
      currentContext = "";
      continue;
    }

    const added = parseAddedLine(line);
    if (added && currentFile) {
      const headings = headingCache.get(currentFile) || collectHeadings(headRef, currentFile);
      headingCache.set(currentFile, headings);
      const heading = nearestHeading(headings, currentLine);
      const text = heading
        ? `${heading} ${added}`
        : currentContext
          ? `${currentContext} ${added}`
          : added;
      hints.push({
        file: currentFile,
        line: currentLine,
        text,
      });
      currentLine += 1;
      continue;
    }

    if (line.startsWith(" ")) {
      const contextText = line.slice(1).trim();
      if (contextText.startsWith("##") || /^\d+\./.test(contextText)) {
        currentContext = contextText;
      }
      currentLine += 1;
      continue;
    }

    if (line.startsWith(" ") || line.startsWith("-")) {
      currentLine += 1;
    }
  }

  return hints.slice(0, 40);
}
