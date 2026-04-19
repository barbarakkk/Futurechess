import { useState } from "react";
import {
  Cpu,
  Crown,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Swords,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { useAuthStore } from "../store/authStore";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/new-game", label: "Play vs Friend", icon: Swords },
  { to: "/ai-game/new", label: "Play vs AI", icon: Cpu },
  { to: "/game-history", label: "Game History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const [open, setOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const navigate = useNavigate();

  function handleSignOut() {
    clearAuth();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-[1px] md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        id="app-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-border bg-card/95 shadow-xl shadow-black/20 backdrop-blur-md transition-transform duration-200 ease-out md:static md:z-0 md:translate-x-0 md:shadow-none",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
            <Crown className="h-5 w-5 text-primary" aria-hidden />
          </span>
          <strong className="text-base font-semibold tracking-tight">ChessHub</strong>
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
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
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
            {user?.username ?? "Player"}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="w-full gap-2"
            size="sm"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md md:hidden">
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-9 shrink-0 p-0"
            aria-expanded={open}
            aria-controls="app-sidebar"
            onClick={() => setOpen((prev) => !prev)}
          >
            <Menu className="h-5 w-5" aria-hidden />
            <span className="sr-only">Toggle menu</span>
          </Button>
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <Crown className="h-5 w-5 text-primary" aria-hidden />
            ChessHub
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
