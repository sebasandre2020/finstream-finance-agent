import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getInitialLanguage,
  LANG_KEY,
  saveLanguage,
  translateCategory,
  translations,
} from "./i18n";

describe("i18n localization", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("defaults to English when no language is saved in localStorage", () => {
    expect(getInitialLanguage()).toBe("en");
  });

  it("reads saved language from localStorage", () => {
    localStorage.setItem(LANG_KEY, "es");
    expect(getInitialLanguage()).toBe("es");
  });

  it("persists language selection to localStorage", () => {
    saveLanguage("es");
    expect(localStorage.getItem(LANG_KEY)).toBe("es");
    saveLanguage("en");
    expect(localStorage.getItem(LANG_KEY)).toBe("en");
  });

  it("translates categories appropriately into Spanish and preserves original in English", () => {
    expect(translateCategory("Groceries", "es")).toBe("Alimentación");
    expect(translateCategory("Groceries", "en")).toBe("Groceries");
    expect(translateCategory("Entertainment", "es")).toBe("Entretenimiento");
    expect(translateCategory("Unknown Custom Category", "es")).toBe(
      "Unknown Custom Category",
    );
  });

  it("contains equivalent navigation keys in both English and Spanish", () => {
    const enNavKeys = Object.keys(translations.en.nav).sort();
    const esNavKeys = Object.keys(translations.es.nav).sort();
    expect(esNavKeys).toEqual(enNavKeys);
  });

  it("contains equivalent heading keys in both English and Spanish", () => {
    const enHeadings = Object.keys(translations.en.headings).sort();
    const esHeadings = Object.keys(translations.es.headings).sort();
    expect(esHeadings).toEqual(enHeadings);
  });
});
