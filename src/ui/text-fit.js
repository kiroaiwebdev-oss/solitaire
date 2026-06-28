/**
 * Canvas text-fit system (shared by ScreenButton, HudButton and any text that
 * lives inside a bounded box).
 *
 * The renderer and the automated overflow tests use the SAME functions here so
 * that what the test measures is exactly what the renderer draws. This is the
 * root-cause fix for labels overflowing/overlapping their containers: every
 * bounded label is measured with ctx.measureText and the font is shrunk to fit
 * the available width; if it still does not fit at the minimum size the label
 * is wrapped onto a second line (when it has spaces) or ellipsized.
 *
 * NOTE: the headless DOM harness returns ~6px per character from measureText
 * regardless of font size. The fit logic therefore relies on wrapping/
 * ellipsizing (not just shrinking) to guarantee a fit, which is precisely what
 * we want it to guard.
 */

export const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Build a canvas font string. */
export function fontStr(size, weight = 'bold', family = FONT_FAMILY) {
  return `${weight} ${Math.max(1, size)}px ${family}`;
}

/** Measure a string's pixel width at a given size/weight using the live ctx. */
export function measureTextWidth(ctx, text, size, weight = 'bold', family = FONT_FAMILY) {
  ctx.font = fontStr(size, weight, family);
  return ctx.measureText(text || '').width;
}

/**
 * Largest font size in [minSize, baseSize] at which `text` fits `maxWidth`.
 * Steps down by `step` px. Returns at least minSize.
 */
export function fitFontSize(ctx, text, maxWidth, baseSize, minSize = 9, weight = 'bold', family = FONT_FAMILY, step = 0.5) {
  let size = baseSize;
  while (size > minSize) {
    if (measureTextWidth(ctx, text, size, weight, family) <= maxWidth) return size;
    size -= step;
  }
  return Math.max(1, minSize);
}

/**
 * Truncate `text` with a trailing ellipsis so it fits `maxWidth` at `size`.
 */
export function ellipsize(ctx, text, maxWidth, size, weight = 'bold', family = FONT_FAMILY) {
  if (measureTextWidth(ctx, text, size, weight, family) <= maxWidth) return text;
  const ell = '\u2026';
  let str = text;
  while (str.length > 0) {
    str = str.slice(0, -1);
    const candidate = str.replace(/\s+$/, '') + ell;
    if (measureTextWidth(ctx, candidate, size, weight, family) <= maxWidth) return candidate;
  }
  return ell;
}

/**
 * Greedy word-wrap into as many lines as needed at the given size. Lines whose
 * single word still exceeds maxWidth are left long (the caller decides whether
 * to keep shrinking or to ellipsize).
 */
export function wrapText(ctx, text, maxWidth, size, weight = 'bold', family = FONT_FAMILY) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? current + ' ' + word : word;
    if (current && measureTextWidth(ctx, candidate, size, weight, family) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

/**
 * Fit a label into a box. Returns { fontSize, lines } where every line is
 * guaranteed to measure <= (boxW - 2*padX) at the returned fontSize.
 *
 * Strategy:
 *   1. Shrink the font to fit on a single line (down to minSize).
 *   2. If still too wide and wrapping is allowed and the text has spaces and
 *      the box is tall enough, wrap onto up to maxLines lines (largest size
 *      whose wrapped lines all fit and whose total height fits the box).
 *   3. Otherwise ellipsize on a single line at minSize.
 */
export function fitBoxLabel(ctx, text, boxW, boxH, opts = {}) {
  text = text == null ? '' : String(text);
  const weight = opts.weight || 'bold';
  const family = opts.family || FONT_FAMILY;
  const padX = opts.padX != null ? opts.padX : clampNum(boxW * 0.08, 6, 18);
  const baseSize = opts.baseSize != null ? opts.baseSize : Math.min(boxW * 0.2, boxH * 0.5, 16);
  const minSize = opts.minSize != null ? opts.minSize : 9;
  const allowWrap = opts.allowWrap !== false;
  const maxLines = opts.maxLines || 2;
  const lineSpacing = opts.lineSpacing != null ? opts.lineSpacing : 1.15;
  const maxWidth = Math.max(1, boxW - padX * 2);

  // 1. Single-line fit.
  const size1 = fitFontSize(ctx, text, maxWidth, baseSize, minSize, weight, family);
  if (measureTextWidth(ctx, text, size1, weight, family) <= maxWidth) {
    return { fontSize: size1, lines: [text] };
  }

  // 2. Wrap onto multiple lines.
  if (allowWrap && /\s/.test(text.trim())) {
    for (let size = baseSize; size >= minSize; size -= 0.5) {
      const lineHeight = size * lineSpacing;
      const linesByHeight = Math.max(1, Math.floor((boxH * 0.92) / lineHeight));
      const allowed = Math.min(maxLines, linesByHeight);
      if (allowed < 2) continue;
      const lines = wrapText(ctx, text, maxWidth, size, weight, family);
      if (lines.length <= allowed &&
          lines.every(l => measureTextWidth(ctx, l, size, weight, family) <= maxWidth)) {
        return { fontSize: size, lines };
      }
    }
  }

  // 3. Ellipsize on a single line.
  return { fontSize: minSize, lines: [ellipsize(ctx, text, maxWidth, minSize, weight, family)] };
}

/**
 * Draw a label fitted + centered inside the box centered at (cx, cy). The
 * caller is responsible for setting ctx.fillStyle before calling. Returns the
 * fit info ({ fontSize, lines }).
 */
export function drawFittedLabel(ctx, text, cx, cy, boxW, boxH, opts = {}) {
  const fit = fitBoxLabel(ctx, text, boxW, boxH, opts);
  const weight = opts.weight || 'bold';
  const family = opts.family || FONT_FAMILY;
  const lineSpacing = opts.lineSpacing != null ? opts.lineSpacing : 1.15;
  ctx.font = fontStr(fit.fontSize, weight, family);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lineHeight = fit.fontSize * lineSpacing;
  const totalH = lineHeight * fit.lines.length;
  const yOffset = opts.yOffset || 0;
  let y = cy + yOffset - totalH / 2 + lineHeight / 2;
  for (const line of fit.lines) {
    ctx.fillText(line, cx, y);
    y += lineHeight;
  }
  return fit;
}

function clampNum(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
