# 🌌 Motif — A Private, Offline-First Personal Workspace

Motif is a high-end, client-side personal workspace designed to capture, organize, and encrypt links, highlights, images, and text notes. Everything stays securely on your own device.

👉 **Try the Live App:** [motif.byant.dev](https://motif.byant.dev)

---

## ✨ Key Features

*   📂 **Local-First & Client-Side:** No mandatory accounts, login screens, or cloud syncing by default. Everything is stored instantly in your browser's local IndexedDB.
*   🔑 **AES-256 Local Encryption:** Secure your database with a personal password. All cryptography (PBKDF2 key derivation and AES-GCM encryption) runs purely inside your browser using the native Web Cryptography API.
*   🔌 **Companion Extensions:** Clip text highlights, full-page links, and web images with one-click using our Chrome, Firefox, and Edge companion extensions.
*   🎨 **Spatial Ambient Design:** Built with a fluid, modern, glassmorphic spatial design system featuring rotating GPU-accelerated mesh backdrops, interactive 3D perspective-tilting capture cards, and micro-animations.
*   🔍 **Instant Full-Text Search:** Find anything in your dashboard instantly without any server latency using a fully local indexing search engine.
*   📱 **Mobile Responsive & PWA:** Install Motif on your iOS, Android, Huawei, or desktop device with full offline capabilities.

---

## 🛠️ The Tech Stack

Motif is built utilizing cutting-edge client-side technology:
*   **Framework:** SvelteKit & Svelte 5 (leveraging Svelte 5 runes for state reactivity)
*   **Local Database:** IndexedDB wrapped in Dexie.js for high-performance querying
*   **Search Engine:** MiniSearch (local client-side indexing)
*   **Styling:** Tailwind CSS (frosted glassmorphic themes)
*   **Security:** Native Web Cryptography API for AES-256 GCM local encryption
*   **Extension API:** Manifest V3

---

## 🛡️ License & Copyright

**Copyright © 2026 Byant (antkakanat). All Rights Reserved.**

This repository contains the source code for Motif. 

*   **Viewing and Learning:** You are welcome to explore the codebase, fork the repository on GitHub, and inspect the code for educational and privacy-verification purposes.
*   **Restrictions:** **No commercial use, redistribution, or modification for public use is allowed.** You may not copy, reproduce, host, publish, or distribute any part of this source code or use the Motif name, logo, or assets for commercial projects without explicit written permission from the copyright owner.

For licensing inquiries or partnerships, please contact: **support@byant.dev**
