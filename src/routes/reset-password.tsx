import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { Eye, EyeOff, Flame, KeyRound, LoaderCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password | WildGuard" },
      {
        name: "description",
        content: "Set a new password for your WildGuard command center account.",
      },
      { property: "og:title", content: "Reset Password | WildGuard" },
      {
        property: "og:description",
        content: "Securely restore access to the WildGuard wildfire monitoring dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await navigate({ to: "/" });
  }

  return (
    <main className="terrain-grid relative min-h-screen overflow-hidden bg-background px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-primary/60" />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <header className="mb-7 text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full border border-primary/50 bg-primary/10 shadow-ember">
            <Flame className="size-7 text-primary" aria-hidden />
          </div>
          <h1 className="font-display text-5xl font-semibold leading-none text-foreground">WildGuard</h1>
          <p className="mt-3 font-mono text-[0.64rem] font-medium uppercase tracking-[0.16em] text-primary sm:text-xs">
            Secure command access
          </p>
        </header>

        <section className="rounded-lg border border-border bg-surface/95 p-5 shadow-panel backdrop-blur-sm sm:p-7" aria-labelledby="reset-heading">
          <KeyRound className="mb-4 size-6 text-accent" aria-hidden />
          <h2 id="reset-heading" className="text-3xl font-semibold text-foreground">Set a new password</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose a secure password for your WildGuard account.</p>

          <form className="mt-6 space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="new-password" className="font-mono text-xs uppercase text-muted-foreground">New password</Label>
              <div className="relative">
                <Input id="new-password" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 border-border bg-auth-field px-3 pr-11 text-foreground focus-visible:ring-primary" />
                <Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-1 top-1 size-9 text-muted-foreground hover:bg-secondary hover:text-foreground">
                  {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="font-mono text-xs uppercase text-muted-foreground">Confirm password</Label>
              <Input id="confirm-password" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-11 border-border bg-auth-field px-3 text-foreground focus-visible:ring-primary" />
            </div>
            {error && <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">{error}</p>}
            <Button type="submit" size="lg" disabled={busy} className="h-11 w-full font-display text-base uppercase tracking-[0.08em]">
              {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
              Update password
            </Button>
          </form>
        </section>

        <Button asChild variant="link" className="mx-auto mt-5">
          <Link to="/auth">Return to sign in</Link>
        </Button>
      </div>
    </main>
  );
}