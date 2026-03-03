import type { SupplierItemPrice } from "@/lib/types";
import type { SupplierItemPriceService } from "@/lib/services/supplierItemPriceService";
import { assertNoError, getClient, nowIso, retryQuery } from "./_helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSIP(row: Record<string, any>): SupplierItemPrice {
  return {
    id: row.id as string,
    supplierId: row.supplier_id as string,
    itemId: row.item_id as string,
    unitPrice: Number(row.unit_price),
    taxPercent: Number(row.tax_percent ?? 18),
    leadTimeDays: Number(row.lead_time_days ?? 7),
    minOrderQty: Number(row.min_order_qty ?? 1),
    isActive: row.is_active as boolean,
    effectiveFrom: (row.effective_from as string) ?? null,
    effectiveTo: (row.effective_to as string) ?? null,
    remarks: (row.remarks as string) ?? "",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export const dbSupplierItemPriceService: SupplierItemPriceService = {
  async getAll() {
    return retryQuery(async () => {
      const { data, error } = await getClient()
        .from("supplier_item_prices")
        .select("*")
        .order("created_at", { ascending: false });
      assertNoError(error);
      return (data ?? []).map(toSIP);
    });
  },

  async getBySupplier(supplierId) {
    return retryQuery(async () => {
      const { data, error } = await getClient()
        .from("supplier_item_prices")
        .select("*")
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false });
      assertNoError(error);
      return (data ?? []).map(toSIP);
    });
  },

  async getByItem(itemId) {
    return retryQuery(async () => {
      const { data, error } = await getClient()
        .from("supplier_item_prices")
        .select("*")
        .eq("item_id", itemId)
        .eq("is_active", true)
        .order("unit_price", { ascending: true });
      assertNoError(error);
      return (data ?? []).map(toSIP);
    });
  },

  async getById(id) {
    const { data, error } = await getClient()
      .from("supplier_item_prices")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    assertNoError(error);
    return data ? toSIP(data) : null;
  },

  async create(input) {
    const { data: existing } = await getClient()
      .from("supplier_item_prices")
      .select("id")
      .eq("supplier_id", input.supplierId)
      .eq("item_id", input.itemId)
      .maybeSingle();
    if (existing) throw new Error("A rate already exists for this supplier-item combination. Edit the existing entry instead.");

    const { data, error } = await getClient()
      .from("supplier_item_prices")
      .insert({
        supplier_id: input.supplierId,
        item_id: input.itemId,
        unit_price: input.unitPrice,
        tax_percent: input.taxPercent,
        lead_time_days: input.leadTimeDays,
        min_order_qty: input.minOrderQty ?? 1,
        is_active: true,
        effective_from: input.effectiveFrom ?? null,
        effective_to: input.effectiveTo ?? null,
        remarks: input.remarks ?? "",
      })
      .select()
      .single();
    assertNoError(error);
    return toSIP(data);
  },

  async update(id, patch) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = { updated_at: nowIso() };
    if (patch.unitPrice !== undefined) updates.unit_price = patch.unitPrice;
    if (patch.taxPercent !== undefined) updates.tax_percent = patch.taxPercent;
    if (patch.leadTimeDays !== undefined) updates.lead_time_days = patch.leadTimeDays;
    if (patch.minOrderQty !== undefined) updates.min_order_qty = patch.minOrderQty;
    if (patch.isActive !== undefined) updates.is_active = patch.isActive;
    if (patch.effectiveFrom !== undefined) updates.effective_from = patch.effectiveFrom;
    if (patch.effectiveTo !== undefined) updates.effective_to = patch.effectiveTo;
    if (patch.remarks !== undefined) updates.remarks = patch.remarks;

    const { data, error } = await getClient()
      .from("supplier_item_prices")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    assertNoError(error);
    return toSIP(data);
  },

  async remove(id) {
    const { error } = await getClient()
      .from("supplier_item_prices")
      .delete()
      .eq("id", id);
    assertNoError(error);
  },

  async getRankedSuppliers(itemId, quantity) {
    const { data, error } = await getClient()
      .from("supplier_item_prices")
      .select("*")
      .eq("item_id", itemId)
      .eq("is_active", true)
      .order("unit_price", { ascending: true });
    assertNoError(error);

    const today = new Date().toISOString().slice(0, 10);
    const valid = (data ?? []).filter((row) => {
      if (row.effective_from && row.effective_from > today) return false;
      if (row.effective_to && row.effective_to < today) return false;
      if (quantity && Number(row.min_order_qty) > quantity) return false;
      return true;
    });

    return valid.map((row, idx) => ({
      rank: idx + 1,
      label: `L${idx + 1}`,
      ...toSIP(row),
      landedPrice: Number((Number(row.unit_price) * (1 + Number(row.tax_percent) / 100)).toFixed(4)),
      totalCost: quantity
        ? Number((Number(row.unit_price) * quantity * (1 + Number(row.tax_percent) / 100)).toFixed(2))
        : null,
    }));
  },

  async getForRfqAutoFill(itemIds, supplierIds) {
    const { data, error } = await getClient()
      .from("supplier_item_prices")
      .select("*")
      .eq("is_active", true)
      .in("item_id", itemIds)
      .in("supplier_id", supplierIds);
    assertNoError(error);
    return (data ?? []).map(toSIP);
  },
};
