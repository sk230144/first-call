'use client';

import { UI_LOCALES, UI_LOCALE_LABELS, type UiLocale } from '@/lib/i18n/locales';
import { useLocale } from '@/lib/i18n/LocaleProvider';

/** Dropdown to switch the site-wide UI language. Used in the sidebar and public nav. */
export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  return (
    <select
      className={`language-switcher ${className}`.trim()}
      value={locale}
      onChange={(e) => setLocale(e.target.value as UiLocale)}
      aria-label="Language"
    >
      {UI_LOCALES.map((code) => (
        <option key={code} value={code}>{UI_LOCALE_LABELS[code]}</option>
      ))}
    </select>
  );
}
