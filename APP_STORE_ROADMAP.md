# App Store Roadmap — Sovereign Sanctuary Systems

**Version:** 1.0
**Date:** 13 March 2026
**Architecture:** One Codebase, Three Delivery Channels

---

## Current State

| Channel | Status | Technology | Notes |
|---------|--------|------------|-------|
| Web App | LIVE | React 19 + Tailwind 4 + tRPC + Express | Manus-hosted, Stripe integrated |
| PWA | READY | manifest.json + Service Worker | Installable from browser on all platforms |
| Desktop | **BUILDS (Linux verified)** | Electron 44 + electron-builder 26 | See "Desktop build status" below |
| iOS | ROADMAP | Capacitor (Phase 2) | Wraps existing React app |
| Android | ROADMAP | Capacitor (Phase 2) | Wraps existing React app |

---

### Desktop build status — verified 29 September 2026

The table above previously read `SCAFFOLDED`, which was accurate: the wrapper existed but
could not be built or launched. Four separate gaps, all now closed:

1. `electron` and `electron-builder` were in neither `package.json` nor the lockfile.
2. `package.json` had **no `main` field**, so electron-builder had no entry point.
3. None of the five `electron:*` scripts that `electron-builder.yml` documents existed.
4. **Root cause of the silent failure:** pnpm 10 blocks postinstall scripts by default, so
   Electron never downloaded its platform binary. Fixed persistently with
   `pnpm.onlyBuiltDependencies`, so a fresh clone builds without manual approval.

**Evidence, from an actual run rather than inspection:**

| Check | Result |
|---|---|
| `pnpm run build` (web) | exit 0 — `dist/public` + `dist/index.js` |
| Launch check, headless via `xvfb-run` | app ready, `browser-window-created`, 1 window titled "Sovereign Sanctuary Systems", exit 0 |
| `electron-builder --linux --publish never` | `Sovereign Sanctuary Systems-1.0.0.AppImage` (179 MB) + `linux-unpacked/` |

**Electron version.** This document specified Electron 33. The build uses **44**, the current
stable line. A customer-facing desktop shell on a superseded Electron carries the browser
engine's unpatched vulnerabilities, so the newer line was taken deliberately; it is recorded
here rather than changed silently.

**Not verified here:** Windows and macOS targets were not built — those need their own
platform or a signing toolchain, and macOS additionally needs an Apple Developer identity.
Nothing was published; `--publish never` was passed explicitly, although
`electron-builder.yml` is configured to publish GitHub releases.

---

## Phase 1: Immediate (Current Build)

### Web App (COMPLETE)
- React 19 + Tailwind CSS 4 + shadcn/ui
- tRPC 11 + Express 4 backend
- Manus OAuth authentication
- Stripe payment processing (10 products)
- 8 pages: Home, Services, AI Audit, Packs, Team, About, Contact, Book
- ND-friendly design: high contrast, progressive disclosure, 16px body text

### PWA (COMPLETE)
- `manifest.json` with app metadata and icons
- Service Worker with offline caching (cache-first strategy)
- Apple mobile web app meta tags
- Installable via "Add to Home Screen" on iOS/Android/Desktop

**To install now:** Visit the website in Chrome/Safari → Menu → "Add to Home Screen" or "Install App"

### Desktop App — Electron (SCAFFOLDED)
- `electron/main.cjs` — Main process with window management
- `electron/preload.cjs` — Secure context bridge for IPC
- `electron-builder.yml` — Build config for Windows (NSIS), macOS (DMG), Linux (AppImage)
- `electron/entitlements.mac.plist` — macOS code signing entitlements

**To build locally:**
```bash
# Install Electron dependencies
pnpm add -D electron electron-builder

# Build the web app first
pnpm build

# Package for current platform
npx electron-builder --dir

# Package for all platforms
npx electron-builder --win --mac --linux
```

**Output locations:**
- Windows: `release/Sovereign Sanctuary Systems Setup.exe`
- macOS: `release/Sovereign Sanctuary Systems.dmg`
- Linux: `release/Sovereign Sanctuary Systems.AppImage`

---

## Phase 2: Mobile App Stores (Q2 2026)

### Technology: Capacitor

Capacitor wraps the existing React web app in a native container. No rewrite needed.

**Setup steps:**
```bash
# Install Capacitor
pnpm add @capacitor/core @capacitor/cli
pnpm add -D @capacitor/ios @capacitor/android

# Initialize
npx cap init "Sovereign Sanctuary" "com.sovereignsanctuary.app"

# Add platforms
npx cap add ios
npx cap add android

# Build web app and sync
pnpm build
npx cap sync

# Open in native IDE
npx cap open ios     # Opens Xcode
npx cap open android # Opens Android Studio
```

### iOS App Store

| Requirement | Status | Action |
|-------------|--------|--------|
| Apple Developer Account ($99/yr) | NEEDED | Register at developer.apple.com |
| Xcode on macOS | NEEDED | Required for iOS builds |
| App Store Connect | NEEDED | Create app listing |
| App Review Guidelines compliance | READY | Our app is a business tool, no restricted content |
| Privacy Policy URL | READY | Add /privacy page to website |
| App Icons (1024x1024) | NEEDED | Generate from logo |
| Screenshots (6.7", 6.5", 5.5") | NEEDED | Capture from simulator |

**Timeline:** 2-3 weeks from Apple Developer enrollment to App Store listing

### Google Play Store

| Requirement | Status | Action |
|-------------|--------|--------|
| Google Play Developer Account ($25 one-time) | NEEDED | Register at play.google.com/console |
| Android Studio | NEEDED | Required for Android builds |
| Play Console listing | NEEDED | Create app listing |
| Content Rating | READY | Business category, no restricted content |
| Privacy Policy URL | READY | Add /privacy page to website |
| App Icons (512x512) | NEEDED | Generate from logo |
| Feature Graphic (1024x500) | NEEDED | Design banner |

**Timeline:** 1-2 weeks from enrollment to Play Store listing

---

## Phase 3: Desktop App Stores (Q3 2026)

### Microsoft Store (Windows)

| Requirement | Status | Action |
|-------------|--------|--------|
| Microsoft Partner Center account | NEEDED | Register at partner.microsoft.com |
| MSIX package | SCAFFOLDED | electron-builder can output MSIX |
| Code signing certificate | NEEDED | Purchase or use self-signed for testing |
| Store listing | NEEDED | Create in Partner Center |

**electron-builder.yml addition for MSIX:**
```yaml
win:
  target:
    - target: appx
      arch: [x64, arm64]
```

### Mac App Store

| Requirement | Status | Action |
|-------------|--------|--------|
| Apple Developer Account | SHARED | Same as iOS ($99/yr covers both) |
| Mac App Store provisioning profile | NEEDED | Create in Apple Developer portal |
| Entitlements | READY | `electron/entitlements.mac.plist` already created |
| Sandbox compliance | READY | Electron app uses web content only |

**electron-builder.yml addition for MAS:**
```yaml
mac:
  target:
    - target: mas
      arch: [x64, arm64]
```

### Linux App Stores

| Store | Format | Status |
|-------|--------|--------|
| Snap Store | .snap | electron-builder supports snap target |
| Flathub | .flatpak | Requires flatpak-builder manifest |
| AppImage | .AppImage | READY — already configured |

---

## Phase 4: Auto-Update Infrastructure (Q3 2026)

### Electron Auto-Update

The `electron/main.cjs` already includes `electron-updater` integration. To activate:

1. **GitHub Releases** (simplest):
   - Push tagged releases to GitHub
   - electron-updater checks for new versions automatically
   - Users get update notifications in-app

2. **Self-hosted** (sovereign):
   - Host update files on your own S3/server
   - Configure `publish` in electron-builder.yml:
   ```yaml
   publish:
     provider: generic
     url: https://updates.sovereignsanctuarysystems.co.uk
   ```

### PWA Auto-Update

Already handled by the Service Worker. When new content is deployed:
1. SW detects cache mismatch
2. Downloads new assets in background
3. Activates on next visit

---

## Architecture: One Codebase, Three Channels

```
sovereign-public-face/
├── client/                 ← Shared React UI (Web + PWA + Electron + Capacitor)
│   ├── src/
│   │   ├── pages/          ← All page components
│   │   ├── components/     ← Shared UI components
│   │   └── App.tsx         ← Router (works in all channels)
│   ├── public/
│   │   ├── manifest.json   ← PWA manifest
│   │   └── sw.js           ← Service Worker
│   └── index.html          ← Entry point
├── server/                 ← Backend (Web only, Capacitor/Electron connect via API)
│   ├── routers.ts          ← tRPC procedures
│   ├── products.ts         ← Stripe product catalog
│   └── stripe-webhook.ts   ← Payment webhook handler
├── electron/               ← Desktop wrapper
│   ├── main.cjs            ← Electron main process
│   ├── preload.cjs         ← Context bridge
│   └── entitlements.mac.plist
├── ios/                    ← (Phase 2) Capacitor iOS project
├── android/                ← (Phase 2) Capacitor Android project
├── electron-builder.yml    ← Desktop build config
└── capacitor.config.ts     ← (Phase 2) Mobile build config
```

**Key principle:** The React client is the single source of truth. Every delivery channel wraps the same UI. Backend stays on the server — mobile/desktop apps connect to the same API endpoint.

---

## Cost Summary

| Item | Cost | Frequency |
|------|------|-----------|
| Apple Developer Account | $99 | Annual |
| Google Play Developer | $25 | One-time |
| Microsoft Partner Center | Free | — |
| Code Signing Certificate (Windows) | ~$70-200 | Annual |
| Hosting (Manus) | Included | — |
| **Total Year 1** | **~$194-324** | — |

---

## Human Action Items (ALARP)

| Action | Priority | Est. Time | Dependency |
|--------|----------|-----------|------------|
| Register Apple Developer Account | HIGH | 30 min | Credit card, Apple ID |
| Register Google Play Developer | HIGH | 15 min | Credit card, Google account |
| Generate app icons (1024x1024, 512x512) | MEDIUM | 1 hour | Logo source file |
| Capture app screenshots for stores | MEDIUM | 1 hour | Running app |
| Create Privacy Policy page | MEDIUM | 30 min | None |
| Purchase Windows code signing cert | LOW | 30 min | Credit card |
| Set up auto-update server | LOW | 2 hours | S3 or hosting |

---

**Document Status:** COMPLETE
**Next Review:** After Phase 2 mobile deployment
