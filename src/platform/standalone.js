/**
 * Standalone adapter for direct hosting / itch.io / local development.
 */

import { PlatformAdapter } from './adapter.js';

export class StandaloneAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.name = 'standalone';
  }

  async init() {
    this.initialized = true;
    console.log('[Platform] Standalone mode');
  }
}
