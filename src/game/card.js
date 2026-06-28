/**
 * Card class with suit, rank, position, animation, 3D flip,
 * drag state, elevation shadow, tilt, glow, and programmatic rendering.
 */

import { lerp, easeOutCubic } from '../core/math.js';

export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const RANK_VALUES = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13 };

export function isRed(suit) {
  return suit === 'hearts' || suit === 'diamonds';
}

export function isBlack(suit) {
  return suit === 'spades' || suit === 'clubs';
}

export function suitColor(suit) {
  return isRed(suit) ? '#cc0000' : '#1a1a1a';
}

// Active theme for all card backs (shared across all cards)
let _activeTheme = 'classic';

/**
 * Set the active card back theme.
 * @param {string} themeId
 */
export function setCardTheme(themeId) {
  _activeTheme = themeId || 'classic';
}

/**
 * Get the active card back theme.
 * @returns {string}
 */
export function getCardTheme() {
  return _activeTheme;
}

export class Card {
  constructor(suit, rank) {
    this.suit = suit;
    this.rank = rank;
    this.value = RANK_VALUES[rank];
    this.faceUp = false;

    // Position
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.width = 70;
    this.height = 100;

    // Movement animation
    this.animating = false;
    this.animTime = 0;
    this.animDuration = 0.2;
    this.startX = 0;
    this.startY = 0;

    // Z-order
    this.zIndex = 0;

    // Drag state
    this.dragging = false;

    // Elevation (affects shadow) 0-1
    this.elevation = 0;
    this.targetElevation = 0;

    // Tilt angle (from drag velocity)
    this.tilt = 0;
    this.targetTilt = 0;

    // Glow state for hints
    this.glowing = false;
    this.glowIntensity = 0;
    this.glowColor = '#ffcc00';

    // 3D Flip animation
    this.flipping = false;
    this.flipTime = 0;
    this.flipDuration = 0.3;
    this.flipTargetFaceUp = false;
    this.flipScaleX = 1;
  }

  get color() {
    return isRed(this.suit) ? 'red' : 'black';
  }

  get isRed() {
    return isRed(this.suit);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
  }

  animateTo(x, y, duration = 0.2) {
    this.startX = this.x;
    this.startY = this.y;
    this.targetX = x;
    this.targetY = y;
    this.animating = true;
    this.animTime = 0;
    this.animDuration = duration;
  }

  /**
   * Animate a card flip. ScaleX goes 1 -> 0 -> 1, face changes at midpoint.
   */
  animateFlip(faceUp, duration = 0.3) {
    this.flipping = true;
    this.flipTime = 0;
    this.flipDuration = duration;
    this.flipTargetFaceUp = faceUp;
    this.flipScaleX = 1;
  }

  update(dt) {
    // Position animation
    if (this.animating) {
      this.animTime += dt;
      const t = Math.min(this.animTime / this.animDuration, 1);
      const eased = easeOutCubic(t);
      this.x = lerp(this.startX, this.targetX, eased);
      this.y = lerp(this.startY, this.targetY, eased);
      if (t >= 1) {
        this.animating = false;
        this.x = this.targetX;
        this.y = this.targetY;
      }
    }

    // Flip animation
    if (this.flipping) {
      this.flipTime += dt;
      const t = Math.min(this.flipTime / this.flipDuration, 1);
      if (t < 0.5) {
        this.flipScaleX = 1 - t * 2;
      } else {
        if (this.faceUp !== this.flipTargetFaceUp) {
          this.faceUp = this.flipTargetFaceUp;
        }
        this.flipScaleX = (t - 0.5) * 2;
      }
      if (t >= 1) {
        this.flipping = false;
        this.flipScaleX = 1;
        this.faceUp = this.flipTargetFaceUp;
      }
    }

    // Smooth elevation
    this.elevation = lerp(this.elevation, this.targetElevation, 0.15);

    // Smooth tilt
    this.tilt = lerp(this.tilt, this.targetTilt, 0.12);

    // Glow pulse
    if (this.glowing) {
      this.glowIntensity = 0.5 + 0.5 * Math.sin(performance.now() * 0.005);
    } else {
      this.glowIntensity = lerp(this.glowIntensity, 0, 0.1);
    }
  }

  containsPoint(px, py) {
    return px >= this.x && px <= this.x + this.width &&
           py >= this.y && py <= this.y + this.height;
  }

  render(ctx, cardWidth, cardHeight) {
    this.width = cardWidth;
    this.height = cardHeight;

    ctx.save();

    // Apply tilt
    if (Math.abs(this.tilt) > 0.001) {
      const cx = this.x + cardWidth / 2;
      const cy = this.y + cardHeight / 2;
      ctx.translate(cx, cy);
      ctx.rotate(this.tilt);
      ctx.translate(-cx, -cy);
    }

    // Draw glow
    if (this.glowIntensity > 0.01) {
      ctx.shadowColor = this.glowColor;
      ctx.shadowBlur = 10 + this.glowIntensity * 10;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Draw elevation shadow
    if (this.elevation > 0.01) {
      const shadowBlur = 4 + this.elevation * 12;
      const shadowOffsetY = 2 + this.elevation * 6;
      ctx.shadowColor = `rgba(0,0,0,${0.15 + this.elevation * 0.25})`;
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = shadowOffsetY;
    }

    // Apply flip scale transform
    if (this.flipping && this.flipScaleX < 1) {
      const cx = this.x + cardWidth / 2;
      ctx.translate(cx, 0);
      ctx.scale(this.flipScaleX, 1);
      ctx.translate(-cx, 0);
    }

    if (this.faceUp) {
      this._renderFace(ctx, cardWidth, cardHeight);
    } else {
      this._renderBack(ctx, cardWidth, cardHeight);
    }

    ctx.restore();
  }

  _renderFace(ctx, w, h) {
    const x = this.x;
    const y = this.y;
    const r = Math.min(w * 0.08, 6);
    const color = suitColor(this.suit);

    // Card background
    _roundedRectPath(ctx, x, y, w, h, r);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#b0b0b0';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Clear shadow for text rendering
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Rank in top-left
    const fontSize = Math.max(10, w * 0.22);
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(this.rank, x + w * 0.08, y + h * 0.05);

    // Suit symbol under rank (top-left)
    const smallSuitSize = w * 0.18;
    this._drawSuitSymbol(ctx, x + w * 0.08 + smallSuitSize * 0.3, y + h * 0.05 + fontSize + 2, smallSuitSize, color);

    // Large center suit
    const bigSuitSize = w * 0.4;
    this._drawSuitSymbol(ctx, x + w * 0.5, y + h * 0.5, bigSuitSize, color);

    // Rank in bottom-right (inverted)
    ctx.save();
    ctx.translate(x + w, y + h);
    ctx.rotate(Math.PI);
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(this.rank, w * 0.08, h * 0.05);
    const smallSuitSize2 = w * 0.18;
    this._drawSuitSymbol(ctx, w * 0.08 + smallSuitSize2 * 0.3, h * 0.05 + fontSize + 2, smallSuitSize2, color);
    ctx.restore();
  }

  _renderBack(ctx, w, h) {
    // Delegate to themes module - lazy import to avoid circular deps at module level
    const { drawThemeBack } = _getThemeModule();
    if (drawThemeBack) {
      drawThemeBack(ctx, this.x, this.y, w, h, _activeTheme);
    } else {
      // Fallback if theme module unavailable
      const r = Math.min(w * 0.08, 6);
      _roundedRectPath(ctx, this.x, this.y, w, h, r);
      ctx.fillStyle = '#1a5b3a';
      ctx.fill();
      ctx.strokeStyle = '#4a9b6a';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  _drawSuitSymbol(ctx, cx, cy, size, color) {
    ctx.save();
    ctx.fillStyle = color;

    switch (this.suit) {
      case 'spades':
        this._drawSpade(ctx, cx, cy, size);
        break;
      case 'hearts':
        this._drawHeart(ctx, cx, cy, size);
        break;
      case 'diamonds':
        this._drawDiamond(ctx, cx, cy, size);
        break;
      case 'clubs':
        this._drawClub(ctx, cx, cy, size);
        break;
    }

    ctx.restore();
  }

  _drawSpade(ctx, cx, cy, size) {
    const s = size * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.bezierCurveTo(cx - s * 0.2, cy - s * 0.6, cx - s, cy - s * 0.2, cx - s, cy + s * 0.1);
    ctx.bezierCurveTo(cx - s, cy + s * 0.5, cx - s * 0.2, cy + s * 0.5, cx, cy + s * 0.2);
    ctx.bezierCurveTo(cx + s * 0.2, cy + s * 0.5, cx + s, cy + s * 0.5, cx + s, cy + s * 0.1);
    ctx.bezierCurveTo(cx + s, cy - s * 0.2, cx + s * 0.2, cy - s * 0.6, cx, cy - s);
    ctx.fill();
    // Stem
    ctx.fillRect(cx - s * 0.1, cy + s * 0.1, s * 0.2, s * 0.6);
  }

  _drawHeart(ctx, cx, cy, size) {
    const s = size * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.7);
    ctx.bezierCurveTo(cx - s * 1.2, cy - s * 0.2, cx - s * 0.6, cy - s, cx, cy - s * 0.3);
    ctx.bezierCurveTo(cx + s * 0.6, cy - s, cx + s * 1.2, cy - s * 0.2, cx, cy + s * 0.7);
    ctx.fill();
  }

  _drawDiamond(ctx, cx, cy, size) {
    const s = size * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s * 0.6, cy);
    ctx.lineTo(cx, cy + s);
    ctx.lineTo(cx - s * 0.6, cy);
    ctx.closePath();
    ctx.fill();
  }

  _drawClub(ctx, cx, cy, size) {
    const s = size * 0.3;
    // Three circles
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.7, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - s * 0.9, cy + s * 0.2, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + s * 0.9, cy + s * 0.2, s, 0, Math.PI * 2);
    ctx.fill();
    // Stem
    ctx.fillRect(cx - s * 0.2, cy + s * 0.2, s * 0.4, s * 1.2);
  }

  toString() {
    return `${this.rank}${this.suit[0].toUpperCase()}`;
  }
}

// Lazy theme module reference (avoids circular import at module top level)
let _themeModule = null;
function _getThemeModule() {
  if (!_themeModule) {
    try {
      // This will be resolved at runtime since themes.js imports from card.js
      // The drawThemeBack function is set externally via registerThemeRenderer
      _themeModule = { drawThemeBack: _registeredThemeRenderer };
    } catch (e) {
      _themeModule = { drawThemeBack: null };
    }
  }
  return _themeModule;
}

let _registeredThemeRenderer = null;

/**
 * Register the theme renderer function (called by themes.js to avoid circular deps).
 */
export function registerThemeRenderer(fn) {
  _registeredThemeRenderer = fn;
  _themeModule = { drawThemeBack: fn };
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
