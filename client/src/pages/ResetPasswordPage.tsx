import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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

export function ResetPasswordPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError(t("resetPassword.tooShortError"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("resetPassword.mismatchError"));
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setSubmitted(true);
    } catch (requestError: any) {
      setError(getApiErrorMessage(requestError, t("resetPassword.resetFailed")));
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
              {t("resetPassword.title")}
            </CardTitle>
            <CardDescription>
              {submitted ? "" : t("resetPassword.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!token ? (
              <p className="text-sm text-red-600" role="alert">
                {t("resetPassword.invalidLink")}
              </p>
            ) : submitted ? (
              <div className="space-y-4 text-center">
                <p className="text-sm font-medium">{t("resetPassword.successTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("resetPassword.successBody")}</p>
                <Button type="button" className="w-full" onClick={() => navigate("/login")}>
                  {t("resetPassword.goToLogin")}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="reset-password-new" className="text-sm font-medium">
                    {t("resetPassword.newPassword")}
                  </label>
                  <Input
                    id="reset-password-new"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t("resetPassword.passwordHint")}</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="reset-password-confirm" className="text-sm font-medium">
                    {t("resetPassword.confirmPassword")}
                  </label>
                  <Input
                    id="reset-password-confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </div>

                {error ? (
                  <p className="text-sm text-red-600" role="alert">
                    {error}
                  </p>
                ) : null}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t("resetPassword.resetting") : t("resetPassword.resetButton")}
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
