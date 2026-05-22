export const CHECKOUT_URLS = {
  pro:    'https://byant.lemonsqueezy.com/checkout/buy/d75b6538-e78d-423c-a501-a1befb7c14d2',
  family: 'https://byant.lemonsqueezy.com/checkout/buy/b7cb4bc6-e815-4c25-b53c-6dc6f5873c97',
  team:   'https://byant.lemonsqueezy.com/checkout/buy/3c4394ab-7018-4613-8a6f-1d1b83d1456f'
} as const;

export function getCheckoutUrl(url: string): string {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    if (url === CHECKOUT_URLS.pro) {
      return 'https://byant.lemonsqueezy.com/checkout/buy/2fbab98f-e8ba-4757-b197-5cfa8e6e7b50';
    }
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.set('preview', '1');
      return urlObj.toString();
    } catch (err) {
      console.error('Failed to parse checkout URL for test mode:', err);
    }
  }
  return url;
}
