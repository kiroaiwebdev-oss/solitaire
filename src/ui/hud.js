/**
 * HUD stub - in-game heads-up display.
 * Full implementation in a later feature.
 */

export class HUD {
  constructor(game, renderer) {
    this.game = game;
    this.renderer = renderer;
  }

  update(dt) {
    // Stub
  }

  render() {
    // Stub: minimal score display
    const ctx = this.renderer.ctx;
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Score: ${this.game.score}`, 10, 10);
    ctx.fillText(`Moves: ${this.game.moves}`, 10, 30);

    const mins = Math.floor(this.game.timer / 60);
    const secs = Math.floor(this.game.timer % 60);
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    ctx.textAlign = 'right';
    ctx.fillText(timeStr, this.renderer.logicalWidth - 10, 10);
  }

  handleClick(x, y) {
    return false;
  }
}
