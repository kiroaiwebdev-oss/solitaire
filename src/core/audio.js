/**
 * Web Audio API synthesizer with gesture-gated AudioContext.
 * All sounds are programmatically generated - no external audio files.
 */

export class Audio {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.muted = false;
    this.volume = 0.5;
  }

  /** Must be called from a user gesture event handler */
  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio not available:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.muted = muted;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  _getGain(vol = 1) {
    if (!this.ctx || this.muted) return null;
    const gain = this.ctx.createGain();
    gain.gain.value = this.volume * vol;
    gain.connect(this.ctx.destination);
    return gain;
  }

  play(soundName) {
    if (!this.initialized || this.muted) return;
    this.resume();
    switch (soundName) {
      case 'cardFlip': this._playCardFlip(); break;
      case 'cardPlace': this._playCardPlace(); break;
      case 'cardShuffle': this._playCardShuffle(); break;
      case 'win': this._playWin(); break;
      case 'buttonClick': this._playButtonClick(); break;
      case 'undo': this._playUndo(); break;
      case 'error': this._playError(); break;
    }
  }

  _playCardFlip() {
    const ctx = this.ctx;
    const gain = this._getGain(0.3);
    if (!gain) return;
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.start(ctx.currentTime);
  }

  _playCardPlace() {
    const ctx = this.ctx;
    const gain = this._getGain(0.4);
    if (!gain) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.4 * this.volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  }

  _playCardShuffle() {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => this._playCardFlip(), i * 40);
    }
  }

  _playWin() {
    const ctx = this.ctx;
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const gain = this._getGain(0.3);
      if (!gain) return;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const time = ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.3 * this.volume, time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);
      osc.connect(gain);
      osc.start(time);
      osc.stop(time + 0.4);
    });
  }

  _playButtonClick() {
    const ctx = this.ctx;
    const gain = this._getGain(0.2);
    if (!gain) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.2 * this.volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    osc.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  }

  _playUndo() {
    const ctx = this.ctx;
    const gain = this._getGain(0.2);
    if (!gain) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2 * this.volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  }

  _playError() {
    const ctx = this.ctx;
    const gain = this._getGain(0.2);
    if (!gain) return;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 100;
    gain.gain.setValueAtTime(0.2 * this.volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  }

  destroy() {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
  }
}
