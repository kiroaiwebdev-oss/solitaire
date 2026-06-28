/**
 * Card class with suit, rank, position, animation, and programmatic rendering.
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

export class Card {
  constructor(suit, rank) {
    this.suit = suit;
    this.rank = rank;
    this.value = RANK_VALUES[rank];
    this.faceUp = false;
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.width = 70;
    this.height = 100;
    this.animating = false;
    this.animTime = 0;
    this.animDuration = 0.2;
    this.startX = 0;
    this.startY = 0;
    this.zIndex = 0;
    this.dragging = false;
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

  update(dt) {
    if (!this.animating) return;
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

  containsPoint(px, py) {
    return px >= this.x && px <= this.x + this.width &&
           py >= this.y && py <= this.y + this.height;
  }

  render(ctx, cardWidth, cardHeight) {
    this.width = cardWidth;
    this.height = cardHeight;

    if (this.faceUp) {
      this._renderFace(ctx, cardWidth, cardHeight);
    } else {
      this._renderBack(ctx, cardWidth, cardHeight);
    }
  }

  _renderFace(ctx, w, h) {
    const x = this.x;
    const y = this.y;
    const r = Math.min(w * 0.08, 6);
    const color = suitColor(this.suit);

    // Card background
    ctx.save();
    _roundedRectPath(ctx, x, y, w, h, r);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 1;
    ctx.stroke();

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

    ctx.restore();
  }

  _renderBack(ctx, w, h) {
    const x = this.x;
    const y = this.y;
    const r = Math.min(w * 0.08, 6);

    ctx.save();
    _roundedRectPath(ctx, x, y, w, h, r);
    ctx.fillStyle = '#1a3a6b';
    ctx.fill();
    ctx.strokeStyle = '#0d2040';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Inner border
    const inset = w * 0.08;
    _roundedRectPath(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, r * 0.5);
    ctx.strokeStyle = '#4a7abb';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Diamond pattern
    const cx = x + w / 2;
    const cy = y + h / 2;
    const patSize = w * 0.2;
    ctx.fillStyle = '#2a5aab';
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

    ctx.restore();
  }

  _drawSuitSymbol(ctx, cx, cy, size, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();

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
