/**
 * Math utilities: vector2, lerp, clamp, easing functions, bezier curves,
 * simplex noise for particles, seeded RNG, random helpers.
 */

// --- Vector2 ---

export function vec2(x = 0, y = 0) {
  return { x, y };
}

export function vec2Add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function vec2Sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function vec2Scale(v, s) {
  return { x: v.x * s, y: v.y * s };
}

export function vec2Dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function vec2Len(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function vec2Normalize(v) {
  const len = vec2Len(v);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function vec2Dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

export function vec2Rotate(v, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

export function vec2Lerp(a, b, t) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

// --- Interpolation ---

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function inverseLerp(a, b, v) {
  if (a === b) return 0;
  return (v - a) / (b - a);
}

export function remap(inMin, inMax, outMin, outMax, v) {
  const t = inverseLerp(inMin, inMax, v);
  return lerp(outMin, outMax, t);
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// --- Easing Functions ---

export function easeOutQuad(t) {
  return t * (2 - t);
}

export function easeInQuad(t) {
  return t * t;
}

export function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInCubic(t) {
  return t * t * t;
}

export function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

export function easeOutBounce(t) {
  if (t < 1 / 2.75) {
    return 7.5625 * t * t;
  } else if (t < 2 / 2.75) {
    t -= 1.5 / 2.75;
    return 7.5625 * t * t + 0.75;
  } else if (t < 2.5 / 2.75) {
    t -= 2.25 / 2.75;
    return 7.5625 * t * t + 0.9375;
  } else {
    t -= 2.625 / 2.75;
    return 7.5625 * t * t + 0.984375;
  }
}

export function easeInBounce(t) {
  return 1 - easeOutBounce(1 - t);
}

export function easeOutElastic(t) {
  if (t === 0 || t === 1) return t;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

export function easeInElastic(t) {
  if (t === 0 || t === 1) return t;
  const c4 = (2 * Math.PI) / 3;
  return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
}

export function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function spring(t, damping = 0.5, frequency = 4) {
  return 1 - Math.exp(-damping * t * 10) * Math.cos(frequency * t * Math.PI * 2);
}

// --- Bezier Curves ---

/**
 * Evaluate a cubic bezier at parameter t.
 * Points: p0, p1 (control), p2 (control), p3
 */
export function cubicBezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const uu = u * u;
  const uuu = uu * u;
  const tt = t * t;
  const ttt = tt * t;
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
  };
}

/**
 * Evaluate a quadratic bezier at parameter t.
 */
export function quadBezier(p0, p1, p2, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
  };
}

/**
 * Get an array of points along a cubic bezier.
 */
export function bezierPoints(p0, p1, p2, p3, segments = 20) {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    points.push(cubicBezier(p0, p1, p2, p3, i / segments));
  }
  return points;
}

// --- Simplex Noise (2D) ---

const GRAD3 = [
  [1,1],[-1,1],[1,-1],[-1,-1],
  [1,0],[-1,0],[0,1],[0,-1]
];

// Use a simpler noise approach that avoids complex lookup tables
const _noisePermutation = new Array(512);
(function initNoise() {
  const p = [];
  for (let i = 0; i < 256; i++) p[i] = i;
  // Simple deterministic shuffle
  let seed = 42;
  for (let i = 255; i > 0; i--) {
    seed = (seed * 16807 + 0) % 2147483647;
    const j = seed % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) _noisePermutation[i] = p[i & 255];
})();

function _grad2(hash, x, y) {
  const h = hash & 7;
  const u = h < 4 ? x : y;
  const v = h < 4 ? y : x;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}

/**
 * 2D simplex noise, returns value in [-1, 1].
 */
export function noise2D(xin, yin) {
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;

  const s = (xin + yin) * F2;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);

  const t = (i + j) * G2;
  const X0 = i - t;
  const Y0 = j - t;
  const x0 = xin - X0;
  const y0 = yin - Y0;

  let i1, j1;
  if (x0 > y0) { i1 = 1; j1 = 0; }
  else { i1 = 0; j1 = 1; }

  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;

  const ii = i & 255;
  const jj = j & 255;

  let n0 = 0, n1 = 0, n2 = 0;

  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) {
    t0 *= t0;
    n0 = t0 * t0 * _grad2(_noisePermutation[ii + _noisePermutation[jj]], x0, y0);
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) {
    t1 *= t1;
    n1 = t1 * t1 * _grad2(_noisePermutation[ii + i1 + _noisePermutation[jj + j1]], x1, y1);
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) {
    t2 *= t2;
    n2 = t2 * t2 * _grad2(_noisePermutation[ii + 1 + _noisePermutation[jj + 1]], x2, y2);
  }

  return 70 * (n0 + n1 + n2);
}

/**
 * Fractal Brownian Motion using simplex noise.
 */
export function fbm(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2D(x * frequency, y * frequency);
    maxValue += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return value / maxValue;
}

// --- Seeded RNG (Mulberry32) ---

/**
 * Create a seeded PRNG using mulberry32 algorithm.
 * Returns a function that produces values in [0, 1).
 * @param {number} seed
 * @returns {() => number}
 */
export function createRng(seed) {
  let s = seed | 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Random Helpers ---

/**
 * Random integer in [min, max] inclusive.
 */
export function randomInt(min, max, rngFn = Math.random) {
  return Math.floor(rngFn() * (max - min + 1)) + min;
}

/**
 * Random item from array.
 */
export function randomPick(arr, rngFn = Math.random) {
  return arr[Math.floor(rngFn() * arr.length)];
}

/**
 * Random float in [min, max).
 */
export function randomFloat(min, max, rngFn = Math.random) {
  return min + rngFn() * (max - min);
}

/**
 * Shuffle an array in place using Fisher-Yates.
 */
export function shuffleArray(arr, rngFn = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rngFn() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --- Angle Helpers ---

export function degToRad(deg) {
  return deg * (Math.PI / 180);
}

export function radToDeg(rad) {
  return rad * (180 / Math.PI);
}

export function angleDiff(a, b) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

// --- Collision Helpers ---

export function pointInRect(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

export function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
