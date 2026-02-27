"use client";

import * as React from "react";
import { FormModal } from "@/components/ui/FormModal";
import { Button } from "@/components/ui/Button";

export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <FormModal
      open={props.open}
      title={props.title}
      description={props.description}
      onClose={props.onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={props.onClose}>
            {props.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            variant={props.tone === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={props.onConfirm}
          >
            {props.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      }
    >
      <div className="text-sm text-stone-600">
        {props.description ?? "Are you sure you want to continue?"}
      </div>
    </FormModal>
  );
}
