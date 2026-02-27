"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoading, currentUser } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!currentUser) router.replace("/login");
  }, [currentUser, isLoading, router]);

  if (isLoading || !currentUser) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="text-sm text-stone-600">Loading…</div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}

