import type { FactoryCode, User, UserRole } from "@/lib/types";
import { USERS_KEY } from "@/lib/services/authKeys";

const seedUsers: User[] = [
  { id: "u_admin", name: "Admin User", email: "admin@ynmsafety.com", password: "", role: "admin", factory: "YNM-HYD", isActive: true },
  { id: "u_plan", name: "Planning User", email: "planning@ynmsafety.com", password: "", role: "planning", factory: "YNM-HYD", isActive: true },
  { id: "u_purchase", name: "Purchase User", email: "purchase@ynmsafety.com", password: "", role: "purchase", factory: "YNM-HYD", isActive: true },
  { id: "u_sales", name: "Sales User", email: "sales@ynmsafety.com", password: "", role: "sales", factory: "YNM-HYD", isActive: true },
  { id: "u_accounts", name: "Accounts User", email: "accounts@ynmsafety.com", password: "", role: "accounts", factory: "YNM-HYD", isActive: true },
  { id: "u_security", name: "Security User", email: "security@ynmsafety.com", password: "", role: "security", factory: "YNM-HYD", isActive: true },
  { id: "u_stores", name: "Stores User", email: "stores@ynmsafety.com", password: "", role: "stores", factory: "YNM-HYD", isActive: true },
  { id: "u_prod", name: "Production User", email: "production@ynmsafety.com", password: "", role: "production", factory: "YNM-HYD", isActive: true },
];
import { readJson, writeJson } from "@/lib/storage";

export type UserService = {
  getUsers: () => Promise<User[]>;
  createUser: (input: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    factory: FactoryCode;
  }) => Promise<User>;
  updateUser: (
    userId: string,
    patch: Partial<Pick<User, "name" | "email" | "password" | "role" | "factory" | "isActive">>,
  ) => Promise<User>;
  setActive: (userId: string, isActive: boolean) => Promise<User>;
};

function seedIfNeeded() {
  const existing = readJson<User[] | null>(USERS_KEY, null);
  if (!existing || existing.length === 0) {
    writeJson(USERS_KEY, seedUsers);
  }
}

function getUsersSync(): User[] {
  seedIfNeeded();
  return readJson<User[]>(USERS_KEY, seedUsers);
}

function saveUsersSync(next: User[]) {
  writeJson(USERS_KEY, next);
}

function genId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `${prefix}_${uuid}`
    : `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export const userService: UserService = {
  async getUsers() {
    // TODO(db): Replace with users query (admin-only, factory-scoped if needed).
    return [...getUsersSync()].sort((a, b) => a.email.localeCompare(b.email));
  },

  async createUser(input) {
    // TODO(db): Replace with INSERT + unique constraint on email.
    const next = getUsersSync();
    const email = input.email.trim().toLowerCase();
    if (!email) throw new Error("Email is required.");
    const exists = next.some((u) => u.email.trim().toLowerCase() === email);
    if (exists) throw new Error("An account with this email already exists.");

    const user: User = {
      id: genId("u"),
      name: input.name.trim() || "New User",
      email,
      password: input.password,
      role: input.role,
      factory: input.factory,
      isActive: true,
    };
    saveUsersSync([user, ...next]);
    return user;
  },

  async updateUser(userId, patch) {
    // TODO(db): Replace with UPDATE by id + unique email validation.
    const next = getUsersSync();
    const idx = next.findIndex((u) => u.id === userId);
    if (idx < 0) throw new Error("User not found.");

    const updated: User = {
      ...next[idx],
      ...patch,
      name: patch.name != null ? patch.name : next[idx].name,
      email: patch.email != null ? patch.email.trim() : next[idx].email,
    };

    const normEmail = updated.email.trim().toLowerCase();
    if (!normEmail) throw new Error("Email is required.");
    const dup = next.some(
      (u) => u.id !== userId && u.email.trim().toLowerCase() === normEmail,
    );
    if (dup) throw new Error("An account with this email already exists.");

    updated.email = normEmail;
    const saved = next.map((u) => (u.id === userId ? updated : u));
    saveUsersSync(saved);
    return updated;
  },

  async setActive(userId, isActive) {
    // TODO(db): Replace with UPDATE isActive toggle (soft delete).
    return userService.updateUser(userId, { isActive });
  },
};

