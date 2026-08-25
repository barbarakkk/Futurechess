import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, Crown, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { api } from "../lib/api";

type ResultState =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "alreadyResponded"; status: string }
  | { kind: "approved" }
  | { kind: "rejected" };

export function CoachApplicationResponsePage() {
  const { t } = useTranslation("becomeCoach");
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState<ResultState>({ kind: "loading" });

  useEffect(() => {
    const id = searchParams.get("id");
    const token = searchParams.get("token");
    const action = searchParams.get("action");

    if (!id || !token || (action !== "approve" && action !== "reject")) {
      setResult({ kind: "invalid" });
      return;
    }

    let mounted = true;

    async function respond() {
      try {
        const response = await api.post(`/coach-applications/${id}/respond`, { token, action });
        if (!mounted) {
          return;
        }
        if (response.data.alreadyResponded) {
          setResult({ kind: "alreadyResponded", status: response.data.application.status });
        } else {
          setResult({ kind: response.data.application.status === "approved" ? "approved" : "rejected" });
        }
      } catch {
        if (mounted) {
          setResult({ kind: "invalid" });
        }
      }
    }

    respond();

    return () => {
      mounted = false;
    };
  }, [searchParams]);

  const content = (() => {
    switch (result.kind) {
      case "loading":
        return { icon: null, title: t("response.loading"), body: "" };
      case "invalid":
        return {
          icon: <X className="h-6 w-6 text-red-600" aria-hidden />,
          title: t("response.invalidTitle"),
          body: t("response.invalidBody"),
        };
      case "alreadyResponded":
        return {
          icon: <Check className="h-6 w-6 text-primary" aria-hidden />,
          title: t("response.alreadyRespondedTitle"),
          body: t("response.alreadyRespondedBody", {
            status: t(`response.statusLabel.${result.status}` as const, result.status),
          }),
        };
      case "approved":
        return {
          icon: <Check className="h-6 w-6 text-emerald-400" aria-hidden />,
          title: t("response.approvedTitle"),
          body: t("response.approvedBody"),
        };
      case "rejected":
        return {
          icon: <X className="h-6 w-6 text-muted-foreground" aria-hidden />,
          title: t("response.rejectedTitle"),
          body: t("response.rejectedBody"),
        };
    }
  })();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <Card className="w-full max-w-md border-border/80 bg-card/80 backdrop-blur-sm">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
            <Crown className="h-5 w-5 text-[#D4AF37]" aria-hidden />
          </span>
          {content.icon}
          <h1 className="text-xl font-semibold tracking-tight">{content.title}</h1>
          {content.body ? <p className="text-sm text-muted-foreground">{content.body}</p> : null}
          <Link to="/">
            <Button type="button" variant="secondary" className="mt-2">
              {t("response.backHome")}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
