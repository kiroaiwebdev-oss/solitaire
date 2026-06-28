/**
 * Platform adapter registry and auto-detection.
 * Detection order: ?platform= URL param > window.__PLATFORM__ > global SDK detection > standalone fallback
 */

import { StandaloneAdapter } from './standalone.js';
import { CrazyGamesAdapter } from './crazygames.js';
import { GameDistributionAdapter } from './gamedistribution.js';
import { Y8Adapter } from './y8.js';
import { PlayHopAdapter } from './playhop.js';

const adapters = {
  standalone: StandaloneAdapter,
  crazygames: CrazyGamesAdapter,
  gamedistribution: GameDistributionAdapter,
  y8: Y8Adapter,
  playhop: PlayHopAdapter
};

/**
 * Detect platform from global SDK presence.
 * @returns {string|null}
 */
function detectFromGlobals() {
  if (typeof window === 'undefined') return null;
  if (window.CrazyGames) return 'crazygames';
  if (window.gdsdk) return 'gamedistribution';
  if (window.ID) return 'y8';
  if (window.PlgBridge || window.Playgama) return 'playhop';
  return null;
}

/**
 * Detect and return the appropriate platform adapter.
 * @returns {import('./adapter.js').PlatformAdapter}
 */
export function getAdapter() {
  let platform = null;

  // 1. Check URL parameter
  if (typeof window !== 'undefined' && window.location) {
    try {
      const params = new URLSearchParams(window.location.search);
      platform = params.get('platform');
    } catch (e) {}
  }

  // 2. Check global override
  if (!platform && typeof window !== 'undefined') {
    platform = window.__PLATFORM__ || null;
  }

  // 3. Detect from SDK globals
  if (!platform) {
    platform = detectFromGlobals();
  }

  // 4. Default to standalone
  if (!platform) {
    platform = 'standalone';
  }

  const AdapterClass = adapters[platform] || StandaloneAdapter;
  return new AdapterClass();
}
