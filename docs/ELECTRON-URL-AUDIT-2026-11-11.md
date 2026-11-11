# Electron URL boundary audit - 11 November 2026

Baseline PR #12: 74ddcf3aacc9168c95c0bfd94c91f9e78e8c3a0b.

The newly buildable wrapper inherited a renderer-to-OS boundary defect. will-navigate passed any external-origin URL into shell.openExternal, including file: and installed custom OS protocols. The popup handler allowed non-HTTPS windows. Malformed navigation URLs also escaped as an uncaught URL exception.

The corrected handlers allow only ordinary HTTPS, HTTP and mailto external links; refuse local files, custom protocols, data/javascript and malformed URLs; deny every new renderer window; preserve same-origin navigation in the existing window. BrowserWindow sandbox, context isolation and disabled Node integration remain unchanged.

A hermetic Node VM loads the actual electron/main.cjs with stubbed Electron window/shell boundaries. It never launches an OS handler, renderer, provider or customer session. Original source: 5 tests passed, 10 failed. Corrected source: 15 passed, zero failed/skipped. Node 24.16.0; node --check and git diff --check passed. The boundary suite runs first in the normal test command and also via node --test electron/main.test.cjs.

This validates handler decisions, not a signed package, native renderer, installer or live production URL. No Electron dependency installation, packaging, release, signing or publication was performed. Existing project release/configuration prerequisites remain open.
