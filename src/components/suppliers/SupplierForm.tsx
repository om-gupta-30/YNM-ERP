"use client";

import * as React from "react";
import type { Supplier } from "@/lib/types";
import { FormModal } from "@/components/ui/FormModal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Mode = "create" | "edit";

export type SupplierFormValues = {
  supplierCode: string;
  supplierName: string;
  gstNumber: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  paymentTerms: string;
};

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function normalizeGst(gst: string) {
  return gst.trim().toUpperCase();
}

function isValidGst(gst: string) {
  if (!gst.trim()) return true; // optional
  const v = normalizeGst(gst);
  return /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(v);
}

function isValidEmail(v: string) {
  if (!v.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function isValidPhone(v: string) {
  if (!v.trim()) return true;
  return /^[0-9+\-\s()]{7,20}$/.test(v.trim());
}

export function SupplierForm(props: {
  open: boolean;
  mode: Mode;
  existingSuppliers: Supplier[];
  initialSupplier?: Supplier | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (values: SupplierFormValues) => Promise<void> | void;
}) {
  const initial = props.initialSupplier;

  const [values, setValues] = React.useState<SupplierFormValues>(() => ({
    supplierCode: initial?.supplierCode ?? "",
    supplierName: initial?.supplierName ?? "",
    gstNumber: initial?.gstNumber ?? "",
    contactPerson: initial?.contactPerson ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    address: initial?.address ?? "",
    paymentTerms: initial?.paymentTerms ?? "",
  }));

  const [errors, setErrors] = React.useState<
    Partial<Record<keyof SupplierFormValues, string>>
  >({});

  React.useEffect(() => {
    if (!props.open) return;
    setValues({
      supplierCode: initial?.supplierCode ?? "",
      supplierName: initial?.supplierName ?? "",
      gstNumber: initial?.gstNumber ?? "",
      contactPerson: initial?.contactPerson ?? "",
      phone: initial?.phone ?? "",
      email: initial?.email ?? "",
      address: initial?.address ?? "",
      paymentTerms: initial?.paymentTerms ?? "",
    });
    setErrors({});
  }, [initial, props.open]);

  function validate(next: SupplierFormValues) {
    const e: Partial<Record<keyof SupplierFormValues, string>> = {};

    if (!next.supplierCode.trim()) {
      e.supplierCode = "Supplier code is required.";
    } else {
      const code = normalizeCode(next.supplierCode);
      const duplicate = props.existingSuppliers.some((s) => {
        if (props.mode === "edit" && initial?.id === s.id) return false;
        return normalizeCode(s.supplierCode) === code;
      });
      if (duplicate) e.supplierCode = "Supplier code must be unique.";
    }

    if (!isValidGst(next.gstNumber)) {
      e.gstNumber = "GST number format looks invalid (basic validation).";
    }

    if (!isValidEmail(next.email)) {
      e.email = "Email format looks invalid.";
    }

    if (!isValidPhone(next.phone)) {
      e.phone = "Phone format looks invalid.";
    }

    return e;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const eMap = validate(values);
    setErrors(eMap);
    if (Object.keys(eMap).length > 0) return;

    await props.onSave({
      supplierCode: normalizeCode(values.supplierCode),
      supplierName: values.supplierName.trim(),
      gstNumber: normalizeGst(values.gstNumber),
      contactPerson: values.contactPerson.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
      address: values.address.trim(),
      paymentTerms: values.paymentTerms.trim(),
    });
  }

  const title = props.mode === "create" ? "Create Supplier" : "Edit Supplier";

  return (
    <FormModal
      open={props.open}
      title={title}
      description="Maintain supplier master data."
      onClose={props.onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={props.onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" form="supplier-form" disabled={props.isSaving}>
            {props.isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      }
    >
      <form
        id="supplier-form"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={onSubmit}
      >
        <Input
          label="Supplier Code (required)"
          value={values.supplierCode}
          onChange={(e) => setValues((p) => ({ ...p, supplierCode: e.target.value }))}
          error={errors.supplierCode}
          placeholder="e.g. SUP-0004"
          required
        />

        <Input
          label="Supplier Name"
          value={values.supplierName}
          onChange={(e) => setValues((p) => ({ ...p, supplierName: e.target.value }))}
          placeholder="e.g. ABC Components"
        />

        <Input
          label="GST Number"
          value={values.gstNumber}
          onChange={(e) => setValues((p) => ({ ...p, gstNumber: e.target.value }))}
          error={errors.gstNumber}
          placeholder="15-character GSTIN"
        />

        <Input
          label="Contact Person"
          value={values.contactPerson}
          onChange={(e) => setValues((p) => ({ ...p, contactPerson: e.target.value }))}
          placeholder="e.g. Accounts Manager"
        />

        <Input
          label="Phone"
          value={values.phone}
          onChange={(e) => setValues((p) => ({ ...p, phone: e.target.value }))}
          error={errors.phone}
          placeholder="e.g. 9876543210"
        />

        <Input
          label="Email"
          value={values.email}
          onChange={(e) => setValues((p) => ({ ...p, email: e.target.value }))}
          error={errors.email}
          placeholder="e.g. accounts@supplier.com"
        />

        <div className="sm:col-span-2">
          <Input
            label="Address"
            value={values.address}
            onChange={(e) => setValues((p) => ({ ...p, address: e.target.value }))}
            placeholder="Full address"
          />
        </div>

        <div className="sm:col-span-2">
          <Input
            label="Payment Terms"
            value={values.paymentTerms}
            onChange={(e) => setValues((p) => ({ ...p, paymentTerms: e.target.value }))}
            placeholder="e.g. 30 Days / Advance"
          />
        </div>
      </form>
    </FormModal>
  );
}

