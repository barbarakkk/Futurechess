import { Settings, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

export function SettingsPage() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-40" aria-hidden>
        <div className="absolute right-0 top-32 h-[200px] w-[300px] rounded-full bg-accent/10 blur-3xl" />
      </div>

      <section className="space-y-6">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
            Coming soon
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary">
              <Settings className="h-6 w-6 text-primary" aria-hidden />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Settings</h1>
              <p className="text-sm text-muted-foreground">
                Account and gameplay preferences — under construction.
              </p>
            </div>
          </div>
        </header>

        <Card className="border-border/80 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Placeholder</CardTitle>
            <CardDescription>
              Notifications, board theme, and profile options will be configurable here later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              No settings to change yet; your session and game behavior use ChessHub defaults.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
