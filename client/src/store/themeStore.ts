import { create } from "zustand";

export type Theme = "light" | "dark";

const STORAGE_KEY = "chesshub-theme";

function readInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Storage can be blocked — fall through to the OS preference.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = readInitialTheme();
  applyTheme(initial);

  const setTheme = (theme: Theme) => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Non-fatal — the choice just won't persist across reloads.
    }
    set({ theme });
  };

  return {
    theme: initial,
    setTheme,
    toggleTheme: () => setTheme(get().theme === "dark" ? "light" : "dark"),
  };
});
