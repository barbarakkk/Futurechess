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
import { getSafeRedirect } from "../lib/redirect";
import { hydratePreferencesFromServer } from "../components/PreferencesHydrator";
import { useAuthStore, type AuthUser } from "../store/authStore";

type LoginForm = {
  email: string;
  password: string;
};

export function LoginPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = getSafeRedirect(searchParams.get("redirect"));
  const setAuth = useAuthStore((state) => state.setAuth);
  const [form, setForm] = useState<LoginForm>({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await api.post("/auth/login", form);
      const payload = response.data as { token: string; user: AuthUser };
      setAuth(payload.token, payload.user);
      await hydratePreferencesFromServer().catch(() => {});
      navigate(redirectTo || "/dashboard");
    } catch (requestError: any) {
      setError(getApiErrorMessage(requestError, t("login.loginFailed")));
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
              {t("login.title")}
            </CardTitle>
            <CardDescription>
              {t("login.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="login-email" className="text-sm font-medium">
                  {t("email")}
                </label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className="text-sm font-medium">
                    {t("password")}
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {t("forgotPassword.link")}
                  </Link>
                </div>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }))
                  }
                />
              </div>

              {error ? (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("login.signingIn") : t("signIn")}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {t("login.newHere")}{" "}
              <Link
                to={redirectTo ? `/register?redirect=${encodeURIComponent(redirectTo)}` : "/register"}
                className="font-medium text-primary hover:underline"
              >
                {t("createAccount")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
