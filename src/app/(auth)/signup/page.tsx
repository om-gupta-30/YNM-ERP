"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function SignupPage() {
  const router = useRouter();
  const { currentUser, isLoading, signup } = useAuth();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (currentUser) router.replace("/dashboard");
  }, [currentUser, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await signup({ name, email, password });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-lg bg-zinc-900 text-sm font-semibold text-white">
          YNM
        </div>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-zinc-950">
          Create account
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Mock signup (stored locally in your browser)
        </p>
      </div>

      <Card className="p-5">
        <form className="space-y-4" onSubmit={onSubmit}>
          <Input
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error ? (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
              {error}
            </div>
          ) : null}

          <Button className="w-full" type="submit" disabled={isLoading}>
            {isLoading ? "Creating…" : "Create account"}
          </Button>
        </form>

        <div className="mt-4 text-sm">
          <Link href="/login" className="text-zinc-700 hover:underline">
            Back to sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}

