import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Clock, LayoutGrid, List, Search, Sparkles, Star, Wallet } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { api } from "../lib/api";
import { cn, formatHourlyRate } from "../lib/utils";

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
        className={cn(className, "shrink-0 rounded-full object-cover ring-2 ring-white")}
      />
    );
  }
  return (
    <span
      className={cn(
        className,
        avatarBgClass(coach.id),
        "flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white",
      )}
      aria-hidden
    >
      {initialsOf(coach.name, coach.surname)}
    </span>
  );
}

function CoachGridCard({ coach, t }: { coach: Coach; t: TFunction<"coaches"> }) {
  return (
    <Card className="flex flex-col border-border/80 bg-card/80 backdrop-blur-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:border-primary/35 hover:shadow-soft">
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <CoachAvatar coach={coach} className="h-14 w-14 text-base" />
          <div className="min-w-0 flex-grow">
            <p className="truncate font-semibold">
              {coach.name} {coach.surname}
            </p>
            <p className="truncate text-sm text-muted-foreground">{coach.title}</p>
          </div>
          {coach.fideRating ? (
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent">
              <Star className="h-3 w-3" aria-hidden />
              {t("directory.rating", { rating: coach.fideRating })}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="gap-1.5 font-medium">
            <Clock className="h-3 w-3" aria-hidden />
            {t("directory.experience", { years: coach.experienceYears })}
          </Badge>
          {coach.hourlyRate ? (
            <Badge variant="secondary" className="gap-1.5 font-bold text-foreground">
              <Wallet className="h-3 w-3" aria-hidden />
              {t("directory.hourlyRate", {
                rate: formatHourlyRate(coach.hourlyRate, coach.hourlyRateCurrency),
              })}
            </Badge>
          ) : null}
        </div>

        {coach.specialties.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {coach.specialties.map((specialty) => (
              <Badge key={specialty} variant="secondary">
                {specialty}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="mt-auto pt-2">
          <Link to={`/coaches/${coach.id}`}>
            <Button
              type="button"
              className="w-full transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              {t("directory.viewProfile")}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function CoachListRow({ coach, t }: { coach: Coach; t: TFunction<"coaches"> }) {
  const shownSpecialties = coach.specialties.slice(0, 2);
  const extraCount = coach.specialties.length - shownSpecialties.length;

  return (
    <Card className="border-border/80 bg-card/80 backdrop-blur-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-soft">
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        <CoachAvatar coach={coach} className="h-12 w-12 text-sm" />

        <div className="w-44 shrink-0 min-w-0">
          <p className="truncate font-semibold">
            {coach.name} {coach.surname}
          </p>
          <p className="truncate text-sm text-muted-foreground">{coach.title}</p>
        </div>

        <div className="flex min-w-[140px] flex-grow flex-wrap gap-1.5">
          {shownSpecialties.map((specialty) => (
            <Badge key={specialty} variant="secondary">
              {specialty}
            </Badge>
          ))}
          {extraCount > 0 ? (
            <span className="px-0.5 py-1 text-xs text-muted-foreground">+{extraCount}</span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {coach.fideRating ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent">
              <Star className="h-3 w-3" aria-hidden />
              {t("directory.rating", { rating: coach.fideRating })}
            </span>
          ) : null}
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {t("directory.experience", { years: coach.experienceYears })}
          </span>
          {coach.hourlyRate ? (
            <span className="whitespace-nowrap text-sm font-bold">
              {t("directory.hourlyRate", {
                rate: formatHourlyRate(coach.hourlyRate, coach.hourlyRateCurrency),
              })}
            </span>
          ) : null}
        </div>

        <Link to={`/coaches/${coach.id}`} className="shrink-0">
          <Button
            type="button"
            size="sm"
            className="transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            {t("directory.viewProfile")}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export function CoachesPage() {
  const { t } = useTranslation("coaches");
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [query, setQuery] = useState("");

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

  const filteredCoaches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return coaches.filter((coach) => matchesQuery(coach, normalizedQuery));
  }, [coaches, query]);

  return (
    <div className="relative space-y-8">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-40" aria-hidden>
        <div className="absolute -left-1/4 top-0 h-[320px] w-[320px] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[280px] w-[280px] rounded-full bg-accent/15 blur-3xl" />
      </div>

      <div className="max-w-2xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
          {t("directory.badge")}
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("directory.title")}</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">{t("directory.subtitle")}</p>
      </div>

      <div>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("directory.loading")}</p>
        ) : null}
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error && coaches.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("directory.empty")}</p>
        ) : null}

        {coaches.length > 0 ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-border/70 bg-card/70 p-3 shadow-soft backdrop-blur-md">
              <div className="relative min-w-[240px] max-w-sm flex-1">
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

              <div
                role="group"
                aria-label={t("directory.viewToggleLabel")}
                className="ml-auto inline-flex gap-1 rounded-md border border-border/70 bg-secondary/70 p-1"
              >
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  aria-pressed={view === "grid"}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-sm px-3.5 py-2 text-sm font-semibold transition-all duration-150 ease-out active:scale-[0.96]",
                    view === "grid"
                      ? "bg-white text-primary shadow-sm"
                      : "text-muted-foreground hover:text-primary",
                  )}
                >
                  <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
                  {t("directory.viewGrid")}
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  aria-pressed={view === "list"}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-sm px-3.5 py-2 text-sm font-semibold transition-all duration-150 ease-out active:scale-[0.96]",
                    view === "list"
                      ? "bg-white text-primary shadow-sm"
                      : "text-muted-foreground hover:text-primary",
                  )}
                >
                  <List className="h-3.5 w-3.5" aria-hidden />
                  {t("directory.viewList")}
                </button>
              </div>
            </div>

            <p className="mb-4 pl-1 text-xs text-muted-foreground">
              {t("directory.resultsCount", { count: filteredCoaches.length })}
            </p>

            {filteredCoaches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("directory.searchEmpty", { query })}
              </p>
            ) : view === "grid" ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCoaches.map((coach) => (
                  <CoachGridCard key={coach.id} coach={coach} t={t} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredCoaches.map((coach) => (
                  <CoachListRow key={coach.id} coach={coach} t={t} />
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
