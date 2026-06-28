/**
 * Headless DOM + Canvas2D + Web Audio harness.
 *
 * Provides installDOM() which installs stub implementations of the browser
 * globals the game touches (window, document, canvas, 2D context, AudioContext,
 * localStorage, requestAnimationFrame, navigator) onto globalThis so that the
 * real Game / Screens / HUD / Renderer / Audio code can boot and run without a
 * browser. Nothing here mocks game logic - only the platform surface.
 *
 * requestAnimationFrame is intentionally a no-op (returns an id, never calls
 * back) so the game loop does not spin; tests step the simulation manually by
 * calling app._update(dt) / app._render(dt).
 */

const NOOP = () => {};

function makeGradient() {
  return { addColorStop: NOOP };
}

/**
 * Create a fake CanvasRenderingContext2D. Every drawing call is a no-op;
 * measureText returns a plausible width; gradients return objects with
 * addColorStop. State properties are plain fields.
 */
export function makeCtx() {
  const ctx = {
    canvas: null,
    // state properties
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
    font: '10px sans-serif', textAlign: 'left', textBaseline: 'alphabetic',
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    shadowColor: 'transparent', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    lineCap: 'butt', lineJoin: 'miter', miterLimit: 10,
    // path + draw ops
    save: NOOP, restore: NOOP, beginPath: NOOP, closePath: NOOP,
    moveTo: NOOP, lineTo: NOOP, quadraticCurveTo: NOOP, bezierCurveTo: NOOP,
    arc: NOOP, arcTo: NOOP, rect: NOOP, ellipse: NOOP,
    fill: NOOP, stroke: NOOP, clip: NOOP,
    fillRect: NOOP, strokeRect: NOOP, clearRect: NOOP,
    fillText: NOOP, strokeText: NOOP,
    translate: NOOP, rotate: NOOP, scale: NOOP, transform: NOOP, setTransform: NOOP, resetTransform: NOOP,
    setLineDash: NOOP, getLineDash: () => [],
    drawImage: NOOP, putImageData: NOOP,
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray((w || 1) * (h || 1) * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray((w || 1) * (h || 1) * 4) }),
    measureText: (t) => ({ width: (t ? String(t).length : 0) * 6 }),
    createLinearGradient: makeGradient,
    createRadialGradient: makeGradient,
    createPattern: () => ({}),
  };
  return ctx;
}

/**
 * Create a fake canvas element backed by a shared/owned 2D context stub.
 */
export function makeCanvas(width = 800, height = 600) {
  const ctx = makeCtx();
  const canvas = {
    width, height,
    style: {},
    _listeners: {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: canvas.width, bottom: canvas.height, width: canvas.width, height: canvas.height, x: 0, y: 0 }),
    setPointerCapture: NOOP,
    releasePointerCapture: NOOP,
    addEventListener: (type, fn) => { (canvas._listeners[type] = canvas._listeners[type] || []).push(fn); },
    removeEventListener: NOOP,
    dispatch: (type, ev) => { for (const fn of (canvas._listeners[type] || [])) fn(ev); },
    focus: NOOP,
  };
  ctx.canvas = canvas;
  return canvas;
}

class FakeAudioParam {
  constructor(v = 0) { this.value = v; }
  setValueAtTime() { return this; }
  linearRampToValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
  setTargetAtTime() { return this; }
  cancelScheduledValues() { return this; }
}

function makeAudioNode(extra = {}) {
  return Object.assign({
    connect: () => node, disconnect: NOOP, start: NOOP, stop: NOOP,
  }, extra);
  function node() {}
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.state = 'running';
    this.destination = {};
  }
  createGain() { return { gain: new FakeAudioParam(1), connect: NOOP, disconnect: NOOP }; }
  createOscillator() {
    return { type: 'sine', frequency: new FakeAudioParam(440), detune: new FakeAudioParam(0), connect: NOOP, disconnect: NOOP, start: NOOP, stop: NOOP };
  }
  createBiquadFilter() {
    return { type: 'lowpass', frequency: new FakeAudioParam(350), Q: new FakeAudioParam(1), gain: new FakeAudioParam(0), connect: NOOP, disconnect: NOOP };
  }
  createBuffer(channels, length, rate) {
    return { getChannelData: () => new Float32Array(length || 1), length: length || 1, sampleRate: rate || 44100, numberOfChannels: channels || 1 };
  }
  createBufferSource() { return { buffer: null, connect: NOOP, disconnect: NOOP, start: NOOP, stop: NOOP }; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
}

function makeLocalStorage() {
  const data = {};
  return {
    _data: data,
    getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; },
    clear() { for (const k of Object.keys(data)) delete data[k]; },
    key(i) { return Object.keys(data)[i] || null; },
    get length() { return Object.keys(data).length; },
  };
}

/**
 * Install all browser-surface stubs on globalThis.
 * @param {object} [opts] - { width, height }
 * @returns {{ window, document, canvas, getElements }}
 */
export function installDOM(opts = {}) {
  const width = opts.width || 800;
  const height = opts.height || 600;

  const canvas = makeCanvas(width, height);

  // Elements referenced by id in the app/boot code.
  const fatalErrorEl = { hidden: true, removeAttribute(a) { if (a === 'hidden') this.hidden = false; }, setAttribute() {}, style: {} };
  const errorMsgEl = { textContent: '', style: {} };

  const elements = {
    'game-canvas': canvas,
    'fatal-error': fatalErrorEl,
    'error-message': errorMsgEl,
  };

  const docListeners = {};
  const document = {
    getElementById: (id) => elements[id] || null,
    createElement: (tag) => {
      if (tag === 'canvas') return makeCanvas(width, height);
      return { style: {}, textContent: '', appendChild: NOOP, remove: NOOP, setAttribute: NOOP, addEventListener: NOOP };
    },
    addEventListener: (type, fn) => { (docListeners[type] = docListeners[type] || []).push(fn); },
    removeEventListener: NOOP,
    dispatchDoc: (type, ev) => { for (const fn of (docListeners[type] || [])) fn(ev); },
    body: { appendChild: NOOP, removeChild: NOOP, style: {} },
    documentElement: { style: {} },
    hidden: false,
    visibilityState: 'visible',
  };

  const winListeners = {};
  const window = {
    location: { search: '', href: 'http://localhost/', pathname: '/' },
    devicePixelRatio: 1,
    innerWidth: width,
    innerHeight: height,
    AudioContext: FakeAudioContext,
    webkitAudioContext: FakeAudioContext,
    addEventListener: (type, fn) => { (winListeners[type] = winListeners[type] || []).push(fn); },
    removeEventListener: NOOP,
    dispatchWin: (type, ev) => { for (const fn of (winListeners[type] || [])) fn(ev); },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: NOOP,
    matchMedia: (q) => ({ matches: false, media: q, addEventListener: NOOP, removeEventListener: NOOP, addListener: NOOP, removeListener: NOOP }),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    navigator: { vibrate: NOOP, userAgent: 'node-harness' },
    __app: null,
  };
  window.window = window;
  window.document = document;

  globalThis.window = window;
  globalThis.document = document;
  // navigator may be a read-only global in some Node versions; only set if writable.
  try {
    if (!globalThis.navigator) globalThis.navigator = window.navigator;
  } catch { /* read-only global navigator already exists; the game guards navigator.vibrate */ }
  globalThis.localStorage = makeLocalStorage();
  globalThis.AudioContext = FakeAudioContext;
  globalThis.webkitAudioContext = FakeAudioContext;
  globalThis.requestAnimationFrame = window.requestAnimationFrame;
  globalThis.cancelAnimationFrame = window.cancelAnimationFrame;
  globalThis.OffscreenCanvas = undefined; // force render.js to use document.createElement('canvas')

  return { window, document, canvas, elements, fatalErrorEl, errorMsgEl };
}
