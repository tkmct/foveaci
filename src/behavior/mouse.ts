import type { Page } from "playwright";
import type { PersonaConfig } from "../config.js";

interface Point {
  x: number;
  y: number;
}

/** Generate a cubic bezier curve from start to end with randomized control points */
function bezierPoints(
  start: Point,
  end: Point,
  numSteps: number,
  jitterPx: number,
  rng: () => number = Math.random
): Point[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  // Control points with randomness
  const cp1: Point = {
    x: start.x + dx * (0.2 + rng() * 0.2) + (rng() - 0.5) * jitterPx * 10,
    y: start.y + dy * (0.2 + rng() * 0.2) + (rng() - 0.5) * jitterPx * 10,
  };
  const cp2: Point = {
    x: start.x + dx * (0.6 + rng() * 0.2) + (rng() - 0.5) * jitterPx * 10,
    y: start.y + dy * (0.6 + rng() * 0.2) + (rng() - 0.5) * jitterPx * 10,
  };

  const points: Point[] = [];
  for (let i = 0; i <= numSteps; i++) {
    const t = i / numSteps;
    const u = 1 - t;
    // Cubic bezier
    const x =
      u * u * u * start.x +
      3 * u * u * t * cp1.x +
      3 * u * t * t * cp2.x +
      t * t * t * end.x;
    const y =
      u * u * u * start.y +
      3 * u * u * t * cp1.y +
      3 * u * t * t * cp2.y +
      t * t * t * end.y;
    points.push({ x: Math.round(x), y: Math.round(y) });
  }

  // Add final jitter (micro-adjustment)
  if (points.length > 1) {
    const last = points[points.length - 1];
    points.push({
      x: last.x + Math.round((rng() - 0.5) * jitterPx * 2),
      y: last.y + Math.round((rng() - 0.5) * jitterPx * 2),
    });
    // Move back to actual target
    points.push({ x: end.x, y: end.y });
  }

  return points;
}

/** Move mouse along a human-like bezier curve to the target point */
export async function humanMouseMove(
  page: Page,
  target: Point,
  persona: PersonaConfig,
  currentPos?: Point,
  rng: () => number = Math.random
): Promise<void> {
  const start = currentPos ?? { x: 0, y: 0 };
  const distance = Math.sqrt(
    (target.x - start.x) ** 2 + (target.y - start.y) ** 2
  );

  // More steps for longer distances
  const baseSteps = Math.max(10, Math.min(40, Math.floor(distance / 15)));
  const numSteps = Math.round(baseSteps / persona.speed);

  const points = bezierPoints(start, target, numSteps, persona.jitterPx, rng);

  // Move through each point with variable timing
  for (const point of points) {
    const delay = (10 + rng() * 30) / persona.speed;
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(delay);
  }
}

/** Perform a human-like click: move to target with bezier, then mousedown/up */
export async function humanClick(
  page: Page,
  target: Point,
  persona: PersonaConfig,
  currentPos?: Point,
  rng: () => number = Math.random
): Promise<void> {
  // Add jitter to target
  const jitteredTarget: Point = {
    x: target.x + Math.round((rng() - 0.5) * persona.jitterPx * 2),
    y: target.y + Math.round((rng() - 0.5) * persona.jitterPx * 2),
  };

  await humanMouseMove(page, jitteredTarget, persona, currentPos, rng);

  // Small pause before clicking (human reaction time)
  await page.waitForTimeout(50 + rng() * 100);

  await page.mouse.down();
  await page.waitForTimeout(30 + rng() * 70);
  await page.mouse.up();
}

/** Simulate a misclick: click near the target but not on it, then correct */
export async function misclick(
  page: Page,
  target: Point,
  persona: PersonaConfig,
  currentPos?: Point,
  rng: () => number = Math.random
): Promise<Point> {
  // Click 20-50px away from target
  const offset = 20 + rng() * 30;
  const angle = rng() * Math.PI * 2;
  const missPoint: Point = {
    x: Math.round(target.x + Math.cos(angle) * offset),
    y: Math.round(target.y + Math.sin(angle) * offset),
  };

  await humanClick(page, missPoint, persona, currentPos, rng);
  await page.waitForTimeout(200 + rng() * 300);

  return missPoint;
}

/** Get the center point of an element's bounding box */
export async function getElementCenter(
  page: Page,
  locator: ReturnType<Page["locator"]>
): Promise<Point | null> {
  try {
    const box = await locator.boundingBox({ timeout: 5000 });
    if (!box) return null;
    return {
      x: Math.round(box.x + box.width / 2),
      y: Math.round(box.y + box.height / 2),
    };
  } catch {
    return null;
  }
}
