import type { Page } from "playwright";
import type { PersonaConfig } from "../config.js";

// Adjacent keys on QWERTY keyboard for typo simulation
const ADJACENT_KEYS: Record<string, string[]> = {
  a: ["s", "q", "z"],
  b: ["v", "n", "g"],
  c: ["x", "v", "d"],
  d: ["s", "f", "e", "c"],
  e: ["w", "r", "d"],
  f: ["d", "g", "r", "v"],
  g: ["f", "h", "t", "b"],
  h: ["g", "j", "y", "n"],
  i: ["u", "o", "k"],
  j: ["h", "k", "u", "m"],
  k: ["j", "l", "i"],
  l: ["k", "o", "p"],
  m: ["n", "j", "k"],
  n: ["b", "m", "h"],
  o: ["i", "p", "l"],
  p: ["o", "l"],
  q: ["w", "a"],
  r: ["e", "t", "f"],
  s: ["a", "d", "w", "x"],
  t: ["r", "y", "g"],
  u: ["y", "i", "j"],
  v: ["c", "b", "f"],
  w: ["q", "e", "s"],
  x: ["z", "c", "s"],
  y: ["t", "u", "h"],
  z: ["a", "x"],
};

function getTypo(char: string, rng: () => number = Math.random): string {
  const lower = char.toLowerCase();
  const adj = ADJACENT_KEYS[lower];
  if (!adj || adj.length === 0) return char;
  const typo = adj[Math.floor(rng() * adj.length)];
  return char === char.toUpperCase() ? typo.toUpperCase() : typo;
}

/** Type text with human-like timing, occasional typos and corrections */
export async function humanType(
  page: Page,
  text: string,
  persona: PersonaConfig,
  rng: () => number = Math.random
): Promise<void> {
  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Check for typo
    if (rng() < persona.typoRate && char.match(/[a-zA-Z]/)) {
      // Type wrong character
      const typoChar = getTypo(char, rng);
      await page.keyboard.type(typoChar, {
        delay: (40 + rng() * 80) / persona.speed,
      });

      // Pause (notice the mistake)
      await page.waitForTimeout((100 + rng() * 200) / persona.speed);

      // Backspace
      await page.keyboard.press("Backspace");
      await page.waitForTimeout((30 + rng() * 60) / persona.speed);
    }

    // Type the correct character
    const delay = (40 + rng() * 80) / persona.speed;
    await page.keyboard.type(char, { delay });

    // Occasional longer pause (thinking/reading)
    if (rng() < 0.05) {
      await page.waitForTimeout((200 + rng() * 400) / persona.speed);
    }
  }
}
