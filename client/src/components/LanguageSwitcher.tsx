import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supportedLanguages } from "../i18n";
import { cn } from "../lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.resolvedLanguage ?? i18n.language;

  return (
    <label
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground",
        className,
      )}
    >
      <Languages className="h-4 w-4 shrink-0" aria-hidden />
      <span className="sr-only">Language</span>
      <select
        value={currentLanguage}
        onChange={(event) => i18n.changeLanguage(event.target.value)}
        className="w-full cursor-pointer appearance-none bg-transparent text-foreground focus:outline-none"
      >
        {supportedLanguages.map((language) => (
          <option key={language.code} value={language.code} className="bg-card text-foreground">
            {language.label}
          </option>
        ))}
      </select>
    </label>
  );
}
