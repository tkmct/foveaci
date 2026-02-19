/**
 * Seeded random number generator for reproducible behavior
 * Uses the Mulberry32 algorithm for fast, high-quality PRNG
 */

/**
 * Create a seeded random number generator
 * @param seed - Seed value (integer)
 * @returns Function that returns random numbers in [0, 1)
 */
export function createRng(seed: number): () => number {
  let state = seed | 0; // Ensure integer

  return function(): number {
    // Mulberry32 algorithm
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
