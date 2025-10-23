/**
 * Hash an arbitrary string into four 32-bit seeds (cyrb128 variant).
 * Suitable for feeding small counter-based PRNGs.
 */
function hashSeedToState(seed: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;

  for (let i = 0; i < seed.length; i += 1) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 597399067);
    h2 = Math.imul(h2 ^ ch, 2869860233);
    h3 = Math.imul(h3 ^ ch, 951274213);
    h4 = Math.imul(h4 ^ ch, 2716044179);
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);

  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ];
}

/**
 * Small fast counter PRNG (sfc32) seeded from an arbitrary string.
 * Returns a function that yields floating point numbers in the range [0, 1).
 */
export function createSeededRng(seed: string): () => number {
  let [a, b, c, d] = hashSeedToState(seed);
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const sum = (t + d) | 0;
    c = (c + sum) | 0;
    return (sum >>> 0) / 4294967296;
  };
}
