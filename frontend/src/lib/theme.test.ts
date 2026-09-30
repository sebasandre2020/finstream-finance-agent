import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyTheme, getInitialTheme, saveTheme, THEME_KEY } from "./theme";

describe("theme management", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });
  afterEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  it("defaults to light theme when not explicitly configured", () => {
    expect(getInitialTheme()).toBe("light");
  });

  it("reads stored dark theme from localStorage", () => {
    localStorage.setItem(THEME_KEY, "dark");
    expect(getInitialTheme()).toBe("dark");
  });

  it("persists theme preference to localStorage", () => {
    saveTheme("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    saveTheme("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
  });

  it("applies dark class to document element", () => {
    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    applyTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
