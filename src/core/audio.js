/**
 * Premium Web Audio API synthesizer with gesture-gated AudioContext.
 * All sounds are programmatically generated - no external audio files.
 * Features: 15+ distinct sounds, separate SFX/music volume, ambient lo-fi
 * music generation, haptic feedback.
 */

export class Audio {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.muted = false;
    this.sfxVolume = 0.5;
    this.musicVolume = 0.3;
    this.masterVolume = 1.0;

    // Ambient music state
    this._ambientPlaying = false;
    this._ambientNodes = [];
    this._ambientGain = null;
    this._ambientInterval = null;
  }

  /** Must be called from a user gesture event handler */
  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._ambientGain = this.ctx.createGain();
      this._ambientGain.gain.value = this.musicVolume * this.masterVolume;
      this._ambientGain.connect(this.ctx.destination);
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
    if (this._ambientGain) {
      this._ambientGain.gain.value = muted ? 0 : this.musicVolume * this.masterVolume;
    }
  }

  setSfxVolume(vol) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
  }

  setMusicVolume(vol) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    if (this._ambientGain) {
      this._ambientGain.gain.value = this.muted ? 0 : this.musicVolume * this.masterVolume;
    }
  }

  setVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }

  _getGain(vol = 1) {
    if (!this.ctx || this.muted) return null;
    const gain = this.ctx.createGain();
    gain.gain.value = this.sfxVolume * this.masterVolume * vol;
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
      case 'buttonClick': this._playButtonClick(); break;
      case 'error': this._playError(); break;
      case 'undo': this._playUndo(); break;
      case 'redo': this._playRedo(); break;
      case 'hint': this._playHint(); break;
      case 'win': this._playWin(); break;
      case 'achievementUnlock': this._playAchievementUnlock(); break;
      case 'levelUp': this._playLevelUp(); break;
      case 'streakBonus': this._playStreakBonus(); break;
      case 'confettiPop': this._playConfettiPop(); break;
      case 'autoComplete': this._playAutoComplete(); break;
      case 'ambientPad': this._playAmbientPad(); break;
    }
  }

  // --- Haptic Feedback ---
  _haptic(pattern) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) { /* ignore */ }
    }
  }

  // --- Sound Implementations ---

  _playCardFlip() {
    const ctx = this.ctx;
    const gain = this._getGain(0.3);
    if (!gain) return;
    // Short noise burst with high-pass filter for crisp snap
    const bufferSize = Math.floor(ctx.sampleRate * 0.04);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.pow(1 - i / bufferSize, 3);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    source.connect(filter);
    filter.connect(gain);
    source.start(ctx.currentTime);
    this._haptic(10);
  }

  _playCardPlace() {
    const ctx = this.ctx;
    const gain = this._getGain(0.4);
    if (!gain) return;
    // Low thump + slight resonance
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.4 * this.sfxVolume * this.masterVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
    this._haptic(15);
  }

  _playCardShuffle() {
    const ctx = this.ctx;
    // Cascade of rapid noise bursts
    for (let i = 0; i < 7; i++) {
      const delay = i * 0.03;
      const gain = this._getGain(0.15);
      if (!gain) return;
      const bufSize = Math.floor(ctx.sampleRate * 0.025);
      const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let j = 0; j < bufSize; j++) {
        data[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / bufSize, 2);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 3000 + i * 200;
      filter.Q.value = 0.5;
      source.connect(filter);
      filter.connect(gain);
      gain.gain.setValueAtTime(0.15 * this.sfxVolume * this.masterVolume, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.025);
      source.start(ctx.currentTime + delay);
    }
    this._haptic([10, 20, 10, 20, 10]);
  }

  _playButtonClick() {
    const ctx = this.ctx;
    const gain = this._getGain(0.25);
    if (!gain) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.03);
    gain.gain.setValueAtTime(0.25 * this.sfxVolume * this.masterVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);
    this._haptic(5);
  }

  _playError() {
    const ctx = this.ctx;
    const gain = this._getGain(0.25);
    if (!gain) return;
    // Two quick descending tones
    const osc1 = ctx.createOscillator();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(300, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2 * this.sfxVolume * this.masterVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc1.connect(gain);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.2);
    this._haptic([30, 50, 30]);
  }

  _playUndo() {
    const ctx = this.ctx;
    const gain = this._getGain(0.25);
    if (!gain) return;
    // Descending whoosh
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.25 * this.sfxVolume * this.masterVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  }

  _playRedo() {
    const ctx = this.ctx;
    const gain = this._getGain(0.25);
    if (!gain) return;
    // Ascending whoosh
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.25 * this.sfxVolume * this.masterVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  }

  _playHint() {
    const ctx = this.ctx;
    const gain = this._getGain(0.2);
    if (!gain) return;
    // Sparkle: two quick ascending notes
    const notes = [800, 1200];
    notes.forEach((freq, i) => {
      const time = ctx.currentTime + i * 0.08;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(0.2 * this.sfxVolume * this.masterVolume, time + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.15);
    });
  }

  _playWin() {
    const ctx = this.ctx;
    // Triumphant arpeggio: C5, E5, G5, C6 with sustain
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const time = ctx.currentTime + i * 0.12;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(0.35 * this.sfxVolume * this.masterVolume, time + 0.03);
      g.gain.setValueAtTime(0.3 * this.sfxVolume * this.masterVolume, time + 0.2);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.6);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.6);
    });
    // Final chord
    const chordTime = ctx.currentTime + 0.5;
    [523, 659, 784, 1047].forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, chordTime);
      g.gain.linearRampToValueAtTime(0.15 * this.sfxVolume * this.masterVolume, chordTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, chordTime + 1.5);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(chordTime);
      osc.stop(chordTime + 1.5);
    });
    this._haptic([50, 30, 50, 30, 100]);
  }

  _playAchievementUnlock() {
    const ctx = this.ctx;
    // Magical chime: ascending arpegio with reverb-like tail
    const notes = [880, 1108, 1318, 1760];
    notes.forEach((freq, i) => {
      const time = ctx.currentTime + i * 0.06;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(0.25 * this.sfxVolume * this.masterVolume, time + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.5);
    });
    this._haptic([20, 40, 20, 40, 60]);
  }

  _playLevelUp() {
    const ctx = this.ctx;
    // Ascending power-up sound
    const gain = this._getGain(0.3);
    if (!gain) return;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(4000, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3 * this.sfxVolume * this.masterVolume, ctx.currentTime);
    gain.gain.setValueAtTime(0.25 * this.sfxVolume * this.masterVolume, ctx.currentTime + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(filter);
    filter.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
    this._haptic([30, 30, 50]);
  }

  _playStreakBonus() {
    const ctx = this.ctx;
    // Quick double-note celebration
    const notes = [660, 880];
    notes.forEach((freq, i) => {
      const time = ctx.currentTime + i * 0.1;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(0.3 * this.sfxVolume * this.masterVolume, time + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.2);
    });
  }

  _playConfettiPop() {
    const ctx = this.ctx;
    const gain = this._getGain(0.3);
    if (!gain) return;
    // Short noise pop with pitch envelope
    const bufSize = Math.floor(ctx.sampleRate * 0.06);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      const t = i / bufSize;
      const env = t < 0.1 ? t / 0.1 : Math.pow(1 - (t - 0.1) / 0.9, 2);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 4000;
    filter.Q.value = 1;
    source.connect(filter);
    filter.connect(gain);
    source.start(ctx.currentTime);
  }

  _playAutoComplete() {
    const ctx = this.ctx;
    // Smooth cascading tone
    const gain = this._getGain(0.2);
    if (!gain) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.2 * this.sfxVolume * this.masterVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  }

  _playAmbientPad() {
    if (!this.ctx) return;
    // Single warm pad chord hit
    const ctx = this.ctx;
    const chordFreqs = [130.81, 164.81, 196, 261.63]; // C3, E3, G3, C4
    chordFreqs.forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.05 * this.musicVolume * this.masterVolume, ctx.currentTime + 0.5);
      g.gain.setValueAtTime(0.04 * this.musicVolume * this.masterVolume, ctx.currentTime + 2);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 4);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      osc.connect(filter);
      filter.connect(g);
      g.connect(this._ambientGain || ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 4);
    });
  }

  // --- Ambient Music ---

  startAmbientMusic() {
    if (!this.initialized || this._ambientPlaying) return;
    this._ambientPlaying = true;
    this._playAmbientLoop();
    this._ambientInterval = setInterval(() => {
      if (this._ambientPlaying && !this.muted) {
        this._playAmbientLoop();
      }
    }, 8000);
  }

  stopAmbientMusic() {
    this._ambientPlaying = false;
    if (this._ambientInterval) {
      clearInterval(this._ambientInterval);
      this._ambientInterval = null;
    }
  }

  _playAmbientLoop() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    // Lo-fi ambient pad with slow chord changes
    const chords = [
      [130.81, 164.81, 196, 261.63],   // Cmaj
      [110, 138.59, 164.81, 220],       // Amin
      [146.83, 174.61, 220, 293.66],    // Dmaj
      [98, 123.47, 146.83, 196]         // G
    ];
    const chord = chords[Math.floor(Math.random() * chords.length)];

    chord.forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq + (Math.random() - 0.5) * 2; // slight detune
      const g = ctx.createGain();
      const vol = 0.03 * this.musicVolume * this.masterVolume;
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 2);
      g.gain.setValueAtTime(vol, ctx.currentTime + 5);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 8);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600 + Math.random() * 200;
      osc.connect(filter);
      filter.connect(g);
      g.connect(this._ambientGain || ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 8.5);
    });
  }

  destroy() {
    this.stopAmbientMusic();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
    this._ambientGain = null;
  }
}
