import * as React from "react";
import Link from "next/link";
import { NavIcon } from "@/components/layout/NavIcon";

export function EmptyState(props: {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 bg-stone-50/50 px-6 py-12 text-center">
      {props.icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-full border border-stone-200 bg-white text-stone-400">
          <NavIcon name={props.icon} className="size-5" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-stone-700">{props.title}</h3>
      {props.description && (
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-stone-500">
          {props.description}
        </p>
      )}
      {(props.actionLabel && props.actionHref) && (
        <Link
          href={props.actionHref}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-800"
        >
          {props.actionLabel}
        </Link>
      )}
      {(props.actionLabel && props.onAction && !props.actionHref) && (
        <button
          type="button"
          onClick={props.onAction}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-800"
        >
          {props.actionLabel}
        </button>
      )}
    </div>
  );
}
