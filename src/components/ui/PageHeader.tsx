import * as React from "react";
import { FlowBreadcrumb } from "@/components/layout/FlowBreadcrumb";

export function PageHeader(props: {
  title: string;
  description?: string;
  /** Plain-English hint explaining what this page does */
  hint?: string;
  /** Current route for FlowBreadcrumb (e.g. "/purchase/rfq"). Omit for non-operations pages. */
  flowCurrent?: string;
  /** "Next step" link shown in the breadcrumb */
  flowNext?: { label: string; href: string };
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      {props.flowCurrent && (
        <FlowBreadcrumb current={props.flowCurrent} nextStep={props.flowNext} />
      )}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="ds-h1">{props.title}</h1>
          {props.description && (
            <p className="mt-0.5 ds-subtitle">{props.description}</p>
          )}
          {props.hint && (
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-stone-500">
              {props.hint}
            </p>
          )}
        </div>
        {props.actions && (
          <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">{props.actions}</div>
        )}
      </div>
    </div>
  );
}
