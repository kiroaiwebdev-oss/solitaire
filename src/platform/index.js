/**
 * Platform adapter registry and detection.
 */

import { StandaloneAdapter } from './standalone.js';

/**
 * Detect and return the appropriate platform adapter.
 * @returns {import('./adapter.js').PlatformAdapter}
 */
export function getAdapter() {
  // Check URL parameter
  const params = new URLSearchParams(window.location.search);
  const platformParam = params.get('platform');

  // Check global override
  const platformGlobal = window.__PLATFORM__;

  const platform = platformParam || platformGlobal || 'standalone';

  // For now, only standalone is implemented
  switch (platform) {
    case 'standalone':
    default:
      return new StandaloneAdapter();
  }
}
