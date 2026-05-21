// ────────────────────────────────────────────────
// Link Metadata Fetcher — Phase F
// Uses jsonlink.io CORS-safe API for og:title, og:description, favicon, og:image
// Falls back gracefully if offline or API unavailable
// ────────────────────────────────────────────────

export interface LinkMetadata {
  title: string | null;
  description: string | null;
  favicon: string | null;
  ogImage: string | null;
  domain: string | null;
}

const JSONLINK_API = 'https://jsonlink.io/api/extract';

/** Extract the root domain from a URL, e.g. "github.com" */
export function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Build a Google favicon URL for a domain */
function googleFavicon(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

/**
 * Fetch link metadata for a URL.
 * Returns null fields (not throws) if the fetch fails — the caller should
 * treat null as "fetch unavailable, let the user fill in manually."
 */
export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  const domain = extractDomain(url);
  const fallback: LinkMetadata = {
    title: null,
    description: null,
    favicon: domain ? googleFavicon(domain) : null,
    ogImage: null,
    domain
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const res = await fetch(`${JSONLINK_API}?url=${encodeURIComponent(url)}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) return fallback;

    const data = await res.json();

    return {
      title: data.title || null,
      description: data.description || null,
      favicon: domain ? googleFavicon(domain) : null,
      ogImage: data.images?.[0] || null,
      domain
    };
  } catch {
    // Network error, timeout, or offline — return minimal fallback
    return fallback;
  }
}
