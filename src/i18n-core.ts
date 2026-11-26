import korean from './locales/ko.json';
import guidance from './locales/ko-guidance.json';

export const koreanMessages: Readonly<Record<string, string>> = { ...korean, ...guidance };

export type Language = 'en' | 'ko';
export type Message = string | { key: string; values: readonly MessageValue[] };
export type MessageValue = Message | number | null | undefined;
export type Translator = (message: Message, values?: readonly MessageValue[]) => string;
export const languageStorageKey = 'ripple:language:v1';
export const localeFor = (language: Language) => (language === 'ko' ? 'ko-KR' : 'en-US');
export const message = (key: string, values: readonly MessageValue[] = []): Message => ({
  key,
  values,
});

// Only interface messages enter this function. Source text, evidence and user input stay verbatim.
export function translate(
  message: Message,
  language: Language = 'en',
  values: readonly MessageValue[] = [],
): string {
  const key = typeof message === 'string' ? message : message.key;
  const parameters = typeof message === 'string' ? values : message.values;
  const template =
    language === 'ko' && Object.hasOwn(koreanMessages, key) ? koreanMessages[key] : key;
  return template.replace(/\{(\d+)\}/g, (placeholder, index: string) => {
    const value = parameters[Number(index)];
    if (value === undefined) return placeholder;
    if (value === null) return '';
    return typeof value === 'object' ? translate(value, language) : String(value);
  });
}

export function readLanguage(storage: Pick<Storage, 'getItem'>): Language {
  try {
    return storage.getItem(languageStorageKey) === 'ko' ? 'ko' : 'en';
  } catch {
    return 'en';
  }
}

export function saveLanguage(storage: Pick<Storage, 'setItem'>, language: Language): boolean {
  try {
    storage.setItem(languageStorageKey, language);
    return true;
  } catch {
    return false;
  }
}
