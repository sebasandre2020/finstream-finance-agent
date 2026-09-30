import { createContext } from "react";
import { Language, translations, TranslationKeys } from "../lib/i18n";
import { Theme } from "../lib/theme";
import { money } from "../lib/finance";

export interface PreferencesContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  t: TranslationKeys;
  formatDate: (
    date: Date | string | number,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  formatMoney: (amount: number, currency: string) => string;
}

export const defaultPreferencesValue: PreferencesContextValue = {
  lang: "en",
  setLang: () => {},
  toggleLang: () => {},
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
  t: translations.en,
  formatDate: (date, options) =>
    new Date(date).toLocaleDateString("en-US", options),
  formatMoney: (amount, currency) => money(amount, currency),
};

export const PreferencesContext = createContext<PreferencesContextValue>(
  defaultPreferencesValue,
);
