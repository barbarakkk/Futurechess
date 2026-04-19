import { Link } from "react-router-dom";
import { Crown, Sparkles, Swords, Zap } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { useAuthStore } from "../store/authStore";

export function LandingPage() {
  const token = useAuthStore((state) => state.token);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
      >
        <div className="absolute -left-1/4 top-0 h-[420px] w-[420px] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[380px] w-[380px] rounded-full bg-accent/15 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-border/80 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
              <Crown className="h-5 w-5 text-primary" aria-hidden />
            </span>
            ChessHub
          </div>
          <div className="flex items-center gap-3">
            {token ? (
              <Link to="/dashboard">
                <Button size="sm" type="button">
                  Open app
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm" type="button">
                    Sign in
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" type="button">
                    Create account
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-16 md:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            Realtime play · Stockfish AI · Invite links
          </div>
          <h1 className="bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl md:text-6xl">
            Play chess with friends, anytime
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Jump into rated-style friend games with server clocks, or practice
            against the engine — same rules, one clean experience.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            {token ? (
              <>
                <Link to="/dashboard">
                  <Button size="lg" className="min-w-[180px]" type="button">
                    Open dashboard
                  </Button>
                </Link>
                <Link to="/new-game">
                  <Button size="lg" variant="secondary" className="min-w-[180px]" type="button">
                    New friend game
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/register">
                  <Button size="lg" className="min-w-[180px]" type="button">
                    Get started
                  </Button>
                </Link>
                <Link to="/login">
                  <Button size="lg" variant="secondary" className="min-w-[180px]" type="button">
                    I have an account
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="mt-20 grid gap-4 md:grid-cols-3">
          <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-6 pt-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <Swords className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <h2 className="text-base font-semibold">Friend games</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Create a room, share the link, and play live with clocks synced on
                the server.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-6 pt-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <Zap className="h-5 w-5 text-accent" aria-hidden />
              </div>
              <h2 className="text-base font-semibold">Play vs AI</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Open a new AI game, pick your side, and get moves powered by
                Stockfish.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-6 pt-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <Crown className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <h2 className="text-base font-semibold">Your dashboard</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Track stats and jump back into recent games from one hub after you
                sign in.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
