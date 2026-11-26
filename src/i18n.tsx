import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Languages } from 'lucide-react';
import {
  localeFor,
  readLanguage,
  saveLanguage,
  translate,
  type Language,
  type Translator,
} from './i18n-core.js';

const LanguageContext = createContext<
  | {
      language: Language;
      locale: string;
      t: Translator;
      setLanguage: (language: Language) => void;
      persisted: boolean;
    }
  | undefined
>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>(() => {
    try {
      return readLanguage(window.localStorage);
    } catch {
      return 'en';
    }
  });
  const [persisted, setPersisted] = useState(true);
  const setLanguage = useCallback((value: Language) => {
    updateLanguage(value);
    try {
      setPersisted(saveLanguage(window.localStorage, value));
    } catch {
      setPersisted(false);
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const value = useMemo(
    () => ({
      language,
      locale: localeFor(language),
      t: ((key, parameters) => translate(key, language, parameters)) as Translator,
      setLanguage,
      persisted,
    }),
    [language, setLanguage, persisted],
  );
  return <LanguageContext value={value}>{children}</LanguageContext>;
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('LanguageProvider is required');
  return context;
}

export function LanguageSelector() {
  const { language, setLanguage, persisted, t } = useI18n();
  return (
    <div className="language-control">
      <label htmlFor="interface-language">
        <Languages size={16} aria-hidden="true" />
        <span>{t('Language')}</span>
      </label>
      <select
        id="interface-language"
        name="language"
        aria-label={t('Language')}
        value={language}
        onChange={(event) => setLanguage(event.target.value === 'ko' ? 'ko' : 'en')}
      >
        <option value="en" lang="en">
          English
        </option>
        <option value="ko" lang="ko">
          한국어
        </option>
      </select>
      {!persisted && (
        <span className="language-warning" role="status">
          {t('Language applies to this session. Browser storage is unavailable.')}
        </span>
      )}
    </div>
  );
}
