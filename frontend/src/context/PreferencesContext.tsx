import React, { useCallback, useEffect, useState } from "react";
import {
  Language,
  getInitialLanguage,
  saveLanguage,
  translations,
} from "../lib/i18n";
import { Theme, getInitialTheme, saveTheme, applyTheme } from "../lib/theme";
import { money } from "../lib/finance";
import {
  PreferencesContext,
  PreferencesContextValue,
} from "./preferences-context";

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [lang, setLangState] = useState<Language>(getInitialLanguage);
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const setLang = useCallback((nextLang: Language) => {
    setLangState(nextLang);
    saveLanguage(nextLang);
    if (typeof document !== "undefined") {
      document.documentElement.lang = nextLang;
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === "en" ? "es" : "en");
  }, [lang, setLang]);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    saveTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  useEffect(() => {
    applyTheme(theme);
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [theme, lang]);

  const formatDate = useCallback(
    (
      date: Date | string | number,
      options?: Intl.DateTimeFormatOptions,
    ): string => {
      const d = typeof date === "object" ? date : new Date(date);
      return d.toLocaleDateString(lang === "es" ? "es-ES" : "en-US", options);
    },
    [lang],
  );

  const formatTime = useCallback(
    (
      date: Date | string | number,
      options?: Intl.DateTimeFormatOptions,
    ): string => {
      const d = typeof date === "object" ? date : new Date(date);
      return d.toLocaleTimeString(
        lang === "es" ? "es-ES" : "en-US",
        options ?? { hour: "numeric", minute: "2-digit" },
      );
    },
    [lang],
  );

  const formatDateTime = useCallback(
    (
      date: Date | string | number,
      options?: Intl.DateTimeFormatOptions,
    ): string => {
      const d = typeof date === "object" ? date : new Date(date);
      return d.toLocaleString(
        lang === "es" ? "es-ES" : "en-US",
        options ?? {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        },
      );
    },
    [lang],
  );

  const formatMoney = useCallback(
    (amount: number, currency: string): string => {
      return money(amount, currency, lang === "es" ? "es-ES" : undefined);
    },
    [lang],
  );

  const value: PreferencesContextValue = {
    lang,
    setLang,
    toggleLang,
    theme,
    setTheme,
    toggleTheme,
    t: translations[lang],
    formatDate,
    formatTime,
    formatDateTime,
    formatMoney,
  };

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}
