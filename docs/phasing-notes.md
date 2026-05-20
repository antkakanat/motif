# Motif Phasing Notes (Updated 2026-05-14)

## Completed
- Archive model implemented as inbox-style behavior:
  - Archived captures are excluded from default active inbox view.
  - Dedicated Archived route/view exists for retrieval and restore.
- Status visibility improved on capture cards:
  - Unread shows blue dot.
  - Saved stays visually clean.
  - Archived shows muted "Archived" pill.
- Account pricing section updated to Lifetime Pro $29 with launch coupon copy.
- Changelog updated to include v1.1.0 and revised v1.0.0 items.
- Sidebar + mobile navigation redesign shipped:
  - Desktop grouped nav sections.
  - Mobile bottom nav with center FAB and More sheet.
- Install prompt UX added:
  - beforeinstallprompt deferred handling.
  - iOS Safari manual install instructions.
  - Banner appears after repeat visits.
- Manifest screenshots added for installability checks.
- Zero-data privacy statement restored in UI:
  - Settings Privacy section.
  - Desktop sidebar footer note.

## Verified / Adjusted in this pass
- "All Statuses" semantic mismatch fixed:
  - Added `Active (Unread + Saved)` as default filter.
  - `All Statuses` now truly includes archived captures.
- Theme Appearance icons restored from text placeholders:
  - Replaced `L / D / S` with visual icons.
- Sidebar icon readability improved:
  - Larger and responsive icon sizing.
- Mobile FAB reliability fixed:
  - FAB now uses explicit navigation action.
  - All Captures page now reacts to query params on navigation updates (not only first mount).
- Capture-type recognition improved without filters:
  - Added type pills (Link / Quote / Note / Image) on cards.

## In Progress / Next
- PWA production error: `non-precached-url :: [{"url":"/"}]`
  - Added SvelteKit PWA `kit.spa` + `adapterFallback: '/'` config to ensure fallback route is included in precache manifest.
  - Needs production deploy verification against `motif.byant.dev`.
- Remove garbled encoding artifacts in legacy comments/text where present.
- Decide changelog UX direction:
  - Option A: keep top 2-3 entries in-app and add "Read full changelog" link to byant.dev.
  - Option B: remove full in-app list and show only latest summary with external link.

## Recommended Upcoming Development
1. Add "Read full changelog" CTA in Settings and keep only latest 2 entries in app.
2. Add explicit archive onboarding hint ("Archived items move out of active inbox").
3. Add nav QA pass at 90%, 100%, 110%, 125% zoom on desktop.
4. Add PWA smoke test checklist:
   - `beforeinstallprompt` flow
   - iOS install instructions
   - service worker route fallback
   - offline reload
5. Add visual regression snapshots for card header/status/type indicators.

## Addendum (2026-05-14)
- Documentation handling note:
  - This file should be updated in append-only style for future phasing entries.
  - Keep historical entries and add new dated sections instead of replacing prior notes.
- UI update approved and applied:
  - Added static "Private by default" badge near the All Captures header (non-animated).

## Addendum (2026-05-14, PWA Clarification)
- Product decision confirmed:
  - PWA should work on any supported device/platform (iOS, Android, desktop browsers).
  - Service worker registration remains cross-platform (not iOS-only).
- Implementation aligned:
  - Restored global service worker registration path in layout.
  - Restored cross-platform install prompt handling:
    - `beforeinstallprompt` flow for supported browsers.
    - iOS Safari manual "Share -> Add to Home Screen" guidance.

## Addendum (2026-05-14, Card Tap + Selection + Hierarchy v2)
- Implemented strict two-mode capture interactions (`browse` / `selection`) via selection store transitions.
- Added long-press entry to selection mode with first-item selection, and preserved checkbox-based entry.
- Implemented defined Shift-click behavior:
  - First Shift-click with no anchor behaves as single-select and sets anchor.
  - Subsequent Shift-click applies range selection from anchor.
- Card behavior now mode-aware:
  - Browse mode: full-card open path is used.
  - Selection mode: card taps toggle selection only.
  - Card menu/actions are suppressed while in selection mode.
- Wired full-card open/edit routing across capture lists:
  - Link cards open reader route.
  - Quote/Note/Image cards open edit modal.
  - Card menu Edit is now connected on All Captures, type pages, collections, and archived views.
- Added edit-save flow in pages using modal initial data (title/content/source/tags/collection).
- Updated `All Captures` status label copy to `Inbox (Unread + Saved)`.
- Updated card hierarchy and status visibility:
  - Meta row -> title -> preview -> footer retained.
  - Saved status indicator removed for cleaner default cards.
  - Archived remains pill-based.
- Updated media preview behavior on cards:
  - Fixed-height container + `object-fit: cover` to avoid letterboxing.
- Updated backup reminder to slim inline strip with subtle action and dismiss.
- Selection bulk bar refinements:
  - Added active-mode spacer placeholder.
  - Kept independent bottom safe-area padding on mobile bar.
  - Avoided external safe-area double-stacking in mobile dock offset.
- Data enrichment improvements in capture store:
  - Capture persists first, then metadata enrichment runs in background.
  - Safe title auto-replacement only for default/url-like placeholders.
  - Added low-noise auto-tagging (title/description/domain token model) with:
    - per-capture dedup,
    - global frequency guard (`>= 5` captures),
    - domain-noise filtering,
    - preservation of existing user tags.
- OG metadata endpoint expanded to return description/site metadata to support enrichment quality.
- PWA install banner updated with 2-visit eligibility gate while keeping cross-platform behavior intact.

### Verification Notes
- `npm run check` passes with no TypeScript/Svelte errors.
- Production build compiles through Vite + PWA generation, but local adapter finalization fails on Windows symlink permission (`EPERM` at Vercel adapter step). This is environment-related and occurs after client/server build and service worker generation.

## Addendum (2026-05-14, Nav Icon Consistency)
- Replaced mixed symbol/emoji nav icons with a unified SVG icon set for visual consistency.
- Updated mobile bottom nav, mobile More sheet, and desktop sidebar to use shared `NavIcon` component.
- Standardized icon container sizing/alignment to remove perceived size mismatch across items.

## Addendum (2026-05-15, PWA Install Button Research)
- Verified install-button model:
  - Android Chrome, desktop Chromium, and other Chromium-based browsers can use Motif's in-app install button when `beforeinstallprompt` fires.
  - Huawei/HarmonyOS devices should use the same path when their browser exposes the Chromium install prompt event.
  - Browsers that do not expose `beforeinstallprompt` must fall back to manual install instructions.
- Implementation refinement:
  - Cleared the saved `beforeinstallprompt` event after calling `prompt()` because the event is one-use.
  - Temporarily suppress the install banner after a native prompt dismissal to avoid repeated prompts.

## Addendum (2026-05-15, Settings Install Entry)
- Added shared PWA install prompt state so the home install banner and Settings can use the same browser-provided install event.
- Added Settings -> Install App section:
  - Shows native `Install Motif` action when `beforeinstallprompt` is available.
  - Shows installed state when the app is already running standalone.
  - Shows platform-specific manual install guidance when native prompt access is unavailable.
- Kept banner dismissal separate from Settings availability so users can still install later from Settings.

## Addendum (2026-05-15, Phase A Pro Gate Hardening)
- Policy reminder for local docs workflow:
  - `docs/phasing-notes.md` is append-only.
  - Never delete/replace previous entries; only add dated sections below.
- Added a single shared action-gate contract for Pro features:
  - `const allowed = await requestProFeature(feature, label); if (!allowed) return;`
  - Applied to collections, export, import, and reading-view action entry points.
- Added force-free test mode support:
  - `localStorage.motif_force_free = "true"` now forces Free behavior even on localhost.
  - Added a dev-only `FORCE FREE` indicator pill in layout.
- Added dev-only i18n gate-key assertion:
  - Logs missing `pro.gate.feature.<feature>` keys at runtime in development.
- Added global shared Pro upgrade modal used by all action gates.
- Registry alignment:
  - Phase A registry is now: `collections`, `export`, `import`, `readingView`, `ocr`, `aiSearch`, `earlyAccess`.
  - Removed `bulkActions` from Pro registry.
- Reading view hardening:
  - Link open actions now request `readingView` access before navigation.
  - Read route asserts/uses feature availability before fetching reader content.
- Bulk behavior alignment:
  - Bulk select/tag/delete remain Free.
  - Bulk move is gated only when assigning to a non-null collection.
  - Bulk export remains gated.
- Import flow hardening:
  - Gate checks run before opening import picker and again on import confirm.

## Addendum (2026-05-20, Phase C: Offline PWA Fixes & Local OCR)
- Resolved offline PWA precaching and route resolution failures:
  - Configured SvelteKit prerendering configurations and adapter fallback setup to correctly bundle root app shell paths.
  - Ensured Web App manifest link tags and service worker precaching include correct asset hashes so that local data (embeddings, OCR, encrypted data) survives seamlessly across sessions.
- Implemented fully local on-device OCR engine using `tesseract.js`:
  - Worker scripts and language model data are served from cached, highly available CDN paths.
  - Configured Vite and Svelte bundle configurations to allow dynamic loading of Web Workers without breaking strict offline constraints.
- Extended Dexie.js database schema for OCR data persistence:
  - Upgraded the `captures` table structure in the local IndexedDB to include `ocrText`, `ocrStatus` (`'pending'`, `'processing'`, `'done'`, `'failed'`, or `'skipped'`), and `ocrRanAt` properties.
  - Established a background orchestration loop to query, queue, and process unprocessed image captures.
- Shipped privacy-centric user preferences and stubs in Settings:
  - Integrated an opt-in toggle under the Privacy controls section to enable or disable automatic text extraction.
  - If auto-extract is toggled off, newly captured images default to `'skipped'` to respect user intent.
- Enhanced card layout components with progress and fallback states:
  - Designed clean dark glassmorphic progress overlays displaying active status updates during local analysis.
  - Embedded failure reporting with interactive "Retry Scan" triggers to re-run OCR on request.
- Added interactive OCR preview and manual adjustment capabilities inside Capture Modal:
  - Implemented an expandable text preview drawer inside the Edit modal to show extracted characters.
  - Supported real-time editing and manual correction of OCR-extracted text within a standard form field.
- Propagated modal bindings and parameter routing across category pages:
  - Aligned data routing pipelines inside list templates (+page, archived, collections, images, links, notes, quotes) to update, bind, and preserve OCR fields during CRUD operations.
- Checked system reliability and compilation:
  - Run verification tasks yielding zero TypeScript or Svelte template compilation errors.

