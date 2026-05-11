import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import DOMPurify from 'isomorphic-dompurify';

export const GET: RequestHandler = async (event) => {
  try {
    return await handleGet(event);
  } catch (err: any) {
    console.error('Reading View FATAL Error:', err);
    return json({ error: 'internal_error', message: `Fatal proxy error: ${err?.message || String(err)}` }, { status: 500 });
  }
};

const handleGet: RequestHandler = async ({ url }) => {
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
    let html: string;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8s max

      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
        }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return json({ error: 'fetch_failed', message: `Target site returned status ${response.status}` }, { status: 502 });
      }

      html = await response.text();
      if (!html || html.trim().length === 0) {
        return json({ error: 'empty_response', message: 'The target page returned no content' }, { status: 422 });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return json({ error: 'timeout', message: 'The request timed out after 8 seconds' }, { status: 504 });
      }
      return json({ error: 'fetch_error', message: `Failed to fetch the page: ${err.message}` }, { status: 502 });
    }

    // 3. Parse with Linkedom
    let article: any;
    try {
      const { document } = parseHTML(html);
      const reader = new Readability(document);
      article = reader.parse();
    } catch (err: any) {
      return json({ error: 'parse_error', message: `Failed to parse page content: ${err.message}` }, { status: 422 });
    }

    if (!article || !article.content) {
      return json({ error: 'no_content', message: 'Could not extract readable content from this page' }, { status: 422 });
    }

    // 4. Sanitize Output
    let sanitizedContent: string;
    try {
      sanitizedContent = DOMPurify.sanitize(article.content, {
        ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'b', 'i', 'strong', 'em', 'a', 'img', 'hr', 'br'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title']
      });
    } catch (err: any) {
      // If sanitizer fails, fall back to a safer but less clean version or return error
      return json({ error: 'sanitization_error', message: `Failed to sanitize content: ${err.message}` }, { status: 500 });
    }

    return json({
      title: article.title || 'Untitled',
      byline: article.byline,
      excerpt: article.excerpt,
      siteName: article.siteName,
      content: sanitizedContent,
      length: article.length
    });

  } catch (err: any) {
    console.error('Reading View Global Error:', err);
    return json({ error: 'internal_error', message: `Global proxy error: ${err?.message || String(err)}` }, { status: 500 });
  }
};

/**
 * NOTE ON RATE LIMITING:
 * Current v1 relies on Vercel's built-in DDoS protection and platform-level limits.
 * If abuse occurs, implement Redis-based or IP-based rate limiting here.
 */
