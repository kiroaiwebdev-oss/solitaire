# Premium Solitaire - Deployment Guide

## Overview

Premium Solitaire is a Canvas-based Klondike Solitaire game with PWA support.
All assets are programmatically generated - no external dependencies, CDNs, or npm packages.

## Build

```bash
NODE_OPTIONS="" node tools/build.mjs
```

This generates `dist/` with 5 platform builds:
- `dist/standalone/` - Direct hosting, itch.io, GitHub Pages
- `dist/crazygames/` - CrazyGames portal (SDK v3 injected)
- `dist/gamedistribution/` - GameDistribution portal (SDK injected)
- `dist/y8/` - Y8 portal (SDK injected)
- `dist/playhop/` - PlayHop/Playgama portal (SDK injected)

Each platform directory also has a corresponding `.zip` file for portal uploads.

## GitHub Pages Deployment

1. Build using the command above
2. Copy `dist/standalone/` contents to your GitHub Pages branch (or `docs/` folder)
3. All paths are relative - works in any subdirectory

The standalone build includes:
- PWA manifest (`manifest.json`)
- Service worker (`sw.js`) for offline caching
- All game files with no external dependencies

## Portal Deployment

1. Build using the command above
2. Upload the appropriate `dist/<platform>.zip` to the portal
3. The SDK script tags are automatically injected into index.html
4. Platform detection sets `window.__PLATFORM__` for adapter selection

## PWA Features

- Offline play via service worker cache
- Add to home screen support
- Standalone display mode
- Responsive design (320px phones to 3440px ultrawide)
- Safe area inset support for notched devices

## Technical Notes

- All rendering via Canvas 2D API (no DOM-based UI elements)
- Audio synthesized via Web Audio API (no audio files)
- Card themes rendered programmatically (no image assets)
- localStorage for game saves, settings, and progression
- ES modules with no transpilation or bundling needed
- Node.js v22 stdlib only for build tooling

## Testing

```bash
NODE_OPTIONS="" node tests/selftest.mjs
NODE_OPTIONS="" node tests/domtest.mjs
NODE_OPTIONS="" node tests/sdk-probes.mjs
```

## File Structure

```
index.html          - Minimal HTML shell with canvas
styles.css          - CSS custom properties and responsive breakpoints
manifest.json       - PWA web app manifest
sw.js              - Service worker for offline caching
src/main.js        - App boot and game loop
src/core/          - Engine modules (loop, input, math, render, audio)
src/game/          - Game logic (cards, tableau, foundation, stock, drag)
src/systems/       - Persistence (save, progression, daily, achievements)
src/ui/            - UI layer (hud, screens, particles, animations)
src/platform/      - Portal SDK adapters
src/config/        - Configuration (scoring, themes, achievements, seeds)
tools/build.mjs    - Build script (Node.js stdlib only)
tests/             - Test suites
```
