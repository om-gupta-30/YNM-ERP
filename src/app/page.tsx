"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const router = useRouter();
  const { isLoading, currentUser } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    router.replace(currentUser ? "/dashboard" : "/login");
  }, [currentUser, isLoading, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="text-sm text-stone-600">Loading…</div>
    </div>
  );
}
