import type { Supplier } from "@/lib/types";
import type { SupplierService } from "@/lib/services/supplierService";
import type { GetSuppliersParams } from "@/lib/types";
import { assertNoError, getClient, retryQuery } from "./_helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSupplier(row: Record<string, any>): Supplier {
  return {
    id: row.id as string,
    supplierCode: row.code as string,
    supplierName: row.name as string,
    gstNumber: (row.gstin as string) ?? "",
    contactPerson: (row.contact_person as string) ?? "",
    phone: (row.phone as string) ?? "",
    email: (row.email as string) ?? "",
    address: (row.address as string) ?? "",
    paymentTerms: (row.payment_terms as string) ?? "",
    isActive: Boolean(row.is_active),
    createdAt: row.created_at as string,
  };
}

export const dbSupplierService: SupplierService = {
  async getSuppliers(_params?: GetSuppliersParams) {
    return retryQuery(async () => {
      const { data, error } = await getClient()
        .from("suppliers")
        .select("id, code, name, gstin, contact_person, phone, email, address, payment_terms, is_active, created_at")
        .order("code", { ascending: true });
      assertNoError(error);
      return (data ?? []).map(toSupplier);
    });
  },

  async createSupplier(input) {
    const { data, error } = await getClient()
      .from("suppliers")
      .insert({
        code: input.supplierCode.trim().toUpperCase(),
        name: input.supplierName.trim(),
        gstin: input.gstNumber?.trim() ?? "",
        contact_person: input.contactPerson?.trim() ?? "",
        phone: input.phone?.trim() ?? "",
        email: input.email?.trim() ?? "",
        address: input.address?.trim() ?? "",
        payment_terms: input.paymentTerms?.trim() ?? "",
        is_active: input.isActive ?? true,
      })
      .select()
      .single();
    if (error?.code === "23505") throw new Error("Supplier code already exists.");
    assertNoError(error);
    return toSupplier(data);
  },

  async updateSupplier(id, patch) {
    const update: Record<string, unknown> = {};
    if (patch.supplierCode !== undefined) update.code = patch.supplierCode.trim().toUpperCase();
    if (patch.supplierName !== undefined) update.name = patch.supplierName.trim();
    if (patch.gstNumber !== undefined) update.gstin = patch.gstNumber.trim();
    if (patch.contactPerson !== undefined) update.contact_person = patch.contactPerson.trim();
    if (patch.phone !== undefined) update.phone = patch.phone.trim();
    if (patch.email !== undefined) update.email = patch.email.trim();
    if (patch.address !== undefined) update.address = patch.address.trim();
    if (patch.paymentTerms !== undefined) update.payment_terms = patch.paymentTerms.trim();
    if (patch.isActive !== undefined) update.is_active = patch.isActive;

    const { data, error } = await getClient()
      .from("suppliers")
      .update(update)
      .eq("id", id)
      .select()
      .single();
    if (error?.code === "23505") throw new Error("Supplier code already exists.");
    assertNoError(error);
    if (!data) throw new Error("Supplier not found.");
    return toSupplier(data);
  },

  async toggleSupplierStatus(id) {
    const { data: current, error: fetchError } = await getClient()
      .from("suppliers")
      .select("is_active")
      .eq("id", id)
      .single();
    if (fetchError || !current) throw new Error("Supplier not found.");

    const { data, error } = await getClient()
      .from("suppliers")
      .update({ is_active: !current.is_active })
      .eq("id", id)
      .select()
      .single();
    assertNoError(error);
    return toSupplier(data);
  },
};
