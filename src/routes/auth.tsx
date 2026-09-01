import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Flame,
  Home,
  LoaderCircle,
  Shield,
} from "lucide-react";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In | WildGuard" },
      {
        name: "description",
        content: "Sign in to the WildGuard wildfire prevention and early detection command center.",
      },
      { property: "og:title", content: "Sign In | WildGuard" },
      {
        property: "og:description",
        content: "Access real-time environmental data and wildfire intelligence in WildGuard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setMessage("Check your email to confirm your WildGuard account.");
      return;
    }
    if (!remember) window.sessionStorage.setItem("wildguard.sessionOnly", "true");
    await navigate({ to: "/" });
  }

  async function continueWithGoogle() {
    setBusy(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: { prompt: "select_account" },
    });
    if (result.error) {
      setError(result.error.message);
      setBusy(false);
      return;
    }
    if (!result.redirected) await navigate({ to: "/" });
  }

  async function resetPassword() {
    if (!email) {
      setError("Enter your email address first, then request a reset link.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (resetError) setError(resetError.message);
    else setMessage("Password reset instructions are on their way.");
  }

  function enterDemo(role: "firefighter" | "resident") {
    window.sessionStorage.setItem("wildguard.demoRole", role);
    void navigate({ to: "/" });
  }

  return (
    <main className="terrain-grid relative min-h-screen overflow-hidden bg-background px-4 py-8 sm:px-6 lg:py-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-primary/60" />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center lg:min-h-[calc(100vh-6rem)]">
        <header className="mb-7 text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full border border-primary/50 bg-primary/10 shadow-ember">
            <Flame className="size-7 text-primary" aria-hidden />
          </div>
          <h1 className="font-display text-5xl font-semibold leading-none text-foreground">WildGuard</h1>
          <p className="mt-3 font-mono text-[0.64rem] font-medium uppercase tracking-[0.16em] text-primary sm:text-xs">
            Wildfire prevention • Early detection • Smart response
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Real environmental data. AI-powered wildfire intelligence.
          </p>
        </header>

        <section className="rounded-lg border border-border bg-surface/95 p-5 shadow-panel backdrop-blur-sm sm:p-7" aria-labelledby="auth-heading">
          <div className="mb-6">
            <p className="label-eyebrow flex items-center gap-2"><Shield className="size-3.5 text-accent" aria-hidden /> Secure command access</p>
            <h2 id="auth-heading" className="mt-2 text-3xl font-semibold text-foreground">
              {mode === "signin" ? "Sign in" : "Create account"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin" ? "Welcome back. Your dashboard is waiting." : "Join the WildGuard response network."}
            </p>
          </div>

          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="email" className="font-mono text-xs uppercase text-muted-foreground">Email</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="crew@department.gov" className="h-11 border-border bg-auth-field px-3 text-foreground focus-visible:ring-primary" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="font-mono text-xs uppercase text-muted-foreground">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="h-11 border-border bg-auth-field px-3 pr-11 text-foreground focus-visible:ring-primary" />
                <Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-1 top-1 size-9 text-muted-foreground hover:bg-secondary hover:text-foreground">
                  {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                </Button>
              </div>
            </div>

            {mode === "signin" && (
              <div className="flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Checkbox id="remember" checked={remember} onCheckedChange={(checked) => setRemember(checked === true)} />
                  <Label htmlFor="remember" className="text-xs font-normal text-muted-foreground">Remember me</Label>
                </div>
                <Button type="button" variant="link" onClick={resetPassword} className="h-auto p-0 text-xs">Forgot password?</Button>
              </div>
            )}

            {error && <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">{error}</p>}
            {message && <p role="status" className="rounded-md border border-risk-low/40 bg-risk-low/10 px-3 py-2 text-xs text-risk-low">{message}</p>}

            <Button type="submit" size="lg" disabled={busy} className="h-11 w-full font-display text-base uppercase tracking-[0.08em]">
              {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Flame aria-hidden />}
              {mode === "signin" ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-border" />
            <span className="font-mono text-[0.65rem] uppercase text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button type="button" variant="outline" size="lg" disabled={busy} onClick={continueWithGoogle} className="h-11 w-full border-border bg-auth-field text-foreground hover:bg-secondary">
            <span className="grid size-5 place-items-center rounded-full border border-border font-mono text-xs font-semibold text-accent">G</span>
            Continue with Google
          </Button>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <Button type="button" variant="link" className="h-auto p-0" onClick={() => { setMode((current) => current === "signin" ? "signup" : "signin"); setError(null); setMessage(null); }}>
              {mode === "signin" ? "Create an account" : "Sign in"}
            </Button>
          </p>
        </section>

        <section className="mt-4 rounded-lg border border-border bg-surface/70 p-4 backdrop-blur-sm" aria-labelledby="demo-heading">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 id="demo-heading" className="label-eyebrow text-foreground">Demo access</h2>
              <p className="mt-1 text-xs text-muted-foreground">Explore WildGuard without creating an account.</p>
            </div>
            <span className="live-dot mt-1.5" aria-hidden />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={() => enterDemo("firefighter")} className="h-10 border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary">
              <Flame aria-hidden /> Continue as Firefighter
            </Button>
            <Button type="button" variant="outline" onClick={() => enterDemo("resident")} className="h-10 border-accent/50 bg-accent/10 text-accent hover:bg-accent/20 hover:text-accent">
              <Home aria-hidden /> Continue as Resident
            </Button>
          </div>
        </section>

        <Link to="/" className="mx-auto mt-5 inline-flex items-center gap-1.5 font-mono text-[0.65rem] uppercase text-muted-foreground transition-colors hover:text-foreground">
          View live public console <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>
    </main>
  );
}