import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { useThemeStore } from "../store/themeStore";

export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation("appShell");
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const isDark = theme === "dark";
  const label = isDark ? t("theme.switchToLight") : t("theme.switchToDark");

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn("h-9 w-9 shrink-0 p-0", className)}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      {isDark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
    </Button>
  );
}
