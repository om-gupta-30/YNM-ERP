import type { Supplier } from "@/lib/types";

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

let suppliersStore: Supplier[] = [
  {
    id: "s_ambit",
    supplierCode: "SUP-0001",
    supplierName: "Ambit Metals Pvt Ltd",
    gstNumber: "27AAAAA0000A1Z5",
    contactPerson: "R. Mehta",
    phone: "9876543210",
    email: "accounts@ambit.example",
    address: "Industrial Area, Pune, Maharashtra",
    paymentTerms: "30 Days",
    isActive: true,
    createdAt: "2026-02-01T09:00:00.000Z",
  },
  {
    id: "s_polychem",
    supplierCode: "SUP-0002",
    supplierName: "PolyChem Traders",
    gstNumber: "33BBBBB1111B2Z6",
    contactPerson: "S. Iyer",
    phone: "9123456780",
    email: "sales@polychem.example",
    address: "SIDCO Estate, Chennai, Tamil Nadu",
    paymentTerms: "Advance",
    isActive: true,
    createdAt: "2026-02-01T09:05:00.000Z",
  },
  {
    id: "s_packco",
    supplierCode: "SUP-0003",
    supplierName: "PackCo Packaging",
    gstNumber: "",
    contactPerson: "A. Shah",
    phone: "9988776655",
    email: "support@packco.example",
    address: "Andheri East, Mumbai, Maharashtra",
    paymentTerms: "45 Days",
    isActive: true,
    createdAt: "2026-02-01T09:10:00.000Z",
  },
];

export type GetSuppliersParams = {
  delayMs?: number;
};

export async function getSuppliers(params?: GetSuppliersParams): Promise<Supplier[]> {
  if (params?.delayMs) await sleep(params.delayMs);
  return [...suppliersStore].sort((a, b) => a.supplierCode.localeCompare(b.supplierCode));
}

export async function createSupplier(
  input: Omit<Supplier, "id" | "isActive" | "createdAt"> &
    Partial<Pick<Supplier, "isActive" | "createdAt">>,
) {
  await sleep(350);
  const supplierCode = normalizeCode(input.supplierCode);
  const exists = suppliersStore.some(
    (s) => normalizeCode(s.supplierCode) === supplierCode,
  );
  if (exists) throw new Error("Supplier code already exists.");

  const supplier: Supplier = {
    // Logic correction: safer IDs to avoid collisions in mock store.
    id: genId("s"),
    supplierCode,
    supplierName: input.supplierName?.trim() ?? "",
    gstNumber: input.gstNumber?.trim().toUpperCase() ?? "",
    contactPerson: input.contactPerson?.trim() ?? "",
    phone: input.phone?.trim() ?? "",
    email: input.email?.trim() ?? "",
    address: input.address?.trim() ?? "",
    paymentTerms: input.paymentTerms?.trim() ?? "",
    isActive: input.isActive ?? true,
    createdAt: input.createdAt ?? nowIso(),
  };

  suppliersStore = [supplier, ...suppliersStore];
  return supplier;
}

export async function updateSupplier(
  id: string,
  patch: Partial<Omit<Supplier, "id" | "createdAt">>,
) {
  await sleep(350);
  const idx = suppliersStore.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error("Supplier not found.");

  const next: Supplier = { ...suppliersStore[idx], ...patch };
  if (patch.supplierCode) next.supplierCode = normalizeCode(patch.supplierCode);
  if (patch.gstNumber) next.gstNumber = patch.gstNumber.trim().toUpperCase();

  const dup = suppliersStore.some(
    (s) =>
      s.id !== id && normalizeCode(s.supplierCode) === normalizeCode(next.supplierCode),
  );
  if (dup) throw new Error("Supplier code already exists.");

  suppliersStore = suppliersStore.map((s) => (s.id === id ? next : s));
  return next;
}

export async function toggleSupplierStatus(id: string) {
  await sleep(300);
  const supplier = suppliersStore.find((s) => s.id === id);
  if (!supplier) throw new Error("Supplier not found.");
  const next = { ...supplier, isActive: !supplier.isActive };
  suppliersStore = suppliersStore.map((s) => (s.id === id ? next : s));
  return next;
}

