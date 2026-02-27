"use client";

import Link from "next/link";

export type FlowStep = {
  label: string;
  href: string;
};

const operationsFlow: FlowStep[] = [
  { label: "Purchase Req", href: "/purchase/pr" },
  { label: "RFQ", href: "/purchase/rfq" },
  { label: "Purchase Order", href: "/purchase/po" },
  { label: "Gate Entry", href: "/inventory/gate-entry" },
  { label: "GRN", href: "/inventory/grn" },
  { label: "Work Orders", href: "/production/work-orders" },
  { label: "Production", href: "/production/dashboard" },
  { label: "Sales Orders", href: "/sales/orders" },
  { label: "Dispatch", href: "/dispatch" },
  { label: "Invoices", href: "/dispatch/invoices" },
];

export function FlowBreadcrumb({
  current,
  nextStep,
}: {
  current: string;
  nextStep?: { label: string; href: string };
}) {
  const activeIdx = operationsFlow.findIndex(
    (s) => current === s.href || current.startsWith(s.href + "/"),
  );

  if (activeIdx === -1) return null;

  const start = Math.max(0, activeIdx - 1);
  const end = Math.min(operationsFlow.length, activeIdx + 3);
  const visible = operationsFlow.slice(start, end);

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
      {start > 0 && <span className="text-stone-300">...</span>}
      {visible.map((step, i) => {
        const realIdx = start + i;
        const isActive = realIdx === activeIdx;
        return (
          <span key={step.href} className="flex items-center gap-1.5">
            {i > 0 && (
              <svg className="size-3 text-stone-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
            {isActive ? (
              <span className="rounded-md bg-gold-500 px-2 py-0.5 font-semibold text-gold-950">
                {step.label}
              </span>
            ) : (
              <Link
                href={step.href}
                className="rounded-md px-2 py-0.5 text-stone-400 transition-colors duration-150 hover:bg-stone-100 hover:text-stone-700"
              >
                {step.label}
              </Link>
            )}
          </span>
        );
      })}
      {end < operationsFlow.length && <span className="text-stone-300">...</span>}

      {nextStep && (
        <Link
          href={nextStep.href}
          className="ml-2 inline-flex items-center gap-1 rounded-md border border-gold-300 bg-gold-50 px-2.5 py-0.5 font-medium text-gold-800 transition-colors duration-150 hover:bg-gold-100"
        >
          Next: {nextStep.label}
          <svg className="size-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      )}
    </div>
  );
}
