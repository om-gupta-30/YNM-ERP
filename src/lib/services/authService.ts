import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { FactoryCode, User, UserRole } from "@/lib/types";
import { readJson, writeJson, removeKey } from "@/lib/storage";
import { logAudit } from "@/lib/auditLogger";

// ── Override session ──────────────────────────────────────────────────────
// Role / factory overrides from the header switcher are stored in localStorage
// independently of the Supabase session so they survive token refreshes.
const OVERRIDE_KEY = "ynm_erp_overrides_v2";

type OverrideSession = {
  roleOverride?: UserRole;
  factoryOverride?: FactoryCode;
};

export type AuthSession = {
  userId: string;
  roleOverride?: UserRole;
  factoryOverride?: FactoryCode;
};

// ── app_users row shape ────────────────────────────────────────────────────

type AppUserRow = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  factory_id: string | null;
  is_active: boolean;
};

// ── Discriminated result for profile lookup ────────────────────────────────

type AppUserResult =
  | { status: "ok"; row: AppUserRow }
  | { status: "not_found" }
  | { status: "inactive"; row: Pick<AppUserRow, "name" | "username"> }
  | { status: "db_error"; message: string };

// ── Private helpers ────────────────────────────────────────────────────────

async function fetchAppUser(supabaseUid: string): Promise<AppUserResult> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("app_users")
    .select("id, name, username, email, role, factory_id, is_active")
    .eq("supabase_user_id", supabaseUid)
    .maybeSingle();

  if (error) return { status: "db_error", message: error.message };
  if (!data) return { status: "not_found" };

  const row = data as AppUserRow;
  if (!row.is_active)
    return { status: "inactive", row: { name: row.name, username: row.username } };
  return { status: "ok", row };
}

async function resolveFactoryCode(factoryId: string | null): Promise<FactoryCode | null> {
  if (!factoryId) return null;
  const { data } = await getSupabaseBrowserClient()
    .from("factories")
    .select("code")
    .eq("id", factoryId)
    .maybeSingle();
  return (data?.code as FactoryCode) ?? null;
}

function buildUser(row: AppUserRow, factory: FactoryCode): User {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    email: row.email,
    password: "",
    role: row.role as UserRole,
    factory,
    isActive: true,
  };
}

function profileErrorMessage(result: AppUserResult): string {
  if (result.status === "not_found")
    return "Your ERP account has not been provisioned. Contact your administrator.";
  if (result.status === "inactive")
    return "Your account has been deactivated. Contact your administrator.";
  if (result.status === "db_error")
    return `Failed to load ERP profile: ${result.message}`;
  return "Unknown profile error.";
}

/**
 * Resolves a "username or email" login input to an actual email address.
 * If the input already contains "@" it is returned as-is.
 * Otherwise the /api/lookup-email route (server-side, admin client) is called.
 */
async function resolveLoginEmail(usernameOrEmail: string): Promise<string> {
  const cleaned = usernameOrEmail.trim().toLowerCase();
  if (cleaned.includes("@")) return cleaned;

  const res = await fetch(
    `/api/lookup-email?username=${encodeURIComponent(cleaned)}`,
  );
  if (!res.ok) throw new Error("Invalid username or password.");
  const json = (await res.json()) as { email?: string };
  if (!json.email) throw new Error("Invalid username or password.");
  return json.email;
}

// ── Auth service ───────────────────────────────────────────────────────────

export const authService = {
  async getSession(): Promise<AuthSession | null> {
    const {
      data: { session },
    } = await getSupabaseBrowserClient().auth.getSession();
    if (!session) return null;
    const overrides = readJson<OverrideSession>(OVERRIDE_KEY, {});
    return {
      userId: session.user.id,
      roleOverride: overrides.roleOverride,
      factoryOverride: overrides.factoryOverride,
    };
  },

  async getCurrentUser(): Promise<User | null> {
    const {
      data: { session },
    } = await getSupabaseBrowserClient().auth.getSession();
    if (!session) return null;

    const result = await fetchAppUser(session.user.id);
    if (result.status !== "ok") {
      await getSupabaseBrowserClient().auth.signOut();
      throw new Error(profileErrorMessage(result));
    }

    const factory = (await resolveFactoryCode(result.row.factory_id)) ?? "YNM-HYD";
    return buildUser(result.row, factory);
  },

  /**
   * Accepts a bare username or a full email address.
   * If a username is provided the server-side /api/lookup-email route
   * resolves it to an email before calling Supabase Auth.
   */
  async login(usernameOrEmail: string, password: string): Promise<User> {
    const email = await resolveLoginEmail(usernameOrEmail);

    const { data, error } = await getSupabaseBrowserClient().auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      if (
        error.message.toLowerCase().includes("invalid") ||
        error.message.toLowerCase().includes("credentials") ||
        error.message.toLowerCase().includes("email not confirmed")
      ) {
        throw new Error("Invalid username or password.");
      }
      throw new Error(error.message);
    }
    if (!data.user) throw new Error("Login failed.");

    const result = await fetchAppUser(data.user.id);
    if (result.status !== "ok") {
      await getSupabaseBrowserClient().auth.signOut();
      throw new Error(profileErrorMessage(result));
    }

    const factory = (await resolveFactoryCode(result.row.factory_id)) ?? "YNM-HYD";
    const user = buildUser(result.row, factory);
    logAudit({ userId: user.id, userName: user.name, action: "LOGIN", module: "Auth", factory });
    return user;
  },

  async logout(): Promise<void> {
    removeKey(OVERRIDE_KEY);
    await getSupabaseBrowserClient().auth.signOut();
  },

  async setRoleOverride(roleOverride?: UserRole): Promise<void> {
    const overrides = readJson<OverrideSession>(OVERRIDE_KEY, {});
    writeJson(OVERRIDE_KEY, { ...overrides, roleOverride });
  },

  async setFactoryOverride(factoryOverride?: FactoryCode): Promise<void> {
    const overrides = readJson<OverrideSession>(OVERRIDE_KEY, {});
    writeJson(OVERRIDE_KEY, { ...overrides, factoryOverride });
  },
};
