import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Clock, GraduationCap, Star } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { AvailabilityCalendar } from "../components/AvailabilityCalendar";
import { api } from "../lib/api";
import { getApiStatusCode } from "../lib/errors";
import { formatHourlyRate } from "../lib/utils";

type Slot = {
  id: string;
  startTime: string;
  endTime: string;
};

type CoachDetail = {
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
  availability: Slot[];
};

export function CoachDetailPage() {
  const { t } = useTranslation("coaches");
  const { coachId } = useParams();
  const [coach, setCoach] = useState<CoachDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (!coachId) {
      return;
    }
    try {
      const response = await api.get(`/coaches/${coachId}`);
      setCoach(response.data.coach);
      setNotFound(false);
      setLoadError(false);
    } catch (error) {
      if (getApiStatusCode(error) === 404) {
        setNotFound(true);
      } else {
        setLoadError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleBook(slotId: string) {
    if (!coachId) {
      return;
    }

    setBookingSlotId(slotId);
    setMessage(null);

    try {
      await api.post(`/coaches/${coachId}/slots/${slotId}/book`, note.trim() ? { note: note.trim() } : {});
      setNote("");
      setCoach((prev) =>
        prev ? { ...prev, availability: prev.availability.filter((slot) => slot.id !== slotId) } : prev,
      );
      setMessage({
        type: "success",
        text: t("detail.bookSuccess", { name: coach ? `${coach.name} ${coach.surname}` : "" }),
      });
    } catch (error) {
      if (getApiStatusCode(error) === 409) {
        setMessage({ type: "error", text: t("detail.bookConflict") });
        load();
      } else {
        setMessage({ type: "error", text: t("detail.bookError") });
      }
    } finally {
      setBookingSlotId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        to="/coaches"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("detail.backLink")}
      </Link>

      {loading ? <p className="text-sm text-muted-foreground">{t("detail.loading")}</p> : null}
      {notFound ? <p className="text-sm text-muted-foreground">{t("detail.notFound")}</p> : null}
      {loadError ? (
        <p className="text-sm text-red-600" role="alert">
          {t("detail.error")}
        </p>
      ) : null}

      {coach ? (
        <div className="space-y-6">
          <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
              {coach.photoUrl ? (
                <img
                  src={coach.photoUrl}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <GraduationCap className="h-8 w-8 text-primary" aria-hidden />
                </span>
              )}
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    {coach.name} {coach.surname}
                  </h1>
                  <p className="text-muted-foreground">{coach.title}</p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">
                    {t("detail.experienceLabel")}: {t("detail.experienceValue", { years: coach.experienceYears })}
                  </Badge>
                  {coach.fideRating ? (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Star className="h-3 w-3" aria-hidden />
                      {t("detail.ratingLabel")}: {coach.fideRating}
                    </Badge>
                  ) : null}
                  {coach.hourlyRate ? (
                    <Badge variant="outline">
                      {t("detail.hourlyRateLabel")}: {formatHourlyRate(coach.hourlyRate, coach.hourlyRateCurrency)}
                    </Badge>
                  ) : null}
                </div>

                {coach.bio ? <p className="text-sm leading-relaxed text-muted-foreground">{coach.bio}</p> : null}

                {coach.specialties.length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      {t("detail.specialtiesLabel")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {coach.specialties.map((specialty) => (
                        <Badge key={specialty} variant="secondary">
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {coach.languages.length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      {t("detail.languagesLabel")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {coach.languages.map((language) => (
                        <Badge key={language} variant="secondary">
                          {language}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-primary" aria-hidden />
                {t("detail.availabilityTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {message ? (
                <p
                  className={`text-sm ${message.type === "success" ? "text-emerald-600" : "text-red-600"}`}
                  role="alert"
                >
                  {message.text}
                </p>
              ) : null}

              <div className="space-y-1.5">
                <label htmlFor="booking-note" className="text-xs font-medium text-muted-foreground">
                  {t("detail.noteLabel")}
                </label>
                <textarea
                  id="booking-note"
                  rows={2}
                  maxLength={500}
                  placeholder={t("detail.notePlaceholder")}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>

              <AvailabilityCalendar
                availability={coach.availability}
                bookingSlotId={bookingSlotId}
                onBook={handleBook}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
