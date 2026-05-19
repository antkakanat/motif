import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';



export const GET: RequestHandler = async ({ url }) => {
  const targetUrl = url.searchParams.get('url');
  if (!targetUrl) {
    return json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    // Basic validation of URL
    new URL(targetUrl);

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'MotifBot/1.0'
      }
    });

    if (!response.ok) {
      return json({ error: 'Failed to fetch target URL' }, { status: response.status });
    }

    const html = await response.text();

    // Extract OG Title
    // <meta property="og:title" content="..." /> or <meta content="..." property="og:title" />
    const titleMatch = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                     html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:title["']/i);
    
    // Extract OG Image
    const imageMatch = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                     html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);

    // Extract description
    const descriptionMatch = html.match(/<meta\s+(?:property|name)=["']og:description["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:description["']/i) ||
      html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);

    const siteNameMatch = html.match(/<meta\s+(?:property|name)=["']og:site_name["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:site_name["']/i);

    // Fallback to <title> tag if og:title is missing
    let title = titleMatch ? titleMatch[1] : null;
    if (!title) {
      const pageTitleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      title = pageTitleMatch ? pageTitleMatch[1] : null;
    }

    return json({
      title: title ? decodeHtmlEntities(title.trim()) : null,
      image: imageMatch ? imageMatch[1].trim() : null,
      description: descriptionMatch ? decodeHtmlEntities(descriptionMatch[1].trim()) : null,
      siteName: siteNameMatch ? decodeHtmlEntities(siteNameMatch[1].trim()) : null
    });
  } catch (err) {
    console.error('OG Proxy error:', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

function decodeHtmlEntities(str: string): string {
  return str.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&apos;/g, "'");
}
