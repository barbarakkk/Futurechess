import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GraduationCap, Sparkles, Star } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { api } from "../lib/api";
import { formatHourlyRate } from "../lib/utils";

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

export function CoachesPage() {
  const { t } = useTranslation("coaches");
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {coaches.map((coach) => (
              <Card key={coach.id} className="flex flex-col border-border/80 bg-card/80 backdrop-blur-sm">
                <CardContent className="flex flex-1 flex-col gap-4 p-6">
                  <div className="flex items-center gap-3">
                    {coach.photoUrl ? (
                      <img
                        src={coach.photoUrl}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary">
                        <GraduationCap className="h-6 w-6 text-primary" aria-hidden />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {coach.name} {coach.surname}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{coach.title}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{t("directory.experience", { years: coach.experienceYears })}</Badge>
                    {coach.fideRating ? (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Star className="h-3 w-3" aria-hidden />
                        {t("directory.rating", { rating: coach.fideRating })}
                      </Badge>
                    ) : null}
                    {coach.hourlyRate ? (
                      <Badge variant="outline">
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
                      <Button type="button" className="w-full">
                        {t("directory.viewProfile")}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
