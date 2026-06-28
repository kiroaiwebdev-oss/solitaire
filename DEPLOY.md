# Deployment Guide - Klondike Solitaire

## Prerequisites

- Node.js v18+ (tested with v22)
- No external npm packages required

## Building

Run the build script from the project root:

```bash
node tools/build.mjs
```

This generates:
- `dist/<platform>/` - directory with all game files for each platform
- `dist/<platform>.zip` - zip file ready for upload (index.html at zip root)

Platforms built: standalone, crazygames, gamedistribution, y8, playhop

Each build:
- Injects the platform-specific SDK script into index.html
- Sets `window.__PLATFORM__` for adapter auto-detection
- Stamps a unique cache-busting build version

---

## Platform Deployment

### Standalone (itch.io / direct hosting)

**Upload:** Upload `dist/standalone.zip` to itch.io or extract `dist/standalone/` to any web server.

**Settings:**
- Set project type to "HTML" on itch.io
- Viewport dimensions: 800x600 minimum (responsive)
- Enable fullscreen button
- No external SDK required

**Testing:**
1. Open index.html locally in a browser
2. Verify game loads without console errors
3. Test save/load persistence (uses localStorage)
4. Confirm no network requests are required for gameplay

---

### CrazyGames

**SDK:** `https://sdk.crazygames.com/crazygames-sdk-v3.js`

**Upload:** Upload `dist/crazygames.zip` through the CrazyGames Developer Portal (https://developer.crazygames.com).

**Dashboard Settings:**
- Game type: HTML5
- Orientation: Both (landscape preferred)
- Category: Card / Puzzle

**SDK Integration Notes:**
- Interstitial ads: shown between games (midgame type)
- Rewarded ads: shown for hints/undos (rewarded type)
- `gameplayStart()` called when player starts a round
- `gameplayStop()` called when game ends or player pauses
- `happyTime()` called on win/achievement

**Ad Requirements:**
- Do not show ads more than once every 3 minutes
- Always call gameplayStart/Stop around ad breaks
- Handle adblock gracefully (fallback overlay shown)

**Testing:**
1. Use CrazyGames QA tool: https://developer.crazygames.com/qa
2. Add `?platform=crazygames` to test detection locally
3. Verify audio mutes during ad playback
4. Test with adblock enabled (fallback overlay should appear)

---

### GameDistribution

**SDK:** `https://html5.api.gamedistribution.com/main.min.js`

**Upload:** Upload `dist/gamedistribution.zip` through GameDistribution Developer Panel (https://developer.gamedistribution.com).

**Dashboard Settings:**
- Set your Game ID in the dashboard
- Category: Card Games
- Configure ad frequency (recommended: 120-180 second cooldown)

**SDK Integration Notes:**
- Preroll ad shown on first load
- Interstitial ads: `gdsdk.showAd('interstitial')`
- Rewarded ads: `gdsdk.showAd('rewarded')`
- Events: AD_STARTED (mute audio), AD_FINISHED/AD_ERROR (unmute)

**Ad Requirements:**
- Preroll ad must be shown before gameplay starts
- Do not overlap multiple ad requests
- Handle promise rejections from showAd()

**Testing:**
1. Use GD test tool or add `?platform=gamedistribution` locally
2. Verify preroll fires on page load
3. Test interstitial between rounds
4. Verify audio mutes/unmutes correctly around ads

---

### Y8

**SDK:** `https://cdn.y8.com/api/sdk.js`

**Upload:** Submit game through Y8 Developer Portal (https://account.y8.com/developers).

**Dashboard Settings:**
- Set App ID (provided by Y8)
- Category: Card Games
- Enable ads

**SDK Integration Notes:**
- `ID.init()` called with your App ID on load
- Ads shown via `ID.GameAPI.Ads.display()`
- Cloud save available via `ID.GameAPI.Achievements` (optional)
- Falls back to localStorage if Y8 API is unavailable

**Configuration:**
Set your Y8 App ID by adding before the SDK script:
```html
<script>window.__Y8_APP_ID__ = 'your-app-id-here';</script>
```

**Testing:**
1. Add `?platform=y8` to test detection locally
2. Verify fallback to localStorage when offline
3. Test ad display callback fires correctly
4. Check console for SDK initialization messages

---

### PlayHop / Playgama

**SDK:** `https://cdn.playgama.com/sdk/bridge.js`

**Upload:** Submit through PlayHop/Playgama Developer Dashboard.

**Dashboard Settings:**
- Game type: HTML5
- Category: Card / Casual
- Configure monetization settings

**SDK Integration Notes:**
- Bridge loaded as `window.PlgBridge` or `window.Playgama`
- Interstitial: `PlgBridge.advertisement.showInterstitial()`
- Rewarded: `PlgBridge.advertisement.showRewarded()`
- Game events: `PlgBridge.game.gameStart()` / `PlgBridge.game.gameOver()`

**Testing:**
1. Add `?platform=playhop` to test detection locally
2. Verify SDK detection works for both PlgBridge and Playgama globals
3. Test ad callbacks (onStart, onClose, onError, onRewarded)
4. Verify game state events fire correctly

---

## Testing Checklist (All Platforms)

For each platform build, verify:

- [ ] Game loads without JavaScript errors
- [ ] Cards render correctly on canvas
- [ ] Drag and drop works (pointer events)
- [ ] Game state saves and loads between sessions
- [ ] Audio plays correctly (Web Audio API)
- [ ] Audio mutes during ads
- [ ] Audio unmutes after ads complete
- [ ] Interstitial ads show (or fallback overlay)
- [ ] Rewarded ads complete and grant reward
- [ ] Platform detection works (`?platform=` param)
- [ ] Platform detection works (`window.__PLATFORM__`)
- [ ] Build version is stamped in meta tag
- [ ] Responsive layout works at different viewport sizes
- [ ] No external resource loading failures (all assets are generated)

## Troubleshooting

### Game does not load
- Check browser console for module import errors
- Verify all files are present in the zip (check file list in build output)
- Ensure the web server serves `.js` files with `application/javascript` MIME type
- Ensure the web server serves `.mjs` files with `application/javascript` MIME type

### SDK not detected
- The adapter checks for SDK globals with a timeout (5-8 seconds)
- If the SDK script fails to load (blocked, CDN down), the adapter falls back gracefully
- Force a platform with `?platform=<name>` URL parameter for testing

### Ads not showing
- Many platforms block ads in development/localhost
- Test on the platform's staging/QA environment
- When ads are blocked, a fallback overlay ("Continue in X seconds") appears
- Check `isAdblocked()` return value in console

### Audio issues during ads
- The adapter mutes audio by setting `_muted = true` before ad calls
- Game code should check `adapter.shouldMuteAudio()` each frame
- If audio context is suspended, it resumes after ad completes

### Save data not persisting
- localStorage is used as the default storage mechanism
- Some platforms (Y8) offer cloud saves but fall back to localStorage
- Check that the browser allows localStorage (private browsing may block it)
- Storage quota is typically 5-10MB per origin

### ZIP upload rejected
- Verify `index.html` is at the zip root (not in a subdirectory)
- Check zip file size (most platforms have a 50-200MB limit)
- Ensure no symlinks or special files in the zip
- Re-run `node tools/build.mjs` to regenerate

### Cache issues after update
- Each build stamps a unique version identifier
- The version is stored in a `<meta>` tag and `window.__BUILD_VERSION__`
- Platforms may cache aggressively - use the platform's cache purge if available

## Ad Integration Best Practices

1. **Timing:** Show interstitial ads between games, never during active gameplay
2. **Frequency:** Wait at least 60-180 seconds between ad calls (platform-dependent)
3. **Rewarded:** Only show rewarded ads when the player explicitly requests a benefit (undo, hint)
4. **Muting:** Always mute game audio during ads and unmute after
5. **Fallback:** Always handle ad failures gracefully (timeout, blocked, error)
6. **Events:** Call `gameplayStart()` when a round begins, `gameplayStop()` when it ends
7. **Happy moments:** Call `happyTime()` on wins, streaks, and achievements
