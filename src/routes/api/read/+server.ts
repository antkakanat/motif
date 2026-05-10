import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import DOMPurify from 'isomorphic-dompurify';

export const GET: RequestHandler = async ({ url }) => {
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    // 1. Safety Check: Only accept http/https URLs
    const parsed = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return json({ error: 'invalid_url', message: 'Only http and https protocols are supported' }, { status: 400 });
    }

    // 2. Fetch with Timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s max

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Motif-Reader/1.0; +https://byant.dev/motif)'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return json({ error: 'fetch_failed', status: response.status }, { status: 502 });
    }

    const html = await response.text();

    // 3. Parse with Linkedom (Lighter than JSDOM)
    const { document } = parseHTML(html);

    // 4. Run Readability
    const reader = new Readability(document);
    const article = reader.parse();

    if (!article) {
      return json({ error: 'parse_failed', message: 'Could not extract content from this page' }, { status: 422 });
    }

    // 5. Sanitize Output
    const sanitizedContent = DOMPurify.sanitize(article.content, {
      ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'b', 'i', 'strong', 'em', 'a', 'img', 'hr', 'br'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title']
    });

    return json({
      title: article.title,
      byline: article.byline,
      excerpt: article.excerpt,
      siteName: article.siteName,
      content: sanitizedContent,
      length: article.length
    });

  } catch (err: any) {
    if (err.name === 'AbortError') {
      return json({ error: 'timeout', message: 'The request timed out' }, { status: 504 });
    }
    console.error('Reading View Proxy Error:', err);
    return json({ error: 'internal_error', message: err.message }, { status: 500 });
  }
};

/**
 * NOTE ON RATE LIMITING:
 * Current v1 relies on Vercel's built-in DDoS protection and platform-level limits.
 * If abuse occurs, implement Redis-based or IP-based rate limiting here.
 */
