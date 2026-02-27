import type { Customer } from "@/lib/types";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function genId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `${prefix}_${uuid}`
    : `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

let customersStore: Customer[] = [
  {
    id: "c_ynm_keyacct_1",
    customerCode: "CUS-0101",
    customerName: "National Safety Distributors",
    gstNumber: "07AAAAA0000A1Z5",
    billingAddress: "Okhla Industrial Area, New Delhi, Delhi",
    shippingAddress: "Okhla Industrial Area, New Delhi, Delhi",
    contactPerson: "K. Singh",
    phone: "9876501234",
    email: "purchase@nationalsafety.example",
    creditTerms: "30 Days",
    isActive: true,
    createdAt: "2026-02-01T09:00:00.000Z",
  },
  {
    id: "c_ynm_keyacct_2",
    customerCode: "CUS-0102",
    customerName: "Industrial Supply Co.",
    gstNumber: "29BBBBB1111B2Z6",
    billingAddress: "Peenya Industrial Area, Bengaluru, Karnataka",
    shippingAddress: "Peenya Industrial Area, Bengaluru, Karnataka",
    contactPerson: "A. Rao",
    phone: "9123409876",
    email: "ops@industrialsupply.example",
    creditTerms: "45 Days",
    isActive: true,
    createdAt: "2026-02-01T09:05:00.000Z",
  },
];

export type GetCustomersParams = {
  delayMs?: number;
};

export async function getCustomers(params?: GetCustomersParams): Promise<Customer[]> {
  if (params?.delayMs) await sleep(params.delayMs);
  return [...customersStore].sort((a, b) =>
    a.customerCode.localeCompare(b.customerCode),
  );
}

export async function createCustomer(
  input: Omit<Customer, "id" | "isActive" | "createdAt"> &
    Partial<Pick<Customer, "isActive" | "createdAt">>,
) {
  await sleep(350);
  const customerCode = normalizeCode(input.customerCode);
  const exists = customersStore.some(
    (c) => normalizeCode(c.customerCode) === customerCode,
  );
  if (exists) throw new Error("Customer code already exists.");

  const customer: Customer = {
    // Logic correction: safer IDs to avoid collisions in mock store.
    id: genId("c"),
    customerCode,
    customerName: input.customerName?.trim() ?? "",
    gstNumber: input.gstNumber?.trim().toUpperCase() ?? "",
    billingAddress: input.billingAddress?.trim() ?? "",
    shippingAddress: input.shippingAddress?.trim() ?? "",
    contactPerson: input.contactPerson?.trim() ?? "",
    phone: input.phone?.trim() ?? "",
    email: input.email?.trim() ?? "",
    creditTerms: input.creditTerms?.trim() ?? "",
    isActive: input.isActive ?? true,
    createdAt: input.createdAt ?? nowIso(),
  };

  customersStore = [customer, ...customersStore];
  return customer;
}

export async function updateCustomer(
  id: string,
  patch: Partial<Omit<Customer, "id" | "createdAt">>,
) {
  await sleep(350);
  const idx = customersStore.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error("Customer not found.");

  const next: Customer = { ...customersStore[idx], ...patch };
  if (patch.customerCode) next.customerCode = normalizeCode(patch.customerCode);
  if (patch.gstNumber) next.gstNumber = patch.gstNumber.trim().toUpperCase();

  const dup = customersStore.some(
    (c) =>
      c.id !== id &&
      normalizeCode(c.customerCode) === normalizeCode(next.customerCode),
  );
  if (dup) throw new Error("Customer code already exists.");

  customersStore = customersStore.map((c) => (c.id === id ? next : c));
  return next;
}

export async function toggleCustomerStatus(id: string) {
  await sleep(300);
  const customer = customersStore.find((c) => c.id === id);
  if (!customer) throw new Error("Customer not found.");
  const next = { ...customer, isActive: !customer.isActive };
  customersStore = customersStore.map((c) => (c.id === id ? next : c));
  return next;
}

