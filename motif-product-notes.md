# Motif — Complete Product Notes
> Last updated: May 2026  
> Author: Product planning session (byant.dev)

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Market Validation](#2-market-validation)
3. [Competitive Landscape](#3-competitive-landscape)
4. [App Identity](#4-app-identity)
5. [Color System](#5-color-system)
6. [Tech Stack](#6-tech-stack)
7. [Architecture Overview](#7-architecture-overview)
8. [Feature List](#8-feature-list)
9. [Data Schema](#9-data-schema)
10. [Free Tier Strategy](#10-free-tier-strategy)
11. [Pricing](#11-pricing)
12. [License Activation Flow](#12-license-activation-flow)
13. [Security Model](#13-security-model)
14. [Multilingual (i18n)](#14-multilingual-i18n)
15. [Deployment](#15-deployment)
16. [Build Roadmap](#16-build-roadmap)
17. [Monetization Summary](#17-monetization-summary)
18. [Open Items / Deferred Features](#18-open-items--deferred-features)

---

## 1. Problem Statement

People save things digitally — links, quotes, screenshots, notes — but have no reliable way to retrieve them later. At 30 saves it's manageable. At 200+ saves, searching through browser bookmarks, notes apps, camera roll screenshots, and copied text becomes genuinely painful.

**The core pain:**
- Saves are scattered across multiple apps (browser, notes, camera roll, messaging apps)
- No single searchable place for all capture types
- Cloud apps require accounts, subscriptions, and trust
- Privacy-conscious users don't want their saved content on someone else's server
- Existing local-first apps (Obsidian, Logseq) target power users and have steep learning curves

**Target user:** Someone who saves things constantly but is not technical — they just want to find what they saved, fast, privately, without paying monthly.

---

## 2. Market Validation

| Metric | Data |
|--------|------|
| Workforce reporting information overload stress | 76% |
| Global economic cost of information overload | ~$1 trillion/year |
| Daily data generated globally | 463 billion GB/day |
| Typical subscription tool cost | $10–20/month ($120–240/year) |
| User sentiment shift | Strong move toward local-first, privacy-first tools post-2023 |

**Why now:**
- Growing distrust of cloud platforms (data breaches, service shutdowns)
- Subscription fatigue — users actively seek one-time-payment tools
- PWA technology matured enough to deliver near-native experience
- Transformers.js enables on-device AI with no server — a genuine privacy differentiator

---

## 3. Competitive Landscape

| App | Local-first | Complexity | Price model | Gap |
|-----|-------------|------------|-------------|-----|
| Notion | ✗ Cloud only | High | Subscription | Not private, complex |
| Obsidian | ✓ | High (Markdown files, plugins) | Freemium | Power users only |
| Logseq | ✓ | High (outliner model) | Free/open | Steep learning curve |
| Anytype | ✓ (P2P) | Very high (object model) | Beta/unstable | Unstable, complex |
| Raindrop | ✗ Cloud | Medium | Freemium | Not local, links only |
| **Motif** | **✓** | **Low — zero setup** | **Lifetime** | **Owns the simple+private gap** |

**Motif's differentiation:** Everyone builds for power users. Motif is for the person who just wants to stop losing things — privately, offline, no setup required.

---

## 4. App Identity

### Name
**Motif**

In music, a motif is a short recurring theme that reappears throughout a composition — exactly what saved captures are: the recurring ideas, links, and quotes of your digital life.

### Domain
```
motif.byant.dev
```
- Subdomain of existing `byant.dev` domain — no new domain purchase needed
- `.dev` TLD enforces HTTPS at the registry level — a genuine trust signal for a privacy app
- Setup: one CNAME DNS record

### Tagline
> **"Capture every note."**

*"Note" is a double meaning — musical notes + taking notes. Tells you exactly what the app does.*

### Sub-tagline (hero section)
> "No cloud. No subscription. No noise. Just your links, quotes, notes, and images — private, offline, and always yours."

### Logo
**Concept: Ring Note**

A whole note (○) inside a circle, with a stem extending upward-right. References:
- A whole note in music notation
- A vinyl record / disc (audio culture)
- Scales cleanly to 16px favicon
- Works in both light and dark mode

Primary color: `#5B4ED6` (Violet-Indigo)

### Privacy Policy & Terms
- Short version inside the app (Settings screen): *"We collect zero data. Everything stays on your device."*
- Full version hosted at: `byant.dev/motif/privacy` and `byant.dev/motif/terms`
- Link from Settings → "Privacy Policy" and "Terms of Use"

---

## 5. Color System

### Light Mode

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#5B4ED6` | Buttons, active states, links |
| Primary hover | `#4338CA` | Button hover |
| Primary subtle | `#EEEDfe` | Tag backgrounds, selected states |
| Background | `#FFFFFF` | App background |
| Surface | `#F9F8FF` | Cards, sidebars |
| Border | `#E8E6F8` | Dividers, input outlines |
| Text primary | `#1A1730` | Headlines, body |
| Text secondary | `#6B6494` | Labels, captions |
| Accent teal | `#0D9488` | Success, active tags, accent |

### Dark Mode

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#8B81F0` | Buttons, active states, links |
| Primary hover | `#9D94F5` | Button hover |
| Primary subtle | `#2D2850` | Tag backgrounds, selected states |
| Background | `#0F0E1A` | App background |
| Surface | `#1C1A30` | Cards, sidebars |
| Border | `#2E2B4A` | Dividers, input outlines |
| Text primary | `#F0EEFE` | Headlines, body |
| Text secondary | `#A09CC8` | Labels, captions |
| Accent teal | `#2DD4BF` | Success, active tags, accent |

---

## 6. Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | **SvelteKit** | ~18KB gzipped vs React's ~45KB. Simpler stores, faster builds, Vercel adapter maintained officially. |
| Styling | **Tailwind CSS** | Purged CSS, ~8KB. Responsive utilities built-in. |
| Database | **Dexie.js** (IndexedDB wrapper) | Best DX for IndexedDB. Handles schema migrations natively. ~23KB. |
| Search | **MiniSearch** | 5–10× faster than Fuse.js on large datasets. Also supports fuzzy matching. ~12KB. |
| Notes editor | **Tiptap** | Rich text editor. Stores as JSON internally. Exports as Markdown automatically. Users never see raw syntax. |
| AI search | **transformers.js** | Runs entirely in-browser via WebAssembly. Model: `all-MiniLM-L6-v2` (~25MB, downloads once, cached permanently by service worker). Zero server calls. |
| OCR | **Tesseract.js** | In-browser OCR. English-only model (~4MB). Lazy-loaded on first use. |
| i18n | **i18next** | ~14KB gzipped. Lazy-loads only the user's language file (~8KB each). |
| Onboarding | **Shepherd.js** or **Driver.js** | Step-by-step UI highlight tour. Dismissed permanently on first real capture. |
| PWA | **vite-plugin-pwa** | Service worker + manifest generation. Handles offline caching, install prompts, and background sync. |
| Build | **Vite** | Fast HMR, tree-shaking, modern bundler. |

### Bundle size estimate (initial load, gzipped)

| Dependency | Size |
|------------|------|
| SvelteKit core | ~18 KB |
| Tailwind (purged) | ~8 KB |
| Dexie.js | ~23 KB |
| MiniSearch | ~12 KB |
| i18next + 1 language | ~18 KB |
| PWA manifest + service worker | ~5 KB |
| **Total initial load** | **~82 KB** |

**Lazy-loaded (first-use only, then cached permanently):**
- Tesseract.js OCR: ~1.2 MB
- transformers.js AI model: ~25 MB

---

## 7. Architecture Overview

```
motif.byant.dev (SvelteKit, Vercel)
│
├── PWA Layer
│   ├── Service Worker (offline cache, Share Target API)
│   ├── Web App Manifest (installable, app icon, theme)
│   └── Background Sync (deferred saves)
│
├── App Layer (SvelteKit)
│   ├── Capture UI (link, quote, note, image)
│   ├── Search (MiniSearch + transformers.js semantic)
│   ├── Collections, Tags, Filters
│   ├── Settings (PIN lock, encryption, backup, changelog)
│   └── Onboarding tour (Shepherd.js)
│
├── Data Layer (Dexie.js → IndexedDB)
│   ├── captures (main table)
│   ├── collections
│   ├── tags
│   └── settings / license state
│
├── Feature Modules (lazy-loaded)
│   ├── OCR (Tesseract.js) — Pro
│   ├── AI Search (transformers.js) — Pro
│   ├── Export/Import (ZIP builder) — Pro
│   └── Reading View (Readability.js) — Pro
│
└── Activation Server (Vercel Serverless Function)
    └── License check → LemonSqueezy API
        Device ID registration (max 2 slots per key)
```

### OG Image Proxy (deferred to later)
A single Vercel Edge Function (~20 lines) that fetches a URL server-side and returns OG tags + image. Required because direct browser fetch of OG metadata is blocked by CORS on most sites. Build when implementing OG preview feature.

---

## 8. Feature List

### Core v1 — All tiers

| Feature | Notes |
|---------|-------|
| Quick capture: link, quote, note, image | 4 capture types from day one |
| Unlimited captures | No cap ever, on any tier |
| Tags | Flat tags, no hierarchy |
| Full-text search | MiniSearch — fuzzy, fast |
| Capture status field | Unread / Saved / Archived (in schema from day one) |
| Responsive UI | Desktop + mobile, screen-aware fonts and layout |
| PWA installable | Works on desktop (Chrome/Edge/Firefox) and mobile (iOS Safari, Android Chrome) |
| Share Target API | "Share to Motif" from any mobile app via native share sheet |
| OG preview on links | Fetch title + OG image at capture time, stored locally |
| Trash + restore | Soft delete, 30-day trash retention |
| Duplicate URL detection | Warn user when saving an already-saved link |
| Date / time filtering | Filter captures by date range |
| Storage usage dashboard | Show used/available IndexedDB storage |
| Keyboard shortcuts | Desktop only, documented in Settings |
| In-app backup reminder | Banner on app open if no backup exported in 30 days |
| Changelog in Settings | Version history visible to user after silent PWA updates |
| App lock (UI PIN) | PIN hides/shows app — v1 is UI-level lock only (not encryption) |
| No telemetry, no analytics | Zero data collection, ever |
| Clear data / factory reset | User must type `DELETE MY DATA` to confirm — prevents accidental deletion |
| Open source | Builds trust with privacy-focused audience |
| Short Privacy Policy in Settings | "We collect zero data." + link to full policy at byant.dev/motif/privacy |

### Pro features — v1.x

| Feature | Notes |
|---------|-------|
| Collections / boards (flat) | Organize captures into named collections. Sub-collections deferred to later. |
| Export ZIP | JSON data file + `/images` folder. Schema-versioned. |
| Import from backup ZIP | Full restore from exported ZIP. v2 can import v1 backups. v1 cannot import v2. |
| Import from Pocket / Raindrop | Parse their export CSV/JSON formats |
| Browser extension | Chrome + Firefox. One-click save of links, highlights, screenshots. Communicates with local app via messaging API. |
| Bulk select, tag, delete | Multi-select mode for captures |
| Reading view | Clean stripped version of saved link (via Readability.js) |
| OCR on screenshots | Tesseract.js, English only (~4MB model). Makes screenshot text searchable. |
| Local AI semantic search | transformers.js, `all-MiniLM-L6-v2`. Finds conceptually related captures, not just keyword matches. |
| AES-256 encryption (opt-in) | PIN → PBKDF2 → AES-256-GCM via Web Crypto API. One-time recovery key shown at setup. Data unrecoverable if PIN and recovery key are both lost. |
| 2 device activations | Tracked via stable Device ID + activation server |
| Early access to new features | Pro users get new features before public release |

### Deferred (upon user request)

| Feature | Notes |
|---------|-------|
| Capacitor native app (v2) | Wrap PWA in Capacitor → iOS + Android builds. Share-sheet integration. On-device SQLite if needed. Build only when users request it. |
| PIN / biometric lock (native) | Biometric requires Capacitor. Deferred with native app. |
| Sub-collections | Flat collections + tags cover 95% of use cases. Add 1 level deep later if requested. |
| OG image proxy (Vercel Edge Function) | Build when OG preview is implemented |
| Local network sync | Family/Team feature. Deferred. |

### Security / trust layer (all tiers)

| Feature | Notes |
|---------|-------|
| App lock + auto-lock timer | PIN hides app after configurable idle time |
| No telemetry | No analytics, no tracking, no phone-home |
| Open source | Full codebase public on GitHub |
| Local encryption (opt-in, Pro) | AES-256-GCM. Opt-in only to avoid burdening non-technical users. |
| Backup reminder | In-app banner (not push notification — no server or permission needed) |
| Clear data | Type `DELETE MY DATA` confirmation |
| Recovery key (encryption users) | 24-character key shown once at PIN/encryption setup. User must save it. Data permanently unrecoverable without it. |

---

## 9. Data Schema

### Capture object (IndexedDB)

```json
{
  "id": "ulid_or_uuid",
  "type": "link | quote | note | image",
  "status": "unread | saved | archived",
  "title": "string",
  "content": "string (URL, quote text, note JSON from Tiptap, image base64 or blob ref)",
  "ogImage": "string (URL, stored locally)",
  "ogTitle": "string",
  "tags": ["tag1", "tag2"],
  "collectionId": "string | null",
  "isTrashed": false,
  "trashedAt": null,
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601",
  "ocrText": "string | null (extracted from image, Pro only)",
  "sourceUrl": "string | null"
}
```

### Export JSON envelope (versioned)

```json
{
  "version": "1",
  "app": "motif",
  "exportedAt": "ISO 8601",
  "captures": [...],
  "collections": [...],
  "tags": [...]
}
```

**Migration rules:**
- v2 can import v1 backup — v2 migration function maps old fields to new schema
- v1 cannot import v2 backup — show user a clear error: "This backup was created with a newer version of Motif. Please update the app first."
- Always include `version` field in export from day one

### Export ZIP structure

```
motif-backup-2026-05-07.zip
├── data.json          ← all captures, collections, tags (versioned)
└── images/
    ├── capture_id_1.jpg
    ├── capture_id_2.png
    └── ...
```

---

## 10. Free Tier Strategy

**Model: Feature gate + 14-day full Pro trial**

- On first install: full Pro unlocked for 14 days (no credit card, no account)
- After trial: Pro features lock, core features remain free forever
- No capture limit — ever, on any tier
- Trial state stored in localStorage (`motif_install_ts`)

**Why not a usage cap:**
Usage caps (e.g. "100 captures max") feel hostile to privacy-focused users and create anxiety while using the app. Feature gates are cleaner, more trustworthy, and convert better.

**Why the trial works:**
Users who build 2 weeks of captures with collections and OCR and then lose them have a real, earned reason to pay. They're not buying a promise — they're buying back something they already know works for them.

**Trial reset risk:**
Users who clear localStorage to reset the trial were never going to pay. Not worth designing around.

---

## 11. Pricing

| Tier | Price | Devices | Notes |
|------|-------|---------|-------|
| Free | $0 forever | 1 | No capture limit. Feature gates apply after 14-day trial. |
| Lifetime Pro | **$19 launch → $29 regular** | 2 | One-time. No renewal. 2-device activation. |
| Family | $59 one-time | 5 seats | All Pro features + local network sync + priority support |
| Team | $99 one-time | 10 seats | All Pro features + local network sync + priority support |

**On pricing:**
- $19 launch price creates urgency and captures first 50–100 paying users fast
- $29 regular is the sweet spot — comparable to Pockity ($29), Tot ($20), and similar privacy/lifetime apps
- 2-device allowance on Pro is a strong differentiator — most competitors allow only 1
- No annual fee, no subscription — this is the product promise and must never change

**License platform:** LemonSqueezy (preferred) or Gumroad — decide before launch

---

## 12. License Activation Flow

### How it works

1. User buys Lifetime Pro on LemonSqueezy
2. LemonSqueezy emails license key: `MOTIF-XXXX-XXXX-XXXX`
3. User enters key in Motif → Settings → Activate Pro
4. App generates a stable **Device ID**: hash of browser + OS + screen fingerprint, stored in localStorage
5. App calls a Vercel serverless activation function with `{licenseKey, deviceId}`
6. Server checks LemonSqueezy API:

```
Is this device ID already registered to this key?
  YES → Re-activate (same slot reused, count unchanged) ✓
  NO  → Is slots used < 2?
          YES → Register new device, activate ✓
          NO  → Return "both slots used" error
                  → App shows: "Deactivate Device 1 or 2 to continue"
                  → User picks → old slot freed → new device activated ✓
```

### Device ID behavior

- Generated once, stored in localStorage
- If user clears localStorage (reinstall, new browser, new device): old Device ID is gone, app generates a new one
- Server sees new Device ID as a new device — will consume a slot or trigger deactivation prompt if both are full
- **Communicate this clearly in the app:** *"Clearing app data or switching browsers counts as a new device activation."*

### Activation after reinstall

- User re-enters their license key
- If Device ID is new (because localStorage was cleared), and a slot is free → activates normally
- If both slots are full → deactivation prompt → user frees a slot → activates

### Offline behavior

- After successful activation, Pro state is stored locally in IndexedDB/localStorage
- Subsequent app launches do NOT require internet — the local state is trusted
- Activation check only happens when the key is first entered (or re-entered)

---

## 13. Security Model

### v1 — UI-level PIN lock (default)

- PIN hides/shows the app (like a phone screen lock)
- IndexedDB data is **not** encrypted at rest
- Forgot PIN → clear app data → re-import from backup ZIP
- Simple to implement, recoverable, good enough for most users
- Limitation: someone with browser DevTools can access raw IndexedDB data

### v2 — True encryption (Pro, opt-in)

- User enables "Encrypt my data" in Settings
- PIN → PBKDF2 (100,000 iterations) → AES-256-GCM key → encrypts all IndexedDB records
- At setup: a 24-character recovery key is shown **once** — user must save it
- Forgot PIN + lost recovery key = data permanently unrecoverable (by design)
- Uses the browser's built-in **Web Crypto API** — no external library needed

### Why opt-in only

Mandatory encryption would burden non-technical users with recovery key management they don't understand. The opt-in toggle in Settings (Pro only) means the people who need it can have it; everyone else gets a simpler experience.

### Auto-lock

- Configurable timer in Settings: 1 min / 5 min / 15 min / 1 hour / never
- App shows PIN/lock screen after idle timeout
- Applies to both UI lock (v1) and encryption lock (v2)

---

## 14. Multilingual (i18n)

### Library: i18next

- ~14KB gzipped
- Each language file: ~4–8KB
- Strategy: lazy-load only the user's language on startup

### Launch languages (covers ~75% of global internet users)

| Language | Code | Notes |
|----------|------|-------|
| English | `en` | Default / fallback |
| Filipino | `fil` | Home market (byant.dev is PH-based) |
| Spanish | `es` | Largest non-English internet language |
| Portuguese | `pt-BR` | Brazil — huge mobile market |
| French | `fr` | |
| German | `de` | |
| Japanese | `ja` | |
| Simplified Chinese | `zh-CN` | |

**Total i18n bundle size:** ~40–80KB for 8 languages (loaded lazily — user only ever downloads 1 file)

**String count:** ~120 unique UI strings (buttons, labels, tooltips, errors, onboarding, settings)

**Tip:** Use [Weblate](https://weblate.org) or [Crowdin](https://crowdin.com) for community-contributed translations. Native speakers catch nuance; you pay nothing for the translation work.

### OCR language scope
English only at launch. Tesseract English model: ~4MB cached. Filipino users almost exclusively write notes in English — no Filipino OCR model needed.

---

## 15. Deployment

### Stack
- **Hosting:** Vercel (free tier handles this project easily)
- **Repo:** GitHub → auto-deploy on every `git push`
- **Framework adapter:** `@sveltejs/adapter-vercel` (maintained by Vercel team, zero config)
- **Domain:** Add CNAME record `motif` → Vercel's assigned domain in byant.dev DNS settings

### Vercel functions used
1. **License activation** (`/api/activate`) — Serverless function, calls LemonSqueezy API, stores device registrations
2. **OG proxy** (`/api/og`) — Edge function, fetches URL server-side, returns OG tags *(deferred — build when OG preview is implemented)*

### PWA targets
Must install and work correctly on:
- **iOS:** Safari (Add to Home Screen) — Apple devices
- **Android:** Chrome (Install PWA prompt) — Android + Huawei devices
- **Desktop:** Chrome, Edge, Firefox (via browser install prompt)
- **Huawei:** Huawei Browser supports PWA — no extra work needed if standard manifest is correct

---

## 16. Build Roadmap

### Phase 1 — Web + PWA (v1.0)
- SvelteKit project setup, Tailwind, Dexie.js, MiniSearch
- 4 capture types: link, quote, note, image
- Tags, search, status field (Unread/Saved/Archived)
- Trash + restore, duplicate URL detection
- Date/time filtering, storage dashboard, keyboard shortcuts
- PWA manifest + service worker (offline day one)
- Share Target API (mobile share-to-Motif)
- OG preview (fetch at capture time, stored locally)
- Responsive layout: desktop + mobile, screen-aware typography
- Onboarding tour (Shepherd.js) — dismisses on first real capture, "?" tooltip icons throughout
- App lock (UI PIN), auto-lock timer
- In-app backup reminder banner (30-day default)
- Changelog in Settings
- Short privacy policy in Settings, links to byant.dev/motif/privacy
- Clear data with `DELETE MY DATA` confirmation
- i18n setup (8 languages)
- 14-day Pro trial on first install
- License activation (LemonSqueezy + Vercel serverless)

### Phase 2 — Pro features (v1.x)
- Collections / boards (flat)
- Export ZIP (JSON + images folder, versioned)
- Import from ZIP / Pocket / Raindrop
- Browser extension (Chrome + Firefox)
- Bulk select, tag, delete
- Reading view (Readability.js)
- OCR on screenshots (Tesseract.js, English)
- Local AI semantic search (transformers.js)
- AES-256 encryption opt-in (Web Crypto API + recovery key)
- OG proxy (Vercel Edge Function)

### Phase 3 — Native app (v2, on user request)
- Wrap PWA in Capacitor
- iOS + Android builds
- Share-sheet integration (save from any native app)
- On-device SQLite if IndexedDB has limitations
- Biometric lock (Face ID / fingerprint via Capacitor plugin)
- Sub-collections (1 level deep, if requested)

---

## 17. Monetization Summary

### Platform
**LemonSqueezy** (preferred over Gumroad — better EU VAT handling, cleaner API, developer-friendly)

### License key format
`MOTIF-XXXX-XXXX-XXXX`

### Conversion strategy
1. User installs Motif → full Pro trial for 14 days (no friction, no account)
2. Day 14: Pro features lock → user feels real loss → converts or downgrades to Free
3. Upgrade prompt is contextual: shown when user tries to use a gated feature after trial
4. No popups, no nagging — one clean upgrade prompt per gated action

### Revenue benchmarks (indie app context)
Comparable privacy/lifetime apps at $19–$29 one-time: typical conversion rate 2–5% of active free users. At 1,000 active users: 20–50 paying customers = $380–$1,450 at $19 launch price. Grows with word-of-mouth (privacy tools spread organically in communities).

---

## 18. Open Items / Deferred Features

| Item | Status | Notes |
|------|--------|-------|
| Free tier: confirmed feature gate + 14-day trial | ✅ Decided | No capture limits ever |
| Collections: flat only | ✅ Decided | Sub-collections added only on user request |
| Capture status field | ✅ In schema from day one | Unread / Saved / Archived |
| OG image proxy | ⏳ Deferred | Single Vercel Edge Function — build when OG preview shipped |
| Backup reminder | ✅ Decided | In-app banner, no push notification server |
| Capacitor native app | ⏳ On user request | v2, not planned until demand confirmed |
| PIN/biometric (native) | ⏳ With Capacitor | Depends on Capacitor app |
| Sub-collections | ⏳ On user request | Flat + tags covers 95% of use cases |
| LemonSqueezy vs Gumroad | ⏳ Decide before launch | LemonSqueezy preferred |
| True AES encryption (opt-in) | 📅 Pro v1.x | After UI PIN is shipped and stable |
| Local network sync (Family/Team) | 📅 Family/Team tier | After core is solid |
| Huawei AppGallery (Capacitor) | ⏳ With Capacitor | PWA covers Huawei via browser for now |

---

*End of Motif product notes. Ready to begin implementation — start with the data schema, then build the SvelteKit project structure.*
