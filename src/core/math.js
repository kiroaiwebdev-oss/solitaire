/**
 * Math utilities: vector2, lerp, clamp, easing functions, random helpers.
 */

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

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function vec2Lerp(a, b, t) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Easing functions
export function easeOutQuad(t) {
  return t * (2 - t);
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

export function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInQuad(t) {
  return t * t;
}

// Seeded random number generator (mulberry32)
export function createRng(seed) {
  let s = seed | 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Random integer in [min, max] inclusive
export function randomInt(min, max, rngFn = Math.random) {
  return Math.floor(rngFn() * (max - min + 1)) + min;
}

// Random item from array
export function randomPick(arr, rngFn = Math.random) {
  return arr[Math.floor(rngFn() * arr.length)];
}
