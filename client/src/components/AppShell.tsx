import { useEffect, useState } from "react";
import {
  Cpu,
  Crown,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  PartyPopper,
  Settings,
  Sparkles,
  Swords,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { usePreferencesStore } from "../store/preferencesStore";

export function AppShell() {
  const { t } = useTranslation("appShell");
  const [open, setOpen] = useState(false);
  const [showCoachWelcome, setShowCoachWelcome] = useState(false);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const clearPreferences = usePreferencesStore((state) => state.clearPreferences);
  const navigate = useNavigate();

  // The JWT/user in the store is only as fresh as the last login — a coach application
  // getting approved happens out-of-band (the site owner clicks a link in an email), so the
  // client never hears about the role change until it re-checks. Refetching /auth/me here
  // (the shared layout for every protected route) means any hard refresh picks it up. Store
  // role is still "player" but the server says "coach" exactly once, right after approval —
  // that mismatch is what triggers the one-time welcome modal below, no extra "seen" flag needed.
  useEffect(() => {
    let cancelled = false;

    async function refreshUser() {
      try {
        const response = await api.get("/auth/me");
        const freshUser = response.data.user;
        if (cancelled || !freshUser) return;

        if (user?.role === "player" && freshUser.role === "coach") {
          setShowCoachWelcome(true);
        }
        setUser(freshUser);
      } catch {
        // Best-effort — if this fails the store just keeps its last-known user.
      }
    }

    refreshUser();
    return () => {
      cancelled = true;
    };
    // Intentionally only on mount (i.e. once per hard refresh / app load), not on every
    // `user` change — this effect is what *produces* user updates, so re-running it on
    // `user` changes would refetch in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navItems = [
    { to: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { to: "/new-game", label: t("nav.playVsFriend"), icon: Swords },
    { to: "/ai-game/new", label: t("nav.playVsAi"), icon: Cpu },
    { to: "/game-history", label: t("nav.gameHistory"), icon: History },
    { to: "/coaches", label: t("nav.coaches"), icon: GraduationCap },
    user?.role === "coach"
      ? { to: "/coach/dashboard", label: t("nav.coachDashboard"), icon: Sparkles }
      : { to: "/become-a-coach", label: t("nav.becomeCoach"), icon: Sparkles },
    { to: "/settings", label: t("nav.settings"), icon: Settings },
  ];

  function handleSignOut() {
    clearAuth();
    clearPreferences();
    navigate("/login");
  }

  function handleGoToCoachDashboard() {
    setShowCoachWelcome(false);
    navigate("/coach/dashboard");
  }

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {showCoachWelcome ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-900/40 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm border-border/80 bg-card shadow-soft" role="alertdialog" aria-modal="true">
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <PartyPopper className="h-6 w-6 text-primary" aria-hidden />
              </span>
              <h2 className="text-lg font-semibold">{t("coachWelcome.title")}</h2>
              <p className="text-sm text-muted-foreground">{t("coachWelcome.body")}</p>
              <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowCoachWelcome(false)}>
                  {t("coachWelcome.dismiss")}
                </Button>
                <Button type="button" className="flex-1" onClick={handleGoToCoachDashboard}>
                  {t("coachWelcome.cta")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {open ? (
        <button
          type="button"
          aria-label={t("closeNavigation")}
          className="fixed inset-0 z-30 bg-blue-900/25 backdrop-blur-[1px] md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        id="app-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-border bg-card shadow-soft backdrop-blur-md transition-transform duration-200 ease-out md:static md:z-0 md:translate-x-0 md:shadow-none",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
            <Crown className="h-5 w-5 text-[#D4AF37]" aria-hidden />
          </span>
          <strong className="text-base font-semibold tracking-tight">FutureChess</strong>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )
              }
              onClick={() => setOpen(false)}
            >
              <item.icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <p className="mb-2 truncate px-1 text-xs text-muted-foreground">
            {user?.username ?? t("playerFallback")}
          </p>
          <LanguageSwitcher className="mb-2" />
          <Button
            type="button"
            variant="secondary"
            className="w-full gap-2"
            size="sm"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {t("signOut")}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur-md md:hidden">
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-9 shrink-0 p-0"
            aria-expanded={open}
            aria-controls="app-sidebar"
            onClick={() => setOpen((prev) => !prev)}
          >
            <Menu className="h-5 w-5" aria-hidden />
            <span className="sr-only">{t("toggleMenu")}</span>
          </Button>
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <Crown className="h-5 w-5 text-[#D4AF37]" aria-hidden />
            FutureChess
          </span>
        </header>

        <main
          id="app-main-content"
          className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 md:px-6"
          onClick={() => open && setOpen(false)}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
