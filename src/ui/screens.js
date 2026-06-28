/**
 * Screens/overlays stub.
 * Full implementation in a later feature.
 */

export class Screens {
  constructor(renderer, audio) {
    this.renderer = renderer;
    this.audio = audio;
    this.activeScreen = null;
  }

  show(screenName) {
    this.activeScreen = screenName;
  }

  hide() {
    this.activeScreen = null;
  }

  isActive() {
    return this.activeScreen !== null;
  }

  update(dt) {
    // Stub
  }

  render() {
    // Stub - render win screen overlay
    if (this.activeScreen === 'win') {
      const ctx = this.renderer.ctx;
      const w = this.renderer.logicalWidth;
      const h = this.renderer.logicalHeight;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, w, h);
      ctx.font = `bold ${Math.min(w * 0.08, 48)}px system-ui, sans-serif`;
      ctx.fillStyle = '#ffd700';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('You Win!', w / 2, h / 2 - 30);
      ctx.font = `${Math.min(w * 0.04, 24)}px system-ui, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Click to play again', w / 2, h / 2 + 20);
    }
  }

  handleClick(x, y) {
    if (this.activeScreen === 'win') {
      return 'newGame';
    }
    return null;
  }
}
