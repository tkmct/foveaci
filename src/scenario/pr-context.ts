import * as fs from "node:fs";
import type { PrMetadata } from "./types.js";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export function loadPrMetadata(metadataPath: string): PrMetadata {
  const raw = fs.readFileSync(metadataPath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  if (!isObject(parsed)) {
    throw new Error("PR metadata must be a JSON object");
  }

  const title = typeof parsed.title === "string" ? parsed.title : "";
  if (!title.trim()) {
    throw new Error("PR metadata must include a non-empty 'title'");
  }

  return {
    number: typeof parsed.number === "number" ? parsed.number : undefined,
    title,
    body: typeof parsed.body === "string" ? parsed.body : undefined,
    labels: asStringArray(parsed.labels),
    url: typeof parsed.url === "string" ? parsed.url : undefined,
  };
}

export function hasApprovalLabel(
  pr: PrMetadata,
  label = "ux-eval-approved"
): boolean {
  return (pr.labels || []).includes(label);
}

export function tokenizePrText(pr: PrMetadata): string[] {
  const body = pr.body || "";
  return `${pr.title}\n${body}`
    .toLowerCase()
    .split(/[^a-z0-9/_-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

