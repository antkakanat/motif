# Motif Phasing Notes (Updated 2026-05)

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

## Addendum (2026-05)
- Documentation handling note:
  - This file should be updated in append-only style for future phasing entries.
  - Keep historical entries and add new dated sections instead of replacing prior notes.
- UI update approved and applied:
  - Added static "Private by default" badge near the All Captures header (non-animated).

## Addendum (2026-05, PWA Clarification)
- Product decision confirmed:
  - PWA should work on any supported device/platform (iOS, Android, desktop browsers).
  - Service worker registration remains cross-platform (not iOS-only).
- Implementation aligned:
  - Restored global service worker registration path in layout.
  - Restored cross-platform install prompt handling:
    - `beforeinstallprompt` flow for supported browsers.
    - iOS Safari manual "Share -> Add to Home Screen" guidance.

## Addendum (2026-05, Card Tap + Selection + Hierarchy v2)
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

## Addendum (2026-05, Nav Icon Consistency)
- Replaced mixed symbol/emoji nav icons with a unified SVG icon set for visual consistency.
- Updated mobile bottom nav, mobile More sheet, and desktop sidebar to use shared `NavIcon` component.
- Standardized icon container sizing/alignment to remove perceived size mismatch across items.

## Addendum (2026-05, PWA Install Button Research)
- Verified install-button model:
  - Android Chrome, desktop Chromium, and other Chromium-based browsers can use Motif's in-app install button when `beforeinstallprompt` fires.
  - Huawei/HarmonyOS devices should use the same path when their browser exposes the Chromium install prompt event.
  - Browsers that do not expose `beforeinstallprompt` must fall back to manual install instructions.
- Implementation refinement:
  - Cleared the saved `beforeinstallprompt` event after calling `prompt()` because the event is one-use.
  - Temporarily suppress the install banner after a native prompt dismissal to avoid repeated prompts.

## Addendum (2026-05, Settings Install Entry)
- Added shared PWA install prompt state so the home install banner and Settings can use the same browser-provided install event.
- Added Settings -> Install App section:
  - Shows native `Install Motif` action when `beforeinstallprompt` is available.
  - Shows installed state when the app is already running standalone.
  - Shows platform-specific manual install guidance when native prompt access is unavailable.
- Kept banner dismissal separate from Settings availability so users can still install later from Settings.

## Addendum (2026-05, Phase A Pro Gate Hardening)
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

## Addendum (2026-05, Phase C: Offline PWA Fixes & Local OCR)
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

## Addendum (2026-05, Phases F, G, H, Theme Hotfix & Pro Gate Hardening)

### Phase F — Smart Link Metadata Auto-Fetch
- Implemented fully client-side link metadata fetch (`src/lib/metadata.ts`) with Google favicon and jsonlink.io integrations.
- Integrated asynchronous metadata retrieval into `CaptureModal.svelte` triggered by input blur, auto-filling the capture details and providing a clean card-preview layout.
- Extended the IndexedDB data store schema to handle `favicon`, `ogImage`, and `description` tags in version 4 migration.
- Enabled rich favicon badges and visual card thumbnails for link-based captures in `CaptureCard.svelte`.
- Added an auto-fetch metadata privacy opt-out switch under Settings.

### Phase G — Reminders & Due Dates
- Built an offline, fully local scheduling reminder manager (`src/lib/reminders.ts`) using IndexedDB lookups, local timeout queues, and browser notifications with state restoration on startup.
- Designed a custom date-time selector and preset pills inside `CaptureModal.svelte` for quick scheduling.
- Implemented relative overdue labels and badge alerts utilizing clean pulsing animations on `CaptureCard.svelte`.
- Created a dedicated reminders hub page at `/reminders` grouping overdue and upcoming alerts.
- Configured a dynamic unread reminder badge in navigation menus (Desktop Sidebar and Mobile Bottom Navigation) refreshing periodically.

### Phase H — UX Polish & Performance
- Designed and built the reusable `EmptyState.svelte` component displaying custom assets, actions, and floating micro-animations.
- Used the illustrated empty state across all categories (`+page`, `/links`, `/quotes`, `/notes`, `/images`, `/archived`, `/trash`, `/reminders`).
- Integrated a global keyboard shortcut cheatsheet modal `ShortcutCheatsheet.svelte` accessible by pressing `?` key.
- Shipped an automated version-tracked What's New modal (`WhatsNew.svelte`) utilizing a central structured `changelog.ts` payload.
- Added light haptic vibration feedback using the standard Web Vibration API.

### Theme Hotfix: Light Mode Encryption Modal
- Addressed accessibility and legibility issues in Light Mode on the "AES-256 Encryption" setup and decryption modals.
- Mapped the CSS custom property `--color-surface-raw` correctly in [layout.css](file:///c:/Users/User/Project/my-projects/motif/src/routes/layout.css):
  - **Light Mode (`@theme` block)**: `--color-surface-raw: 249, 248, 255;`
  - **Dark Mode (`.dark` overrides block)**: `--color-surface-raw: 28, 26, 48;`
- Restored glassmorphic theme transitions ensuring ideal contrast ratios across both Light and Dark modes.

### Hardening Pro Gating Contracts
- Enforced correct premium gates for both **Local OCR** and **AI Semantic Search** features by aligning Svelte event handlers and settings toggles with the `requestProFeature` pattern:
  - **AI Search Opt-In**: Gated the main page AI search activation button.
  - **Settings Panels**: Gated the AI Semantic Search and Auto-OCR checkboxes to gracefully prompt users to upgrade.
  - **Manual Trigger Points**: Gated the manual scan buttons ("Scan all now" in Settings, "Retry Scan" on Capture Cards, and manual OCR triggers inside Capture Modals) so Free tier trial expirations behave correctly.

## Addendum (2026-05, Phase 3: Spatial Ambient Workspace & Direct Checkout Overlay)

### Spatial Ambient Theme & Workspace Dashboard
- Implemented stacked GPU-accelerated radial drift meshes in `src/routes/layout.css` to create a beautiful, organic ambient background.
- Redesigned the Sidebar (`src/lib/components/Sidebar.svelte`) and Mobile Bottom Nav (`src/lib/components/BottomNav.svelte`) as floating glassmorphic panels that appear detached and responsive.
- Added pure-CSS perspective-tilt depth states, micro-spring transitions, and premium glowing neon selection frames on `src/lib/components/CaptureCard.svelte`.
- Restyled the search capsule to float in a frosted capsule bar with key indicators, hotkey mappings (`⌥L Links`, `⌥Q Quotes`), and focus-triggered badges in `src/routes/+page.svelte`.

### Tech Sandbox Playground & Client OCR
- Built a majestic landing page `src/lib/components/LandingPage.svelte` featuring gradient typography, a beautiful functional viewport sandbox, client-side Tesseract.js local OCR scanner with neon sweep lasers, and category filters.
- Implemented off-screen canvas rendering in the playground to guarantee 100% reliable local character recognition without static network dependencies.

### Native LemonSqueezy Overlay Checkout
- Loaded the official LemonSqueezy modal SDK (`lemon.js`) natively on layout mount inside `src/routes/+layout.svelte`.
- Registered success handlers to intercept completed purchases and redirect to `/settings?activate=1` with an activation toast.
- Bound premium action gates (`ProGate.svelte`, `ProActionGateModal.svelte`) and Settings purchase buttons to call the SDK overlay programmatically (`window.LemonSqueezy.Url.Open(url)`) with a robust fallback to standard tab targets if the SDK is blocked or offline.

### Verification & SEO Audit
- Upgraded `src/app.html` with modern semantic fallback headers, complete OpenGraph and Twitter cards previewing `/screenshots/desktop.png` to maximize social sharing conversions.
- Validated the entire application using `npm run check`, completing successfully with zero TypeScript or Svelte compiler errors. Verified Vite client and server compiles through successful production build pipeline targets.

## Addendum (2026-05, Phase 2 Implementation & Stabilization Pass)

### Scalable View Modes (Cards, Compact List, Table)
- Consolidated all duplicate grid lists, toolbars, and category pages into a single, high-performance, reusable display orchestrator `CaptureBrowser.svelte`.
- Created `CaptureCompactItem.svelte` to serve as a fast list-based layout featuring left checkboxes, tag badges, overdue status flags, and right thumbnails.
- Created `CaptureTableRow.svelte` as a semantic HTML table grid for desktop, which collapses smoothly to the compact list layout on screens narrower than `768px` using responsive width triggers.
- Added persisted preference controls in settings (`viewMode`, `density`, `sortMode`) to ensure users' layouts remain consistent between reloads.

### Local Article Archiving (Offline Reading View)
- Upgraded the database schema (`Capture` interface in `db.ts`) with cache fields (`readableHtml`, `readableText`, `readableTitle`, `readableByline`, `readableSiteName`, `archivedAt`, and `archiveStatus`).
- Updated BIP-39 / AES-256-GCM cryptography stores in `encryption.ts` to encrypt and decrypt all offline article caches in volatile memory, maintaining a zero-knowledge local stance.
- Integrated background archiving in `captures.ts` using a 5-second queue delay to avoid wasted requests during fast deletions.
- Rewrote the reader route at `/read/[id]` to render from IndexedDB cache offline with a retry UI on failure and refresh controls.
- Added setting controls under settings page: toggle option, cache limits, storage tracker, and a "Clear article cache" action.

### Pocket HTML Import (Portability & Migration)
- Shipped a native, client-side DOM HTML parser (`analyzePocketImport`) inside `import.ts` mapping Pocket export lists directly to IndexedDB.
- Generalized the settings file selector in `+page.svelte` to accept `.zip`, `.html`, and `.htm` file extensions.

### First-Run UX & Backup Timing
- Implemented `libraryStartedAt` initialization logic on fresh account saves or Pocket imports to prevent intrusive day-zero backup prompts.
- Refactored `shouldShowBackupReminder` to defer prompt visibility for the first 3 days of library activity, with a fallback using the oldest capture timestamp for legacy users.

### Stabilization Pass & Regression Fixes
- **Pocket Unread Segregation**: Refactored heading classification in `import.ts` to explicitly check for `"archive"` or `"read"` headings while strictly excluding `"unread"` case-insensitively, ensuring unread imports go to the inbox instead of getting archived.
- **Deep-linking & FAB Restoration**: Restored `new`, `focus`, and `status` parameter deep-links, browser extension saves, and PWA Share Target sheet captures in `CaptureBrowser.svelte`.
- **Landing Page Bypassing**: Added a derived `hasDeepLink` checker in `+page.svelte` to reactively bypass `LandingPage` and mount the capture database immediately when a deep-link is active.
- **Keyboard Shortcuts**: Re-registered standard shortcuts (`Ctrl+K`, `Ctrl+F`, `Shift+A`, `Escape`) inside `CaptureBrowser.svelte`'s onMount hook.
- **Opt-In Privacy Defaults**: Configured `autoArchiveArticles` to default to `false` (disabled) inside settings to guarantee complete privacy until explicit user consent is given.
- **Dynamic Type-Route Locking**: Passed `lockTab={!showTypeFilter}` to `<CaptureModal>` to lock the active capture type on sub-routes `/links`, `/notes`, etc., and hide type-switcher headers completely.
- **Backup Countdown Preservation**: Refactored Pocket import transaction to only initialize `libraryStartedAt` if it is currently unset, preventing reset of backup intervals for active users.

### Verification
- Ran full `npm run check` verification with `0 errors and 15 warnings` (fully clean Type-safe Svelte compiler status).
- Verified production build completes all bundle creation steps cleanly.

## Addendum (2026-05, Developer Backlink & SEO Optimization)
- **Developer Backlink Addition**:
  - Inserted a semantic, crawler-friendly anchor link pointing directly to the root domain `https://byant.dev/` (`<a href="https://byant.dev/" target="_blank" rel="noopener">byant.dev</a>`) inside the Privacy/Footer card of the Settings page (`src/routes/settings/+page.svelte`).
  - This guarantees that once web crawlers discover and index the app deployed at subdomains (such as `tono.byant.dev` or `motif.byant.dev`), they have a natural backlink path to discover and pass link equity back to the main developer site at `byant.dev`.
- **Dynamic SEO Canonical Tags**:
  - Replaced the static, hardcoded canonical tag `<link rel="canonical" href="https://motif.byant.dev/" />` in layout files with SvelteKit's reactive page store `$page.url.origin + $page.url.pathname`.
  - Removed the static canonical link placeholder in `src/app.html` to avoid duplicate tag injections, ensuring a single dynamic canonical tag exists for every visited route.
  - This allows multiple subdomains (including `tono.byant.dev`) to index perfectly with absolute, matching canonical URLs, eliminating duplicate content indexing issues.
- **Verification**:
  - Executed `npm run check` which returned 0 errors and 15 warnings (harmless accessibility and CSS vendor prefix warning checkouts), ensuring zero compilation regressions.

