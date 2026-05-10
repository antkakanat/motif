// ────────────────────────────────────────────────
// i18n — i18next setup, English + 7 stub languages
// ────────────────────────────────────────────────

import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from '../locales/en.json';
import fil from '../locales/fil.json';
import es from '../locales/es.json';
import ptBR from '../locales/pt-BR.json';
import fr from '../locales/fr.json';
import de from '../locales/de.json';
import ja from '../locales/ja.json';
import zhCN from '../locales/zh-CN.json';

let initialized = false;

export async function initI18n(): Promise<void> {
  if (initialized) return;

  await i18next.use(LanguageDetector).init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'fil', 'es', 'pt-BR', 'fr', 'de', 'ja', 'zh-CN'],
    resources: {
      en:    { translation: en },
      fil:   { translation: fil },
      es:    { translation: es },
      'pt-BR': { translation: ptBR },
      fr:    { translation: fr },
      de:    { translation: de },
      ja:    { translation: ja },
      'zh-CN': { translation: zhCN }
    },
    interpolation: {
      escapeValue: false // Svelte handles escaping
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  });

  initialized = true;
}

// ── Translation function ──

export function t(key: string, options?: Record<string, unknown>): string {
  const result = i18next.t(key, options as never);
  return String(result ?? key);
}

// ── Change language ──

export async function changeLanguage(code: string): Promise<void> {
  await i18next.changeLanguage(code);
}

// ── Get current language ──

export function getCurrentLanguage(): string {
  return i18next.language ?? 'en';
}
