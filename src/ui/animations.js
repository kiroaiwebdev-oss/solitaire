/**
 * Animation manager with tween system and screen transitions.
 */

import { easeOutCubic, easeOutBounce, easeInOutQuad, clamp } from '../core/math.js';

const EASINGS = {
  linear: t => t,
  easeOut: easeOutCubic,
  easeIn: t => t * t,
  easeInOut: easeInOutQuad,
  bounce: easeOutBounce,
  elastic: t => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
  },
  spring: t => {
    const s = 1.70158;
    return (t -= 1) * t * ((s + 1) * t + s) + 1;
  }
};

let tweenIdCounter = 0;

class Tween {
  constructor(target, props, duration, easing, onComplete) {
    this.id = ++tweenIdCounter;
    this.target = target;
    this.props = {};
    this.duration = duration;
    this.elapsed = 0;
    this.easing = typeof easing === 'function' ? easing : (EASINGS[easing] || EASINGS.easeOut);
    this.onComplete = onComplete || null;
    this.alive = true;

    // Capture start values
    for (const [key, endValue] of Object.entries(props)) {
      this.props[key] = {
        start: target[key] !== undefined ? target[key] : 0,
        end: endValue
      };
    }
  }

  update(dt) {
    if (!this.alive) return;
    this.elapsed += dt;
    const t = clamp(this.elapsed / this.duration, 0, 1);
    const easedT = this.easing(t);

    for (const [key, { start, end }] of Object.entries(this.props)) {
      this.target[key] = start + (end - start) * easedT;
    }

    if (t >= 1) {
      this.alive = false;
      if (this.onComplete) this.onComplete();
    }
  }
}

export class AnimationManager {
  constructor() {
    this.tweens = [];
    this.sequences = [];
  }

  /**
   * Add a new tween.
   * @returns {number} Tween ID for cancellation
   */
  add(target, props, duration, easing, onComplete) {
    const tween = new Tween(target, props, duration, easing, onComplete);
    this.tweens.push(tween);
    return tween.id;
  }

  /**
   * Screen transition: fade in
   */
  fadeIn(target, duration = 0.3) {
    target.alpha = 0;
    return this.add(target, { alpha: 1 }, duration, 'easeOut');
  }

  /**
   * Screen transition: fade out
   */
  fadeOut(target, duration = 0.3, onComplete) {
    return this.add(target, { alpha: 0 }, duration, 'easeOut', onComplete);
  }

  /**
   * Screen transition: slide in from direction
   */
  slideIn(target, direction, duration = 0.35) {
    const offsets = {
      left: { offsetX: -300 },
      right: { offsetX: 300 },
      up: { offsetY: -300 },
      down: { offsetY: 300 }
    };
    const off = offsets[direction] || offsets.right;
    Object.assign(target, off);
    target.alpha = 0;
    const endProps = { alpha: 1 };
    if (off.offsetX !== undefined) endProps.offsetX = 0;
    if (off.offsetY !== undefined) endProps.offsetY = 0;
    return this.add(target, endProps, duration, 'easeOut');
  }

  /**
   * Screen transition: scale in
   */
  scaleIn(target, duration = 0.3) {
    target.scale = 0.8;
    target.alpha = 0;
    return this.add(target, { scale: 1, alpha: 1 }, duration, 'spring');
  }

  /**
   * Button hover animation
   */
  buttonHover(target) {
    return this.add(target, { scale: 1.05 }, 0.15, 'easeOut');
  }

  /**
   * Button press animation
   */
  buttonPress(target, onComplete) {
    return this.add(target, { scale: 0.95 }, 0.1, 'easeOut', () => {
      this.add(target, { scale: 1 }, 0.15, 'bounce');
      if (onComplete) onComplete();
    });
  }

  /**
   * Card cascade stagger animation
   */
  cardCascade(cards, delay = 0.05) {
    cards.forEach((card, i) => {
      const startY = card.targetY || card.y;
      card.y = startY - 30;
      card.alpha = 0;
      setTimeout(() => {
        this.add(card, { y: startY, alpha: 1 }, 0.3, 'bounce');
      }, i * delay * 1000);
    });
  }

  /**
   * Score roll-up animation
   */
  scoreRollUp(target, prop, endValue, duration = 0.6) {
    return this.add(target, { [prop]: endValue }, duration, 'easeOut');
  }

  /**
   * Achievement slide-in notification
   */
  achievementSlideIn(target, onComplete) {
    target.offsetX = 300;
    target.alpha = 0;
    return this.add(target, { offsetX: 0, alpha: 1 }, 0.4, 'spring', onComplete);
  }

  /**
   * Level-up flash effect
   */
  levelUpFlash(target) {
    target.flashAlpha = 1;
    return this.add(target, { flashAlpha: 0 }, 0.8, 'easeOut');
  }

  update(dt) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      this.tweens[i].update(dt);
      if (!this.tweens[i].alive) {
        this.tweens.splice(i, 1);
      }
    }
  }

  isAnimating() {
    return this.tweens.length > 0;
  }

  cancel(id) {
    const idx = this.tweens.findIndex(t => t.id === id);
    if (idx !== -1) {
      this.tweens.splice(idx, 1);
    }
  }

  cancelAll() {
    this.tweens = [];
  }
}
