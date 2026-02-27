"use client";

import React from "react";

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <ErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

function ErrorFallback({
  error,
  onReset,
}: {
  error: Error | null;
  onReset: () => void;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="grid size-14 place-items-center rounded-full border border-red-200 bg-red-50 text-2xl text-red-500">
        !
      </div>
      <div>
        <h2 className="ds-h2">Something went wrong</h2>
        <p className="mx-auto mt-1.5 max-w-md ds-subtitle">
          An unexpected error occurred. You can try again, or navigate to a
          different page.
        </p>
        {error?.message && process.env.NODE_ENV === "development" ? (
          <pre className="mx-auto mt-3 max-w-lg overflow-auto rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-left text-xs text-stone-600">
            {error.message}
          </pre>
        ) : null}
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-800"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/dashboard";
          }}
          className="inline-flex items-center rounded-md border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
