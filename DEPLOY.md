# Pipvale Solitaire - Deployment Guide

## Overview

Pipvale Solitaire is a Canvas-based Klondike Solitaire game with PWA support.
All assets are programmatically generated - no external dependencies, CDNs, npm
packages, web fonts, or analytics. The only external script that ever loads is
the portal SDK injected per build (and only on that portal's build).

## Build

```bash
NODE_OPTIONS="" node tools/build.mjs
```

This generates `dist/` with **7 platform builds**:

| Build | Directory / Zip | SDK injected (`<head>`) | Global | `window.__PLATFORM__` |
|-------|-----------------|-------------------------|--------|------------------------|
| Standalone | `dist/standalone/` | none | – | `standalone` |
| CrazyGames | `dist/crazygames/` | `https://sdk.crazygames.com/crazygames-sdk-v3.js` | `CrazyGames` | `crazygames` |
| GameDistribution | `dist/gamedistribution/` | `https://html5.api.gamedistribution.com/main.min.js` | `gdsdk` | `gamedistribution` |
| Y8 | `dist/y8/` | `https://cdn.y8.com/api/sdk.js` | `ID` | `y8` |
| PlayHop / Playgama | `dist/playhop/` | `https://cdn.playgama.com/sdk/bridge.js` | `PlgBridge` | `playhop` |
| **Poki** | `dist/poki/` | `https://game-cdn.poki.com/scripts/v2/poki-sdk.js` | `PokiSDK` | `poki` |
| **YouTube Playables** | `dist/youtube/` | `https://www.youtube.com/game_api/v1` | `ytgame` | `youtube` |

Each platform directory also has a corresponding `.zip` for portal uploads.
Each build is ~96 KB zipped — far under every portal's size limit (CrazyGames
50 MB desktop / 20 MB mobile, Playables limits, etc.).

## Verify

```bash
NODE_OPTIONS="" node tests/import-check.mjs
NODE_OPTIONS="" node tests/selftest.mjs
NODE_OPTIONS="" node tests/domtest.mjs
NODE_OPTIONS="" node tests/sdk-probes.mjs   # adapter + per-portal build validation
NODE_OPTIONS="" node tests/boot-test.mjs    # full headless boot + platform wiring
NODE_OPTIONS="" node tools/build.mjs        # expect "7/7 platforms"
```

---

## Per-Portal Submission

### CrazyGames (SDK v3)

- **Upload:** `dist/crazygames.zip`
- **SDK:** `crazygames-sdk-v3.js` (auto-injected; global `window.CrazyGames`, API under `window.CrazyGames.SDK`).
- **Wired calls:** `SDK.init()`, `SDK.game.sdkGameLoadingStart()/sdkGameLoadingFinished()`,
  `SDK.game.gameplayStart()/gameplayStop()`, `SDK.game.happytime()`,
  `SDK.ad.requestAd('midgame'|'rewarded', { adStarted, adFinished, adError })`,
  `SDK.ad.hasAdblock()` (awaited).
- **Compliance:** ads only at natural breaks (between games / mode-select), never
  during active gameplay; audio is muted while an ad plays and restored after;
  **rewarded grants only on `adFinished`**, never on `adError`; all calls are
  feature-detected and adblock-safe (a blocked/missing SDK never soft-locks).
- **Dashboard TODO:** create the game entry, set the thumbnail/branding, and
  (optionally) enable rewarded placements in the CrazyGames developer portal.

### Poki

- **Upload:** `dist/poki.zip`
- **SDK:** `poki-sdk.js` (auto-injected in `<head>`; global `window.PokiSDK`).
- **Wired calls:** `PokiSDK.init()`, `PokiSDK.setDebug(true)` **only on localhost**,
  `PokiSDK.gameLoadingStart()/gameLoadingFinished()` (wrap the loading screen —
  `gameLoadingFinished()` fires when the menu is ready), `PokiSDK.gameplayStart()`
  on round start / `gameplayStop()` on pause/end, `PokiSDK.commercialBreak()` at
  natural breaks **before** resuming gameplay (audio muted during, restored
  after), `PokiSDK.rewardedBreak()` for the optional free-hint reward
  (granted **only** when it resolves `true`; adblock/failure resolves `false`
  safely).
- **Full-canvas:** the canvas always fills the viewport (CSS `position:fixed;
  inset:0; 100dvh`, no scrollbars) so it covers Poki's 16:9 reference sizes
  (640×360 / 836×470 / 1031×580) with no letterbox gaps inside the iframe.
- **Dashboard TODO:** register the game in Poki Inspector, link this build URL,
  and validate loading/gameplay/ad events with the Poki QA tooling.

### YouTube Playables

- **Upload / host:** `dist/youtube.zip` (or its directory).
- **SDK:** `https://www.youtube.com/game_api/v1` — injected in `<head>`
  **ABOVE** the `src/main.js` module script (the SDK must load before any game
  code). Global `ytgame`.
- **Loading handshake (required):** `ytgame.game.firstFrameReady()` on the first
  rendered frame, then `ytgame.game.gameReady()` once initialization is done and
  the game can accept input. The game will not run on YouTube without this.
- **Pause/resume:** `ytgame.system.onPause(cb)` pauses + mutes; `onResume(cb)`
  resumes.
- **Audio:** `ytgame.system.isAudioEnabled()` + `onAudioEnabledChange(cb)` — the
  platform audio state takes priority over the in-game sound toggle.
- **Cloud save:** `ytgame.game.loadData()` / `saveData(string)`; mirrored into a
  synchronous store so the existing save system keeps working, and falls back to
  `localStorage` when `ytgame` is absent.
- **Score:** `ytgame.engagement.sendScore({ value })` on a win (guarded).
- **Health:** risky calls are wrapped and reported via `ytgame.health.logError`
  when available.
- **Compliance (critical):** the youtube build makes **no external network
  requests except the YT SDK itself** — the service worker is **not registered**
  on this platform (the inline registration is gated by
  `window.__PLATFORM__ === 'youtube'`), no other SDK is injected, and there are
  no external fonts/CDNs/analytics (system-ui fonts, generated audio, data-URI
  icons). Everything works fully offline/self-contained.
- **Dashboard TODO:** create the Playable in the YouTube Playables console,
  upload/point to this build, and configure store/score metadata there.

---

## GitHub Pages Deployment

1. Build using the command above.
2. Copy `dist/standalone/` contents to your GitHub Pages branch (or `docs/`).
3. All paths are relative — works in any subdirectory.

The standalone build includes the PWA manifest, the service worker (offline
caching), and all game files with no external dependencies.

## Optional Rewarded Reward

A non-required rewarded-ad hook lets the player unlock a free hint:
`App._offerRewardedHint()` (bound to the `R` key during play). It uses
`rewardedBreak()` / rewarded ads, grants the reward only on completion, shows a
visible toast + hint highlight, and is fully adblock-safe (declining or a
blocked ad simply shows an "unavailable" toast — it never blocks play).

## PWA Features

- Offline play via service worker cache (all platforms **except** youtube).
- Add to home screen, standalone display mode.
- Responsive design (320px phones to ultrawide), safe-area inset support.

## Technical Notes

- All rendering via Canvas 2D API (no DOM-based UI elements).
- Audio synthesized via Web Audio API (no audio files).
- Card themes rendered programmatically (no image assets).
- localStorage (and cloud save on YouTube) for saves/settings/progression.
- ES modules with no transpilation or bundling needed.
- Node.js v22 stdlib only for build tooling.
- Tab-hidden / window-blur auto-pauses + mutes; focus resumes without a delta-
  time spike (the loop clamps `dt` to 50 ms).

## File Structure

```
index.html          - Minimal HTML shell with canvas (platform-gated SW registration)
styles.css          - CSS custom properties, full-viewport canvas, responsive breakpoints
manifest.json       - PWA web app manifest
sw.js               - Service worker for offline caching (same-origin only)
src/main.js         - App boot, game loop, platform handshake wiring
src/core/           - Engine modules (loop, input, math, render, audio)
src/game/           - Game logic (cards, tableau, foundation, stock, drag)
src/systems/        - Persistence (save, progression, daily, achievements)
src/ui/             - UI layer (hud, screens, particles, animations)
src/platform/       - Portal SDK adapters:
                        adapter.js (base) · index.js (registry+detection)
                        standalone · crazygames · gamedistribution · y8 · playhop
                        poki · youtube (Playables) · sdkUtil
src/config/         - Configuration (scoring, themes, achievements, seeds)
tools/build.mjs     - Build script (Node.js stdlib only), 7 platforms
tests/              - Test suites (import-check, selftest, domtest, sdk-probes, boot-test)
```
