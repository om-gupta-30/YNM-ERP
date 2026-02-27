import Link from "next/link";

export function AccessDenied(props: { title?: string; message?: string }) {
  return (
    <div className="ds-surface p-8 text-center">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full border border-stone-200 bg-stone-50 text-lg text-stone-400">
        ⊘
      </div>
      <div className="ds-h2">
        {props.title ?? "Access denied"}
      </div>
      <div className="mx-auto mt-1.5 max-w-sm ds-subtitle">
        {props.message ??
          "You don't have permission to access this module with your current role."}
      </div>
      <div className="mt-5">
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-all duration-200 hover:bg-stone-50 hover:shadow-md"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
