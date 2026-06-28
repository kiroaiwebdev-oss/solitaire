/**
 * SDK utility functions for platform adapters.
 */

/**
 * Poll for a global variable on window.
 * @param {string} name - Global variable name (e.g. 'CrazyGames')
 * @param {number} timeout - Max wait time in ms (default 5000)
 * @returns {Promise<any>} Resolves with the global value
 */
export function waitForGlobal(name, timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (window[name]) {
      resolve(window[name]);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      if (window[name]) {
        clearInterval(interval);
        resolve(window[name]);
      } else if (Date.now() - start >= timeout) {
        clearInterval(interval);
        reject(new Error(`Timed out waiting for window.${name}`));
      }
    }, 100);
  });
}

/**
 * Wrap a function call in try-catch, returning null on error.
 * @param {Function} fn - Function to call
 * @returns {any|null} Result or null on error
 */
export function safe(fn) {
  try {
    const result = fn();
    if (result && typeof result.catch === 'function') {
      return result.catch(() => null);
    }
    return result;
  } catch (e) {
    return null;
  }
}

/**
 * Suspend or resume an AudioContext based on muted state.
 * @param {AudioContext} audioCtx - The audio context to control
 * @param {boolean} muted - Whether audio should be muted
 */
export function audioMuteHelper(audioCtx, muted) {
  if (!audioCtx) return;
  try {
    if (muted) {
      audioCtx.suspend();
    } else {
      audioCtx.resume();
    }
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Show a fallback ad overlay with countdown when ads are blocked.
 * @param {number} duration - Countdown duration in seconds (default 5)
 * @returns {Promise<void>} Resolves when countdown completes
 */
export function fallbackAdOverlay(duration = 5) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.id = 'ad-fallback-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.85); display: flex; align-items: center;
      justify-content: center; z-index: 99999; flex-direction: column;
      color: #fff; font-family: sans-serif; font-size: 24px;
    `;

    let remaining = duration;
    const text = document.createElement('div');
    text.textContent = `Continue in ${remaining} seconds`;
    overlay.appendChild(text);
    document.body.appendChild(overlay);

    const timer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(timer);
        overlay.remove();
        resolve();
      } else {
        text.textContent = `Continue in ${remaining} seconds`;
      }
    }, 1000);
  });
}
