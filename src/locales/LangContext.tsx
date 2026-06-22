import React, { createContext, useContext, useEffect, useState } from 'react';
import { Lang, TranslationKey, translations } from './translations';
import { loadLanguage, saveLanguage } from '../logic/settingsStorage';

type LangContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
};

const LangContext = createContext<LangContextValue>({
  lang: 'ru',
  setLang: () => {},
  t: (key) => key as string,
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ru');

  useEffect(() => {
    loadLanguage((l) => {
      if (l === 'uz' || l === 'ru') setLangState(l as Lang);
    });
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    saveLanguage(l);
  };

  const t = (key: TranslationKey): string =>
    translations[lang][key] ?? translations.ru[key] ?? (key as string);

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
