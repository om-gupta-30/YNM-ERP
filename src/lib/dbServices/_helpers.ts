import { getSupabaseBrowserClient, getSupabaseServerClient } from "@/lib/supabaseClient";
import type { FactoryCode, ItemType } from "@/lib/types";
import { isTransientError, AppError, withRetry } from "@/lib/apiError";

/**
 * Returns the appropriate Supabase client for the current execution context.
 * - Browser (Client Components, browser event handlers): singleton browser client.
 * - Server (Server Components, Route Handlers, Server Actions): fresh instance per call.
 */
export function getClient() {
  if (typeof window !== "undefined") {
    return getSupabaseBrowserClient();
  }
  return getSupabaseServerClient();
}

export function assertNoError(
  error: { message: string; code?: string } | null,
  fallback = "Database error.",
): void {
  if (!error) return;

  const message = error.message || fallback;
  const lower = message.toLowerCase();

  if (isTransientError(error)) {
    throw new AppError(message, "NETWORK_ERROR", { retryable: true, cause: error });
  }
  if (error.code === "23505") {
    throw new AppError(message, "CONFLICT", { cause: error });
  }
  if (lower.includes("not found") || error.code === "PGRST116") {
    throw new AppError(message, "NOT_FOUND", { cause: error });
  }

  throw new AppError(message, "DB_ERROR", { cause: error });
}

/**
 * Wraps a Supabase query function with automatic retry for transient failures.
 * Use for read operations where idempotent retries are safe.
 */
export function retryQuery<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(fn, {
    maxAttempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 4000,
  });
}

// ---- Item type maps ----

const DB_ITEM_TYPE_MAP: Record<string, ItemType> = {
  raw_material: "RAW_MATERIAL",
  semi_finished: "SEMI_FINISHED",
  finished_good: "FINISHED_GOOD",
  consumable: "TRADING",
  service: "TRADING",
  trading: "TRADING",
};

const APP_ITEM_TYPE_MAP: Record<ItemType, string> = {
  RAW_MATERIAL: "raw_material",
  SEMI_FINISHED: "semi_finished",
  FINISHED_GOOD: "finished_good",
  TRADING: "consumable",
};

export function mapDbItemType(dbType: string): ItemType {
  return DB_ITEM_TYPE_MAP[dbType] ?? "RAW_MATERIAL";
}

export function mapAppItemType(appType: ItemType): string {
  return APP_ITEM_TYPE_MAP[appType];
}

// ---- Factory helpers ----
// The DB stores factory as a UUID FK; the app uses FactoryCode strings.
// These helpers bridge the two representations.

const factoryIdCache = new Map<string, string | null>();
const factoryCodeCache = new Map<string, FactoryCode | undefined>();

export async function getFactoryId(code: FactoryCode): Promise<string | null> {
  if (factoryIdCache.has(code)) return factoryIdCache.get(code)!;
  const { data } = await getClient()
    .from("factories")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  const id = (data?.id as string) ?? null;
  factoryIdCache.set(code, id);
  return id;
}

export async function getFactoryCode(
  id: string | null | undefined,
): Promise<FactoryCode | undefined> {
  if (!id) return undefined;
  if (factoryCodeCache.has(id)) return factoryCodeCache.get(id);
  const { data } = await getClient()
    .from("factories")
    .select("code")
    .eq("id", id)
    .maybeSingle();
  const code = (data?.code as FactoryCode) ?? undefined;
  factoryCodeCache.set(id, code);
  return code;
}

// ---- Misc ----

export function nowIso(): string {
  return new Date().toISOString();
}
