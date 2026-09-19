/**
 * Site-wide UI language. Distinct from a template's `language` field
 * (src/components/TemplateForm.tsx) — that one picks the TTS/STT voice
 * locale for a specific customer call and has its own, separate list.
 */
export const UI_LOCALES = ['en', 'hi', 'es', 'ta', 'te', 'kn', 'ml'] as const;
export type UiLocale = (typeof UI_LOCALES)[number];

export const DEFAULT_UI_LOCALE: UiLocale = 'en';

export const UI_LOCALE_LABELS: Record<UiLocale, string> = {
  en: 'English',
  hi: 'हिन्दी',
  es: 'Español',
  ta: 'தமிழ்',
  te: 'తెలుగు',
  kn: 'ಕನ್ನಡ',
  ml: 'മലയാളം',
};

export function isUiLocale(value: string | null | undefined): value is UiLocale {
  return !!value && (UI_LOCALES as readonly string[]).includes(value);
}
