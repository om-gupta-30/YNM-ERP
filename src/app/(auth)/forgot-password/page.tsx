"use client";

import Link from "next/link";
import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-lg bg-zinc-900 text-sm font-semibold text-white">
          YNM
        </div>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-zinc-950">
          Reset password
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Mock flow (no emails are actually sent)
        </p>
      </div>

      <Card className="p-5">
        {sent ? (
          <div className="space-y-3">
            <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">
              If an account exists for <span className="font-mono">{email}</span>,
              password reset instructions would be sent.
            </div>
            <Link href="/login" className="text-sm text-zinc-700 hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <Input
              label="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button className="w-full" type="submit">
              Send reset link
            </Button>
            <div className="text-sm">
              <Link href="/login" className="text-zinc-700 hover:underline">
                Back to sign in
              </Link>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}

