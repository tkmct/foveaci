import {
  IconArrowUp,
  IconArrowDown,
  IconMinus,
} from "@tabler/icons-react";
import { createElement } from "react";
import type { ReactNode } from "react";

export function formatDelta(delta: number, suffix = ""): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(4)}${suffix}`;
}

export function formatPercentDelta(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${(delta * 100).toFixed(2)}%`;
}

export function getDeltaClass(
  delta: number,
  metricType: "higher-better" | "lower-better",
): string {
  if (delta === 0) return "neutral";
  if (metricType === "higher-better") {
    return delta > 0 ? "improvement" : "regression";
  } else {
    return delta < 0 ? "improvement" : "regression";
  }
}

export function deltaIcon(value: number): ReactNode {
  if (value > 0) return createElement(IconArrowUp, { size: 14 });
  if (value < 0) return createElement(IconArrowDown, { size: 14 });
  return createElement(IconMinus, { size: 14 });
}
