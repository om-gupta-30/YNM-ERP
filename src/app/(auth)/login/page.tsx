"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const { currentUser, isLoading, login, authError } = useAuth();

  const [credential, setCredential] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPw, setShowPw] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (currentUser) router.replace("/dashboard");
  }, [currentUser, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(credential.trim(), password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    }
  }

  return (
    <div className="space-y-6" style={{ animation: "fade-in 0.4s ease-out" }}>
      {/* Brand */}
      <div className="text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 text-lg font-bold tracking-wide text-gold-950 shadow-lg shadow-gold-500/25">
          Y
        </div>
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-stone-900">
          YNM Safety ERP
        </h1>
        <p className="mt-1 text-[13px] text-stone-500">
          Sign in to continue
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xl shadow-stone-200/40">
        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div className="ds-field">
            <label className="ds-label">Email</label>
            <input
              type="text"
              className="ds-input"
              autoComplete="username"
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              placeholder="you@ynmsafety.com"
              required
            />
          </div>

          <div className="ds-field">
            <label className="ds-label">Password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                className="ds-input pr-14"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-xs font-medium text-stone-400 transition-colors duration-200 hover:text-gold-600"
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {authError ? (
            <div className="ds-alert-warning">{authError}</div>
          ) : null}

          {error ? (
            <div className="ds-alert-error">{error}</div>
          ) : null}

          <Button className="w-full" type="submit" disabled={isLoading}>
            {isLoading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>

      <p className="text-center text-xs text-stone-400">
        YNM Safety Pvt. Ltd. — Internal use only
      </p>
    </div>
  );
}
