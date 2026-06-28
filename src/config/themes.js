/**
 * Card back themes (unlockable), table felt themes, card face styles.
 * Each theme has colors and draw instructions for programmatic canvas rendering.
 * 12 card back themes with intricate programmatic patterns.
 */

export const DEFAULT_THEME = 'classic';

export const THEMES = {
  classic: {
    id: 'classic',
    name: 'Classic Green',
    backPrimary: '#1a5b3a',
    backSecondary: '#2a7b4a',
    backAccent: '#4a9b6a',
    pattern: 'diamonds',
    unlockCondition: { type: 'free' },
    description: 'The timeless classic.'
  },
  royalBlue: {
    id: 'royalBlue',
    name: 'Royal Blue',
    backPrimary: '#1a3a6b',
    backSecondary: '#2a5aab',
    backAccent: '#4a7abb',
    pattern: 'diamonds',
    unlockCondition: { type: 'free' },
    description: 'A regal blue pattern.'
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson',
    backPrimary: '#6b1a1a',
    backSecondary: '#ab2a2a',
    backAccent: '#bb4a4a',
    pattern: 'crosshatch',
    unlockCondition: { type: 'level', level: 3 },
    description: 'Unlock at Level 3.'
  },
  gold: {
    id: 'gold',
    name: 'Gold Pattern',
    backPrimary: '#6b5a1a',
    backSecondary: '#ab8a2a',
    backAccent: '#d4aa3a',
    pattern: 'fleur',
    unlockCondition: { type: 'level', level: 5 },
    description: 'Unlock at Level 5.'
  },
  nightSky: {
    id: 'nightSky',
    name: 'Night Sky',
    backPrimary: '#0d1b3e',
    backSecondary: '#1a2d5e',
    backAccent: '#4a6aaa',
    pattern: 'stars',
    unlockCondition: { type: 'level', level: 8 },
    description: 'Unlock at Level 8.'
  },
  oceanWave: {
    id: 'oceanWave',
    name: 'Ocean Wave',
    backPrimary: '#0a3a5a',
    backSecondary: '#1a6a8a',
    backAccent: '#3a9aba',
    pattern: 'waves',
    unlockCondition: { type: 'level', level: 10 },
    description: 'Unlock at Level 10.'
  },
  abstractArt: {
    id: 'abstractArt',
    name: 'Abstract Art',
    backPrimary: '#3a1a5a',
    backSecondary: '#6a3a8a',
    backAccent: '#aa5aba',
    pattern: 'abstract',
    unlockCondition: { type: 'achievement', achievement: 'foundation_builder' },
    description: 'Win 50 games to unlock.'
  },
  dailyChampion: {
    id: 'dailyChampion',
    name: 'Daily Champion',
    backPrimary: '#5a3a1a',
    backSecondary: '#8a5a2a',
    backAccent: '#ba8a4a',
    pattern: 'crown',
    unlockCondition: { type: 'streak', streak: 7 },
    description: 'Achieve a 7-day streak.'
  },
  celticKnot: {
    id: 'celticKnot',
    name: 'Celtic Knot',
    backPrimary: '#2a4a2a',
    backSecondary: '#4a7a4a',
    backAccent: '#8ab88a',
    pattern: 'celtic',
    unlockCondition: { type: 'level', level: 12 },
    description: 'Unlock at Level 12.'
  },
  geometricMandala: {
    id: 'geometricMandala',
    name: 'Geometric Mandala',
    backPrimary: '#2a2a4a',
    backSecondary: '#4a4a7a',
    backAccent: '#8a8abb',
    pattern: 'mandala',
    unlockCondition: { type: 'level', level: 15 },
    description: 'Unlock at Level 15.'
  },
  galaxyNebula: {
    id: 'galaxyNebula',
    name: 'Galaxy Nebula',
    backPrimary: '#0a0a2a',
    backSecondary: '#2a1a4a',
    backAccent: '#6a4abb',
    pattern: 'galaxy',
    unlockCondition: { type: 'achievement', achievement: 'card_shark' },
    description: 'Win 5 games in a row.'
  },
  emeraldForest: {
    id: 'emeraldForest',
    name: 'Emerald Forest',
    backPrimary: '#0a3a1a',
    backSecondary: '#1a5a2a',
    backAccent: '#3aba5a',
    pattern: 'forest',
    unlockCondition: { type: 'level', level: 20 },
    description: 'Unlock at Level 20.'
  }
};

// --- Table Felt Themes ---
export const TABLE_THEMES = {
  green: { id: 'green', name: 'Classic Green', color: '#1a6b3c', gradient: ['#1a6b3c', '#145a32'] },
  blue: { id: 'blue', name: 'Ocean Blue', color: '#1a3a6b', gradient: ['#1a3a6b', '#14305a'] },
  red: { id: 'red', name: 'Casino Red', color: '#6b1a2a', gradient: ['#6b1a2a', '#5a1422'] },
  purple: { id: 'purple', name: 'Royal Purple', color: '#3a1a5a', gradient: ['#3a1a5a', '#2a1448'] },
  dark: { id: 'dark', name: 'Dark Mode', color: '#1a1a2a', gradient: ['#1a1a2a', '#121220'] },
  midnight: { id: 'midnight', name: 'Midnight', color: '#0a0a1a', gradient: ['#0a0a1a', '#060612'] }
};

// --- Card Face Styles ---
export const CARD_FACE_STYLES = {
  classic: { id: 'classic', name: 'Classic', fontWeight: 'bold', suitSize: 0.4 },
  modern: { id: 'modern', name: 'Modern', fontWeight: '600', suitSize: 0.35 },
  minimal: { id: 'minimal', name: 'Minimal', fontWeight: '300', suitSize: 0.3 }
};

/**
 * Check if a theme is unlocked given progression state.
 * @param {string} themeId
 * @param {object} state - { level, achievements, dailyStreak }
 * @returns {boolean}
 */
export function isThemeUnlocked(themeId, state = {}) {
  const theme = THEMES[themeId];
  if (!theme) return false;

  const condition = theme.unlockCondition;
  if (!condition) return true;

  switch (condition.type) {
    case 'free':
      return true;
    case 'level':
      return (state.level || 1) >= condition.level;
    case 'achievement':
      return (state.achievements || []).includes(condition.achievement);
    case 'streak':
      return (state.dailyStreak || 0) >= condition.streak;
    default:
      return false;
  }
}

/**
 * Draw a themed card back on a canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w - card width
 * @param {number} h - card height
 * @param {string} themeId
 */
export function drawThemeBack(ctx, x, y, w, h, themeId) {
  const theme = THEMES[themeId] || THEMES[DEFAULT_THEME];
  const r = Math.min(w * 0.08, 6);

  ctx.save();

  // Clip to rounded rect
  _roundedRectPath(ctx, x, y, w, h, r);
  ctx.clip();

  // Fill background
  ctx.fillStyle = theme.backPrimary;
  ctx.fillRect(x, y, w, h);

  // Draw pattern
  switch (theme.pattern) {
    case 'diamonds': _drawDiamondPattern(ctx, x, y, w, h, theme); break;
    case 'crosshatch': _drawCrosshatchPattern(ctx, x, y, w, h, theme); break;
    case 'fleur': _drawFleurPattern(ctx, x, y, w, h, theme); break;
    case 'stars': _drawStarsPattern(ctx, x, y, w, h, theme); break;
    case 'waves': _drawWavesPattern(ctx, x, y, w, h, theme); break;
    case 'abstract': _drawAbstractPattern(ctx, x, y, w, h, theme); break;
    case 'crown': _drawCrownPattern(ctx, x, y, w, h, theme); break;
    case 'celtic': _drawCelticPattern(ctx, x, y, w, h, theme); break;
    case 'mandala': _drawMandalaPattern(ctx, x, y, w, h, theme); break;
    case 'galaxy': _drawGalaxyPattern(ctx, x, y, w, h, theme); break;
    case 'forest': _drawForestPattern(ctx, x, y, w, h, theme); break;
    default: _drawDiamondPattern(ctx, x, y, w, h, theme);
  }

  ctx.restore();

  // Border and inner frame
  ctx.save();
  _roundedRectPath(ctx, x, y, w, h, r);
  ctx.strokeStyle = theme.backAccent;
  ctx.lineWidth = 1;
  ctx.stroke();

  const inset = w * 0.08;
  _roundedRectPath(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, r * 0.5);
  ctx.strokeStyle = theme.backAccent;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

// --- Pattern Drawing Functions ---

function _drawDiamondPattern(ctx, x, y, w, h, theme) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const patSize = w * 0.2;
  ctx.fillStyle = theme.backSecondary;
  for (let row = -2; row <= 2; row++) {
    for (let col = -1; col <= 1; col++) {
      const px = cx + col * patSize;
      const py = cy + row * patSize;
      ctx.beginPath();
      ctx.moveTo(px, py - patSize * 0.3);
      ctx.lineTo(px + patSize * 0.2, py);
      ctx.lineTo(px, py + patSize * 0.3);
      ctx.lineTo(px - patSize * 0.2, py);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function _drawCrosshatchPattern(ctx, x, y, w, h, theme) {
  ctx.strokeStyle = theme.backSecondary;
  ctx.lineWidth = 1;
  const spacing = w * 0.15;
  for (let i = -h; i < w + h; i += spacing) {
    ctx.beginPath();
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i + h, y + h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + i + h, y);
    ctx.lineTo(x + i, y + h);
    ctx.stroke();
  }
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.fillStyle = theme.backAccent;
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

function _drawFleurPattern(ctx, x, y, w, h, theme) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.fillStyle = theme.backSecondary;
  const size = w * 0.12;
  for (let row = -2; row <= 2; row++) {
    for (let col = -1; col <= 1; col++) {
      const px = cx + col * (size * 2.5);
      const py = cy + row * (size * 2);
      ctx.beginPath();
      ctx.moveTo(px, py - size);
      ctx.lineTo(px + size * 0.5, py);
      ctx.lineTo(px, py + size);
      ctx.lineTo(px - size * 0.5, py);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py - size * 0.5, size * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = theme.backAccent;
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

function _drawStarsPattern(ctx, x, y, w, h, theme) {
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, theme.backPrimary);
  grad.addColorStop(1, theme.backSecondary);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = theme.backAccent;
  const starPositions = [
    [0.3, 0.2], [0.7, 0.15], [0.2, 0.5], [0.8, 0.4],
    [0.5, 0.7], [0.15, 0.8], [0.85, 0.75], [0.5, 0.3],
    [0.35, 0.65], [0.65, 0.55], [0.4, 0.85], [0.7, 0.85]
  ];
  for (const [sx, sy] of starPositions) {
    const px = x + w * sx;
    const py = y + h * sy;
    const size = w * 0.035;
    _drawStar(ctx, px, py, size);
  }
  // Moon crescent
  ctx.fillStyle = theme.backAccent;
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.45, w * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme.backPrimary;
  ctx.beginPath();
  ctx.arc(x + w * 0.55, y + h * 0.42, w * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function _drawStar(ctx, cx, cy, size) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const px = cx + Math.cos(angle) * size;
    const py = cy + Math.sin(angle) * size;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function _drawWavesPattern(ctx, x, y, w, h, theme) {
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, theme.backPrimary);
  grad.addColorStop(1, theme.backSecondary);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = theme.backAccent;
  ctx.lineWidth = 1.5;
  const waveCount = 6;
  for (let i = 0; i < waveCount; i++) {
    const baseY = y + (h / (waveCount + 1)) * (i + 1);
    ctx.beginPath();
    for (let px = 0; px <= w; px += 2) {
      const wy = baseY + Math.sin((px / w) * Math.PI * 3 + i * 0.8) * (h * 0.04);
      if (px === 0) ctx.moveTo(x + px, wy);
      else ctx.lineTo(x + px, wy);
    }
    ctx.stroke();
  }
}

function _drawAbstractPattern(ctx, x, y, w, h, theme) {
  const grad = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, w * 0.7);
  grad.addColorStop(0, theme.backSecondary);
  grad.addColorStop(1, theme.backPrimary);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  const circles = [
    [0.3, 0.3, 0.15], [0.7, 0.6, 0.12], [0.5, 0.8, 0.1],
    [0.2, 0.7, 0.08], [0.8, 0.25, 0.09]
  ];
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = theme.backAccent;
  for (const [cx, cy, cr] of circles) {
    ctx.beginPath();
    ctx.arc(x + w * cx, y + h * cy, w * cr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y + h * 0.2);
  ctx.lineTo(x + w * 0.65, y + h * 0.5);
  ctx.lineTo(x + w * 0.35, y + h * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function _drawCrownPattern(ctx, x, y, w, h, theme) {
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, theme.backSecondary);
  grad.addColorStop(1, theme.backPrimary);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  const cx = x + w / 2;
  const cy = y + h / 2;
  const crownW = w * 0.5;
  const crownH = h * 0.25;

  ctx.fillStyle = theme.backAccent;
  ctx.beginPath();
  ctx.moveTo(cx - crownW / 2, cy + crownH / 2);
  ctx.lineTo(cx - crownW / 2, cy - crownH / 4);
  ctx.lineTo(cx - crownW / 4, cy);
  ctx.lineTo(cx, cy - crownH / 2);
  ctx.lineTo(cx + crownW / 4, cy);
  ctx.lineTo(cx + crownW / 2, cy - crownH / 4);
  ctx.lineTo(cx + crownW / 2, cy + crownH / 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = theme.backPrimary;
  ctx.beginPath(); ctx.arc(cx - crownW / 2, cy - crownH / 4, w * 0.03, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy - crownH / 2, w * 0.03, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + crownW / 2, cy - crownH / 4, w * 0.03, 0, Math.PI * 2); ctx.fill();
}

function _drawCelticPattern(ctx, x, y, w, h, theme) {
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, theme.backPrimary);
  grad.addColorStop(1, theme.backSecondary);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // Celtic knot-like interlocking circles
  ctx.strokeStyle = theme.backAccent;
  ctx.lineWidth = 1.5;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = w * 0.15;

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const ox = cx + Math.cos(angle) * r * 0.5;
    const oy = cy + Math.sin(angle) * r * 0.5;
    ctx.beginPath();
    ctx.arc(ox, oy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Central circle
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = theme.backAccent;
  ctx.globalAlpha = 0.5;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function _drawMandalaPattern(ctx, x, y, w, h, theme) {
  const cx = x + w / 2;
  const cy = y + h / 2;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.6);
  grad.addColorStop(0, theme.backSecondary);
  grad.addColorStop(1, theme.backPrimary);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // Geometric mandala rings
  ctx.strokeStyle = theme.backAccent;
  ctx.lineWidth = 1;

  const rings = [0.35, 0.25, 0.15, 0.08];
  for (const ringR of rings) {
    const radius = w * ringR;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Radial lines
  const spokes = 8;
  for (let i = 0; i < spokes; i++) {
    const angle = (i * Math.PI * 2) / spokes;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * w * 0.08, cy + Math.sin(angle) * w * 0.08);
    ctx.lineTo(cx + Math.cos(angle) * w * 0.35, cy + Math.sin(angle) * w * 0.35);
    ctx.stroke();
  }

  // Petals
  ctx.fillStyle = theme.backAccent;
  ctx.globalAlpha = 0.3;
  for (let i = 0; i < spokes; i++) {
    const angle = (i * Math.PI * 2) / spokes + Math.PI / spokes;
    const px = cx + Math.cos(angle) * w * 0.2;
    const py = cy + Math.sin(angle) * w * 0.2;
    ctx.beginPath();
    ctx.arc(px, py, w * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function _drawGalaxyPattern(ctx, x, y, w, h, theme) {
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Dark background gradient
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.7);
  grad.addColorStop(0, theme.backSecondary);
  grad.addColorStop(0.5, theme.backPrimary);
  grad.addColorStop(1, '#000010');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // Spiral arms
  ctx.strokeStyle = theme.backAccent;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4;
  for (let arm = 0; arm < 2; arm++) {
    ctx.beginPath();
    for (let t = 0; t < 4; t += 0.1) {
      const angle = t + arm * Math.PI;
      const r = t * w * 0.06;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (t === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Stars
  ctx.fillStyle = theme.backAccent;
  const positions = [[0.2, 0.2], [0.8, 0.3], [0.3, 0.8], [0.75, 0.7], [0.5, 0.15], [0.15, 0.5]];
  for (const [sx, sy] of positions) {
    ctx.beginPath();
    ctx.arc(x + w * sx, y + h * sy, w * 0.015, 0, Math.PI * 2);
    ctx.fill();
  }
}

function _drawForestPattern(ctx, x, y, w, h, theme) {
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, theme.backSecondary);
  grad.addColorStop(1, theme.backPrimary);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // Simple tree shapes
  ctx.fillStyle = theme.backAccent;
  ctx.globalAlpha = 0.4;

  const trees = [[0.3, 0.6], [0.5, 0.5], [0.7, 0.65], [0.2, 0.75], [0.8, 0.7]];
  for (const [tx, ty] of trees) {
    const treeX = x + w * tx;
    const treeY = y + h * ty;
    const treeW = w * 0.08;
    const treeH = h * 0.2;
    // Triangle tree
    ctx.beginPath();
    ctx.moveTo(treeX, treeY - treeH);
    ctx.lineTo(treeX + treeW, treeY);
    ctx.lineTo(treeX - treeW, treeY);
    ctx.closePath();
    ctx.fill();
    // Trunk
    ctx.fillRect(treeX - treeW * 0.2, treeY, treeW * 0.4, treeH * 0.3);
  }
  ctx.globalAlpha = 1;

  // Ground line
  ctx.strokeStyle = theme.backAccent;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.8);
  for (let px = 0; px <= w; px += 3) {
    ctx.lineTo(x + px, y + h * 0.8 + Math.sin(px * 0.1) * 2);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function _roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
