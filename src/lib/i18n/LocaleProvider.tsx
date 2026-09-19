'use client';

/**
 * Site-wide UI language. Persists to localStorage and defaults to English.
 * Every client page wraps its content in <LocaleProvider> and reads/writes
 * the active locale via useLocale() / useT().
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { DEFAULT_UI_LOCALE, isUiLocale, type UiLocale } from './locales';
import { translate, type DictionaryKey } from './dictionary';

const STORAGE_KEY = 'accord-ui-locale';

type LocaleContextValue = {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_UI_LOCALE,
  setLocale: () => {},
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>(DEFAULT_UI_LOCALE);

  // Read the stored preference after mount so server and first client
  // render both use the English default — avoids a hydration mismatch.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isUiLocale(stored)) setLocaleState(stored);
    } catch { /* private mode / storage disabled */ }
  }, []);

  function setLocale(next: UiLocale) {
    setLocaleState(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

/** `const t = useT(); t('dashboard.title')` */
export function useT() {
  const { locale } = useLocale();
  return (key: DictionaryKey, vars?: Record<string, string | number>) => translate(locale, key, vars);
}
