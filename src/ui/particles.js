/**
 * Particle system for visual effects.
 * Types: sparkle, confetti, dust, firework, glow, ambient
 */

const PARTICLE_TYPES = {
  sparkle: { gravity: 0, fadeRate: 1.5, shrink: true, minSize: 2, maxSize: 5 },
  confetti: { gravity: 200, fadeRate: 0.6, shrink: false, minSize: 4, maxSize: 8 },
  dust: { gravity: -10, fadeRate: 3, shrink: true, minSize: 1, maxSize: 3 },
  firework: { gravity: 150, fadeRate: 0.8, shrink: true, minSize: 2, maxSize: 4 },
  glow: { gravity: 0, fadeRate: 0.5, shrink: false, minSize: 6, maxSize: 12 },
  ambient: { gravity: -5, fadeRate: 0.15, shrink: false, minSize: 1, maxSize: 2 }
};

const GOLD_COLORS = ['#d4af37', '#ffd700', '#ffed4a', '#f0c040', '#e6b800'];
const CONFETTI_COLORS = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff', '#ff8800', '#d4af37'];

class Particle {
  constructor(type, x, y, config = {}) {
    const typeDef = PARTICLE_TYPES[type] || PARTICLE_TYPES.sparkle;
    this.type = type;
    this.x = x;
    this.y = y;
    this.vx = config.vx || (Math.random() - 0.5) * 100;
    this.vy = config.vy || (Math.random() - 0.5) * 100;
    this.gravity = config.gravity !== undefined ? config.gravity : typeDef.gravity;
    this.life = 0;
    this.maxLife = config.maxLife || (1 + Math.random() * 1.5);
    this.color = config.color || GOLD_COLORS[Math.floor(Math.random() * GOLD_COLORS.length)];
    this.size = config.size || (typeDef.minSize + Math.random() * (typeDef.maxSize - typeDef.minSize));
    this.initialSize = this.size;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 8;
    this.alpha = 1;
    this.fadeRate = config.fadeRate || typeDef.fadeRate;
    this.shrink = typeDef.shrink;
    this.alive = true;
  }

  update(dt) {
    this.life += dt;
    if (this.life >= this.maxLife) {
      this.alive = false;
      return;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += this.gravity * dt;
    this.rotation += this.rotationSpeed * dt;

    const lifeRatio = this.life / this.maxLife;
    this.alpha = Math.max(0, 1 - lifeRatio * this.fadeRate);
    if (this.shrink) {
      this.size = this.initialSize * (1 - lifeRatio);
    }

    if (this.alpha <= 0 || this.size <= 0) {
      this.alive = false;
    }
  }
}

const EMITTER_CONFIGS = {
  foundationComplete: {
    type: 'sparkle',
    count: 20,
    spread: 60,
    speed: 120,
    colors: GOLD_COLORS,
    maxLife: 1.2
  },
  winCelebration: {
    type: 'confetti',
    count: 80,
    spread: 400,
    speed: 300,
    colors: CONFETTI_COLORS,
    maxLife: 3
  },
  cardDragDust: {
    type: 'dust',
    count: 3,
    spread: 10,
    speed: 20,
    colors: ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.2)'],
    maxLife: 0.4
  },
  ambientBackground: {
    type: 'ambient',
    count: 1,
    spread: 50,
    speed: 10,
    colors: ['rgba(212,175,55,0.15)', 'rgba(255,255,255,0.08)'],
    maxLife: 8
  },
  achievementUnlock: {
    type: 'firework',
    count: 30,
    spread: 100,
    speed: 200,
    colors: GOLD_COLORS,
    maxLife: 1.5
  },
  levelUp: {
    type: 'glow',
    count: 12,
    spread: 80,
    speed: 50,
    colors: ['#d4af37', '#ffffff', '#ffd700'],
    maxLife: 2
  }
};

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.maxParticles = 500;
  }

  emit(type, x, y, count, config = {}) {
    const emitterConfig = EMITTER_CONFIGS[type] || {};
    const particleType = config.type || emitterConfig.type || 'sparkle';
    const numParticles = count || emitterConfig.count || 10;
    const spread = config.spread || emitterConfig.spread || 50;
    const speed = config.speed || emitterConfig.speed || 100;
    const colors = config.colors || emitterConfig.colors || GOLD_COLORS;
    const maxLife = config.maxLife || emitterConfig.maxLife || 1.5;

    for (let i = 0; i < numParticles; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * spread * 0.3;
      const vel = speed * (0.3 + Math.random() * 0.7);

      const particle = new Particle(particleType, x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, {
        vx: Math.cos(angle) * vel,
        vy: Math.sin(angle) * vel - (particleType === 'confetti' ? 200 : 0),
        color: colors[Math.floor(Math.random() * colors.length)],
        maxLife: maxLife * (0.6 + Math.random() * 0.4),
        ...config
      });

      this.particles.push(particle);
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (!this.particles[i].alive) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(ctx) {
    ctx.save();
    for (const p of this.particles) {
      if (!p.alive || p.alpha <= 0) continue;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.type === 'confetti') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else if (p.type === 'glow') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = p.alpha * 0.3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  clear() {
    this.particles = [];
  }

  get count() {
    return this.particles.length;
  }
}
