import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Crown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { api } from "../lib/api";
import { getApiErrorMessage } from "../lib/errors";

export function ForgotPasswordPage() {
  const { t } = useTranslation("auth");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      // The server returns the same generic message whether or not the email is
      // registered, so success here never reveals which emails have accounts.
      await api.post("/auth/forgot-password", { email });
      setSubmitted(true);
    } catch (requestError: any) {
      setError(getApiErrorMessage(requestError, t("forgotPassword.sendFailed")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-50" aria-hidden>
        <div className="absolute left-1/2 top-0 h-[320px] w-[480px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
        <div className="mb-8 flex justify-center">
          <Link
            to="/"
            className="flex items-center gap-2 font-semibold tracking-tight text-foreground hover:opacity-90"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <Crown className="h-5 w-5 text-[#D4AF37]" aria-hidden />
            </span>
            FutureChess
          </Link>
        </div>

        <Card className="border-border/80 shadow-soft">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {t("forgotPassword.title")}
            </CardTitle>
            <CardDescription>
              {submitted ? "" : t("forgotPassword.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="space-y-4 text-center">
                <p className="text-sm font-medium">{t("forgotPassword.successTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("forgotPassword.successBody")}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="forgot-password-email" className="text-sm font-medium">
                    {t("email")}
                  </label>
                  <Input
                    id="forgot-password-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>

                {error ? (
                  <p className="text-sm text-red-600" role="alert">
                    {error}
                  </p>
                ) : null}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t("forgotPassword.sending") : t("forgotPassword.sendLink")}
                </Button>
              </form>
            )}

            <p className="mt-6 text-center text-sm text-muted-foreground">
              <Link to="/login" className="font-medium text-primary hover:underline">
                {t("forgotPassword.backToLogin")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
