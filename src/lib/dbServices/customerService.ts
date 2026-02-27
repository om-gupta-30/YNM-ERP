import type { Customer } from "@/lib/types";
import type { CustomerService } from "@/lib/services/customerService";
import type { GetCustomersParams } from "@/lib/types";
import { assertNoError, getClient, retryQuery } from "./_helpers";

// ---- Address encoding ----
// The DB customers table has a single `address` column.
// TODO: Run this migration to add dedicated columns and remove this workaround:
//   ALTER TABLE customers ADD COLUMN billing_address  TEXT NOT NULL DEFAULT '';
//   ALTER TABLE customers ADD COLUMN shipping_address TEXT NOT NULL DEFAULT '';
// Until then, both addresses are stored as JSON in the `address` column so
// no data is lost on round-trips through the form.

function encodeAddresses(billing: string, shipping: string): string {
  return JSON.stringify({ billing, shipping });
}

function decodeAddresses(raw: string | null): { billing: string; shipping: string } {
  if (!raw) return { billing: "", shipping: "" };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed === "object" && parsed !== null) {
      return {
        billing: (parsed.billing as string) ?? "",
        shipping: (parsed.shipping as string) ?? "",
      };
    }
  } catch {
    // Plain-text address stored before this encoding was introduced — treat as billing
  }
  return { billing: raw, shipping: "" };
}

// ---- Row mapper ----
// DB column → app Customer field:
//   code            → customerCode
//   name            → customerName
//   gstin           → gstNumber
//   address (JSON)  → billingAddress + shippingAddress
//   contact_person  → contactPerson
//   payment_terms   → creditTerms   (DB uses "payment_terms"; app calls it "creditTerms")
//   is_active       → isActive
//   created_at      → createdAt

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCustomer(row: Record<string, any>): Customer {
  const { billing, shipping } = decodeAddresses(row.address as string | null);
  return {
    id: row.id as string,
    customerCode: row.code as string,
    customerName: row.name as string,
    gstNumber: (row.gstin as string) ?? "",
    billingAddress: billing,
    shippingAddress: shipping,
    contactPerson: (row.contact_person as string) ?? "",
    phone: (row.phone as string) ?? "",
    email: (row.email as string) ?? "",
    creditTerms: (row.payment_terms as string) ?? "",
    isActive: Boolean(row.is_active),
    createdAt: row.created_at as string,
  };
}

// ---- Service ----

export const dbCustomerService: CustomerService = {
  async getCustomers(_params?: GetCustomersParams) {
    return retryQuery(async () => {
      const { data, error } = await getClient()
        .from("customers")
        .select("id, code, name, gstin, address, contact_person, phone, email, payment_terms, is_active, created_at")
        .order("code", { ascending: true });
      assertNoError(error);
      return (data ?? []).map(toCustomer);
    });
  },

  async createCustomer(input) {
    const { data, error } = await getClient()
      .from("customers")
      .insert({
        code: input.customerCode.trim().toUpperCase(),
        name: input.customerName.trim(),
        gstin: input.gstNumber?.trim().toUpperCase() ?? "",
        address: encodeAddresses(
          input.billingAddress?.trim() ?? "",
          input.shippingAddress?.trim() ?? "",
        ),
        contact_person: input.contactPerson?.trim() ?? "",
        phone: input.phone?.trim() ?? "",
        email: input.email?.trim() ?? "",
        payment_terms: input.creditTerms?.trim() ?? "",
        is_active: input.isActive ?? true,
      })
      .select()
      .single();
    if (error?.code === "23505") throw new Error("Customer code already exists.");
    assertNoError(error);
    return toCustomer(data);
  },

  async updateCustomer(id, patch) {
    const update: Record<string, unknown> = {};

    if (patch.customerCode !== undefined) update.code = patch.customerCode.trim().toUpperCase();
    if (patch.customerName !== undefined) update.name = patch.customerName.trim();
    if (patch.gstNumber !== undefined) update.gstin = patch.gstNumber.trim().toUpperCase();
    if (patch.contactPerson !== undefined) update.contact_person = patch.contactPerson.trim();
    if (patch.phone !== undefined) update.phone = patch.phone.trim();
    if (patch.email !== undefined) update.email = patch.email.trim();
    if (patch.creditTerms !== undefined) update.payment_terms = patch.creditTerms.trim();
    if (patch.isActive !== undefined) update.is_active = patch.isActive;

    // Address update: fetch current to preserve whichever half isn't in the patch
    if (patch.billingAddress !== undefined || patch.shippingAddress !== undefined) {
      if (patch.billingAddress !== undefined && patch.shippingAddress !== undefined) {
        update.address = encodeAddresses(
          patch.billingAddress.trim(),
          patch.shippingAddress.trim(),
        );
      } else {
        const { data: current, error: fetchError } = await getClient()
          .from("customers")
          .select("address")
          .eq("id", id)
          .single();
        if (fetchError || !current) throw new Error("Customer not found.");
        const { billing, shipping } = decodeAddresses(current.address as string | null);
        update.address = encodeAddresses(
          patch.billingAddress !== undefined ? patch.billingAddress.trim() : billing,
          patch.shippingAddress !== undefined ? patch.shippingAddress.trim() : shipping,
        );
      }
    }

    const { data, error } = await getClient()
      .from("customers")
      .update(update)
      .eq("id", id)
      .select()
      .single();
    if (error?.code === "23505") throw new Error("Customer code already exists.");
    assertNoError(error);
    if (!data) throw new Error("Customer not found.");
    return toCustomer(data);
  },

  async toggleCustomerStatus(id) {
    const { data: current, error: fetchError } = await getClient()
      .from("customers")
      .select("is_active")
      .eq("id", id)
      .single();
    if (fetchError || !current) throw new Error("Customer not found.");

    const { data, error } = await getClient()
      .from("customers")
      .update({ is_active: !current.is_active })
      .eq("id", id)
      .select()
      .single();
    assertNoError(error);
    return toCustomer(data);
  },
};
