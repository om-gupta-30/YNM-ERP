"use client";

import * as React from "react";
import type { Customer } from "@/lib/types";
import { FormModal } from "@/components/ui/FormModal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

type Mode = "create" | "edit";

export type CustomerFormValues = {
  customerCode: string;
  customerName: string;
  gstNumber: string;
  billingAddress: string;
  shippingAddress: string;
  contactPerson: string;
  phone: string;
  email: string;
  creditTerms: string;
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

export function CustomerForm(props: {
  open: boolean;
  mode: Mode;
  existingCustomers: Customer[];
  initialCustomer?: Customer | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (values: CustomerFormValues) => Promise<void> | void;
}) {
  const initial = props.initialCustomer;

  const [values, setValues] = React.useState<CustomerFormValues>(() => ({
    customerCode: initial?.customerCode ?? "",
    customerName: initial?.customerName ?? "",
    gstNumber: initial?.gstNumber ?? "",
    billingAddress: initial?.billingAddress ?? "",
    shippingAddress: initial?.shippingAddress ?? "",
    contactPerson: initial?.contactPerson ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    creditTerms: initial?.creditTerms ?? "",
  }));

  const [errors, setErrors] = React.useState<
    Partial<Record<keyof CustomerFormValues, string>>
  >({});

  React.useEffect(() => {
    if (!props.open) return;
    setValues({
      customerCode: initial?.customerCode ?? "",
      customerName: initial?.customerName ?? "",
      gstNumber: initial?.gstNumber ?? "",
      billingAddress: initial?.billingAddress ?? "",
      shippingAddress: initial?.shippingAddress ?? "",
      contactPerson: initial?.contactPerson ?? "",
      phone: initial?.phone ?? "",
      email: initial?.email ?? "",
      creditTerms: initial?.creditTerms ?? "",
    });
    setErrors({});
  }, [initial, props.open]);

  function validate(next: CustomerFormValues) {
    const e: Partial<Record<keyof CustomerFormValues, string>> = {};

    if (!next.customerCode.trim()) {
      e.customerCode = "Customer code is required.";
    } else {
      const code = normalizeCode(next.customerCode);
      const duplicate = props.existingCustomers.some((c) => {
        if (props.mode === "edit" && initial?.id === c.id) return false;
        return normalizeCode(c.customerCode) === code;
      });
      if (duplicate) e.customerCode = "Customer code must be unique.";
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
      customerCode: normalizeCode(values.customerCode),
      customerName: values.customerName.trim(),
      gstNumber: normalizeGst(values.gstNumber),
      billingAddress: values.billingAddress.trim(),
      shippingAddress: values.shippingAddress.trim(),
      contactPerson: values.contactPerson.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
      creditTerms: values.creditTerms.trim(),
    });
  }

  const title = props.mode === "create" ? "Create Customer" : "Edit Customer";

  return (
    <FormModal
      open={props.open}
      title={title}
      description="Maintain customer master data."
      onClose={props.onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={props.onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" form="customer-form" disabled={props.isSaving}>
            {props.isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      }
    >
      <form
        id="customer-form"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={onSubmit}
      >
        <Input
          label="Customer Code (required)"
          value={values.customerCode}
          onChange={(e) => setValues((p) => ({ ...p, customerCode: e.target.value }))}
          error={errors.customerCode}
          placeholder="e.g. CUS-0201"
          required
        />

        <Input
          label="Customer Name"
          value={values.customerName}
          onChange={(e) => setValues((p) => ({ ...p, customerName: e.target.value }))}
          placeholder="e.g. ABC Distributors"
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
          placeholder="e.g. Purchase Manager"
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
          placeholder="e.g. ops@customer.com"
        />

        <div className="sm:col-span-2">
          <Textarea
            label="Billing Address"
            value={values.billingAddress}
            onChange={(e) => setValues((p) => ({ ...p, billingAddress: e.target.value }))}
            placeholder="Billing address"
          />
        </div>

        <div className="sm:col-span-2">
          <Textarea
            label="Shipping Address"
            value={values.shippingAddress}
            onChange={(e) => setValues((p) => ({ ...p, shippingAddress: e.target.value }))}
            placeholder="Shipping address"
          />
        </div>

        <div className="sm:col-span-2">
          <Input
            label="Credit Terms"
            value={values.creditTerms}
            onChange={(e) => setValues((p) => ({ ...p, creditTerms: e.target.value }))}
            placeholder="e.g. 30 Days / Advance"
          />
        </div>
      </form>
    </FormModal>
  );
}

