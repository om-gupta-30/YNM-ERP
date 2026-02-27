"use client";

/**
 * Next.js root-level error boundary.
 * Catches errors that escape all nested error.tsx boundaries,
 * including errors in the root layout itself.
 * Must provide its own <html>/<body> since the root layout may have failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-stone-50 text-stone-950 antialiased">
        <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-8 text-center">
          <div className="grid size-16 place-items-center rounded-full bg-rose-50 text-3xl text-rose-600">
            !
          </div>
          <div>
            <h1 className="text-lg font-semibold text-stone-950">
              Application Error
            </h1>
            <p className="mt-1 max-w-md text-sm text-stone-600">
              The application encountered a critical error. Please try
              refreshing the page.
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
      </body>
    </html>
  );
}
