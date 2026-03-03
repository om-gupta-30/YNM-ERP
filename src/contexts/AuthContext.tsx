"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { FactoryCode, User, UserRole } from "@/lib/types";
import { authService } from "@/lib/services/authService";
import { logAudit } from "@/lib/auditLogger";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export type CurrentUser = Omit<User, "password"> & {
  role: UserRole;
  factory: FactoryCode;
};

type AuthContextValue = {
  isLoading: boolean;
  currentUser: CurrentUser | null;
  role: UserRole | null;
  factory: FactoryCode | null;
  authError: string | null;
  login: (username: string, password: string) => Promise<void>;
  signup: (params: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  setRole: (role: UserRole) => Promise<void>;
  setFactory: (factory: FactoryCode) => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toCurrentUser(
  user: User,
  overrides?: { roleOverride?: UserRole; factoryOverride?: FactoryCode },
): CurrentUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...safe } = user;
  return {
    ...safe,
    role: overrides?.roleOverride ?? user.role,
    factory: overrides?.factoryOverride ?? user.factory,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [user, session] = await Promise.all([
        authService.getCurrentUser(),
        authService.getSession(),
      ]);
      setCurrentUser(user ? toCurrentUser(user, session ?? undefined) : null);
      setAuthError(null);
    } catch (err) {
      setCurrentUser(null);
      setAuthError(err instanceof Error ? err.message : "Authentication error.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const {
      data: { subscription },
    } = getSupabaseBrowserClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setCurrentUser(null);
        setIsLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const user = await authService.login(username, password);
      const session = await authService.getSession();
      setCurrentUser(toCurrentUser(user, session ?? undefined));
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signup = useCallback(
    async ({ name, email, password }: { name: string; email: string; password: string }) => {
      setIsLoading(true);
      setAuthError(null);
      try {
        const user = await authService.signup(name, email, password);
        const session = await authService.getSession();
        setCurrentUser(toCurrentUser(user, session ?? undefined));
      } catch (err) {
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    if (currentUser) {
      logAudit({
        userId: currentUser.id,
        userName: currentUser.name,
        action: "LOGOUT",
        module: "Auth",
        factory: currentUser.factory,
      });
    }
    await authService.logout();
    setCurrentUser(null);
    setAuthError(null);
  }, [currentUser]);

  const setRole = useCallback(
    async (role: UserRole) => {
      await authService.setRoleOverride(role);
      await refresh();
    },
    [refresh],
  );

  const setFactory = useCallback(
    async (factory: FactoryCode) => {
      await authService.setFactoryOverride(factory);
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      currentUser,
      role: currentUser?.role ?? null,
      factory: currentUser?.factory ?? null,
      authError,
      login,
      signup,
      logout,
      setRole,
      setFactory,
      refresh,
    }),
    [authError, currentUser, isLoading, login, signup, logout, refresh, setFactory, setRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
