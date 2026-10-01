import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ArrowRight, Clock, LayoutGrid, List, Search, Star } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

type Coach = {
  id: string;
  name: string;
  surname: string;
  title: string;
  experienceYears: number;
  bio: string | null;
  photoUrl: string | null;
  fideRating: number | null;
  specialties: string[];
  languages: string[];
  hourlyRate: number | null;
  hourlyRateCurrency: string | null;
};

type ViewMode = "grid" | "list";
type SortKey = "default" | "rating" | "priceLow" | "experience";

const SORT_KEYS: SortKey[] = ["default", "rating", "priceLow", "experience"];

// Hover lift only where hover really exists — on touch a tap would otherwise leave the card "stuck" raised.
const CARD_CLASS =
  "group block rounded-xl border border-border/80 bg-card/80 backdrop-blur-sm transition-[transform,box-shadow,border-color] duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-1 [@media(hover:hover)_and_(pointer:fine)]:hover:border-primary/35 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-soft active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Short cascade on first paint; capped so a long list never makes the last card wait.
function staggerStyle(index: number) {
  return { animationDelay: `${Math.min(index, 8) * 40}ms` };
}

function formatRate(coach: Coach) {
  if (coach.hourlyRate == null) return null;
  return `${coach.hourlyRate} ${coach.hourlyRateCurrency ?? ""}`.trim();
}

// A small, deterministic rotation through the existing theme colors — no new
// palette to maintain, and the same coach always lands on the same color.
const AVATAR_BG_CLASSES = ["bg-primary", "bg-accent", "bg-foreground"];

function avatarBgClass(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_BG_CLASSES[hash % AVATAR_BG_CLASSES.length];
}

function initialsOf(name: string, surname: string) {
  return `${name.charAt(0)}${surname.charAt(0)}`.toUpperCase();
}

function matchesQuery(coach: Coach, query: string) {
  if (!query) return true;
  const haystack = [coach.name, coach.surname, coach.title, ...coach.specialties]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function CoachAvatar({ coach, className }: { coach: Coach; className: string }) {
  if (coach.photoUrl) {
    return (
      <img
        src={coach.photoUrl}
        alt=""
        className={cn(className, "shrink-0 rounded-full object-cover ring-2 ring-card")}
      />
    );
  }
  return (
    <span
      className={cn(
        className,
        avatarBgClass(coach.id),
        "flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-card",
      )}
      aria-hidden
    >
      {initialsOf(coach.name, coach.surname)}
    </span>
  );
}

function CoachGridCard({ coach, index, t }: { coach: Coach; index: number; t: TFunction<"coaches"> }) {
  const rate = formatRate(coach);

  return (
    <Link to={`/coaches/${coach.id}`} className={cn(CARD_CLASS, "panel-enter flex flex-col")} style={staggerStyle(index)}>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-center gap-3.5">
          <CoachAvatar coach={coach} className="h-14 w-14 text-base" />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold leading-tight">
              {coach.name} {coach.surname}
            </p>
            {coach.title ? (
              <span className="mt-1.5 inline-flex rounded bg-accent/10 px-1.5 py-0.5 text-[11px] font-bold leading-none tracking-wide text-accent">
                {coach.title}
              </span>
            ) : null}
          </div>
        </div>

        {coach.bio ? <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{coach.bio}</p> : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
          {coach.fideRating ? (
            <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums">
              <Star className="h-3.5 w-3.5 text-accent" aria-hidden />
              {t("directory.rating", { rating: coach.fideRating })}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {t("directory.stat.years", { years: coach.experienceYears })}
          </span>
        </div>

        {coach.specialties.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {coach.specialties.map((specialty) => (
              <Badge key={specialty} variant="secondary" className="text-xs">
                {specialty}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border/70 px-5 py-3.5">
        <span className="text-sm font-semibold tabular-nums">
          {rate ? t("directory.hourlyRate", { rate }) : <span className="text-muted-foreground">—</span>}
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
          {t("directory.viewProfile")}
          <ArrowRight
            className="h-4 w-4 transition-transform duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </div>
    </Link>
  );
}

function CoachListRow({ coach, index, t }: { coach: Coach; index: number; t: TFunction<"coaches"> }) {
  const rate = formatRate(coach);
  const shownSpecialties = coach.specialties.slice(0, 2);
  const extraCount = coach.specialties.length - shownSpecialties.length;

  return (
    <Link
      to={`/coaches/${coach.id}`}
      className={cn(CARD_CLASS, "panel-enter flex flex-wrap items-center gap-x-5 gap-y-3 p-4 [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5")}
      style={staggerStyle(index)}
    >
      <CoachAvatar coach={coach} className="h-12 w-12 text-sm" />

      <div className="min-w-0 flex-1 basis-44">
        <p className="truncate font-semibold">
          {coach.name} {coach.surname}
        </p>
        <p className="truncate text-sm text-muted-foreground">{coach.title}</p>
      </div>

      <div className="flex min-w-[140px] flex-1 flex-wrap gap-1.5">
        {shownSpecialties.map((specialty) => (
          <Badge key={specialty} variant="secondary">
            {specialty}
          </Badge>
        ))}
        {extraCount > 0 ? <span className="px-0.5 py-1 text-xs text-muted-foreground">+{extraCount}</span> : null}
      </div>

      <div className="flex shrink-0 items-center gap-4 text-sm">
        {coach.fideRating ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap font-semibold tabular-nums">
            <Star className="h-3.5 w-3.5 text-accent" aria-hidden />
            {coach.fideRating}
          </span>
        ) : null}
        <span className="whitespace-nowrap text-muted-foreground">{t("directory.stat.years", { years: coach.experienceYears })}</span>
        {rate ? <span className="whitespace-nowrap font-semibold tabular-nums">{t("directory.hourlyRate", { rate })}</span> : null}
        <ArrowRight
          className="h-4 w-4 text-primary transition-transform duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
    </Link>
  );
}

function CoachSkeletons({ view }: { view: ViewMode }) {
  return (
    <div
      className={view === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-3"}
      aria-hidden
    >
      {Array.from({ length: view === "grid" ? 6 : 4 }, (_, i) => (
        <div
          key={i}
          className={cn(
            "animate-pulse rounded-xl border border-border/60 bg-card/60",
            view === "grid" ? "h-56" : "h-20",
          )}
        />
      ))}
    </div>
  );
}

export function CoachesPage() {
  const { t } = useTranslation("coaches");
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");
  const [sort, setSort] = useState<SortKey>("default");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const response = await api.get("/coaches");
        if (mounted) {
          setCoaches(response.data.coaches ?? []);
          setError("");
        }
      } catch {
        if (mounted) {
          setError(t("directory.error"));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [t]);

  const languages = useMemo(
    () => [...new Set(coaches.flatMap((coach) => coach.languages))].sort((x, y) => x.localeCompare(y)),
    [coaches],
  );

  const filteredCoaches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matches = coaches.filter(
      (coach) =>
        matchesQuery(coach, normalizedQuery) && (language === "all" || coach.languages.includes(language)),
    );
    if (sort === "rating") return [...matches].sort((x, y) => (y.fideRating ?? -1) - (x.fideRating ?? -1));
    if (sort === "experience") return [...matches].sort((x, y) => y.experienceYears - x.experienceYears);
    if (sort === "priceLow") {
      return [...matches].sort((x, y) => (x.hourlyRate ?? Number.MAX_SAFE_INTEGER) - (y.hourlyRate ?? Number.MAX_SAFE_INTEGER));
    }
    return matches;
  }, [coaches, query, language, sort]);

  const selectClass =
    "h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="relative space-y-6">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-40" aria-hidden>
        <div className="absolute -left-1/4 top-0 h-[320px] w-[320px] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[280px] w-[280px] rounded-full bg-accent/15 blur-3xl" />
      </div>

      <header className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("directory.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">{t("directory.subtitle")}</p>
      </header>

      <div>
        {loading ? <CoachSkeletons view={view} /> : null}
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error && coaches.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-10 text-center text-sm text-muted-foreground">
            {t("directory.empty")}
          </p>
        ) : null}

        {coaches.length > 0 ? (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <label htmlFor="coach-search" className="sr-only">
                  {t("directory.searchLabel")}
                </label>
                <Input
                  id="coach-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("directory.searchPlaceholder")}
                  className="pl-10"
                />
              </div>

              {languages.length > 1 ? (
                <>
                  <label htmlFor="coach-language" className="sr-only">
                    {t("directory.languageLabel")}
                  </label>
                  <select
                    id="coach-language"
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    className={selectClass}
                  >
                    <option value="all">{t("directory.languageAll")}</option>
                    {languages.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}

              <label htmlFor="coach-sort" className="sr-only">
                {t("directory.sortLabel")}
              </label>
              <select
                id="coach-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className={selectClass}
              >
                {SORT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {t(`directory.sort.${key}`)}
                  </option>
                ))}
              </select>

              <div
                role="group"
                aria-label={t("directory.viewToggleLabel")}
                className="ml-auto inline-flex gap-1 rounded-md border border-border/70 bg-secondary/70 p-1"
              >
                {(
                  [
                    { id: "grid", icon: LayoutGrid, label: t("directory.viewGrid") },
                    { id: "list", icon: List, label: t("directory.viewList") },
                  ] as const
                ).map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setView(id)}
                    aria-pressed={view === id}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-semibold transition-[transform,background-color,color,box-shadow] duration-150 ease-out active:scale-[0.96]",
                      view === id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-primary",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <p className="mb-4 text-xs font-medium text-muted-foreground" aria-live="polite">
              {t("directory.resultsCount", { count: filteredCoaches.length })}
            </p>

            {filteredCoaches.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-10 text-center text-sm text-muted-foreground">
                {query.trim() ? t("directory.searchEmpty", { query }) : t("directory.filterEmpty")}
              </p>
            ) : view === "grid" ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCoaches.map((coach, index) => (
                  <CoachGridCard key={coach.id} coach={coach} index={index} t={t} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredCoaches.map((coach, index) => (
                  <CoachListRow key={coach.id} coach={coach} index={index} t={t} />
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
