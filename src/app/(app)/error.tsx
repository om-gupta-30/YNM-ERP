"use client";

/**
 * Error boundary for all protected (app) routes.
 * Renders inside the app layout so the sidebar/header remain visible.
 */
export default function AppRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-rose-50 text-2xl text-rose-600">
        !
      </div>
      <div>
        <h2 className="text-base font-semibold text-stone-950">
          Something went wrong
        </h2>
        <p className="mt-1 max-w-md text-sm text-stone-600">
          This page encountered an error. You can try again or navigate elsewhere.
        </p>
        {process.env.NODE_ENV === "development" && error.message ? (
          <pre className="mx-auto mt-3 max-w-lg overflow-auto rounded-md bg-stone-100 px-3 py-2 text-left text-xs text-stone-700">
            {error.message}
          </pre>
        ) : null}
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-stone-800 transition-colors"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/dashboard";
          }}
          className="inline-flex items-center rounded-md bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm ring-1 ring-inset ring-stone-300 hover:bg-stone-50 transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
