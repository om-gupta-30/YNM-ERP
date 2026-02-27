/**
 * Standardized error handling for the ERP application.
 *
 * AppError provides a typed error class with HTTP-like codes.
 * withRetry wraps async operations with exponential backoff for transient failures.
 */

export type ErrorCode =
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "DB_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION"
  | "AUTH_ERROR"
  | "PERMISSION_DENIED"
  | "UNKNOWN";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly originalError?: unknown;

  constructor(
    message: string,
    code: ErrorCode = "UNKNOWN",
    opts?: { retryable?: boolean; cause?: unknown },
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.retryable = opts?.retryable ?? false;
    this.originalError = opts?.cause;
  }
}

const TRANSIENT_MESSAGES = [
  "failed to fetch",
  "load failed",
  "networkerror",
  "network request failed",
  "fetch failed",
  "econnreset",
  "econnrefused",
  "socket hang up",
  "timeout",
  "abort",
  "rate limit",
  "too many requests",
  "503",
  "502",
  "504",
];

export function isTransientError(err: unknown): boolean {
  if (err instanceof AppError) return err.retryable;

  const msg =
    err instanceof Error
      ? err.message.toLowerCase()
      : String(err).toLowerCase();
  return TRANSIENT_MESSAGES.some((t) => msg.includes(t));
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (isTransientError(err)) {
    return new AppError(message, "NETWORK_ERROR", {
      retryable: true,
      cause: err,
    });
  }
  if (lower.includes("not found")) {
    return new AppError(message, "NOT_FOUND", { cause: err });
  }
  if (lower.includes("already exists") || lower.includes("duplicate") || lower.includes("23505")) {
    return new AppError(message, "CONFLICT", { cause: err });
  }
  if (lower.includes("permission") || lower.includes("unauthorized") || lower.includes("forbidden")) {
    return new AppError(message, "PERMISSION_DENIED", { cause: err });
  }
  if (lower.includes("invalid") || lower.includes("required") || lower.includes("must be")) {
    return new AppError(message, "VALIDATION", { cause: err });
  }

  return new AppError(message, "UNKNOWN", { cause: err });
}

type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
};

/**
 * Executes `fn` up to `maxAttempts` times with exponential backoff + jitter.
 * Only retries on transient (network/timeout) errors.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: RetryOptions,
): Promise<T> {
  const maxAttempts = opts?.maxAttempts ?? 3;
  const baseDelay = opts?.baseDelayMs ?? 500;
  const maxDelay = opts?.maxDelayMs ?? 5000;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt >= maxAttempts || !isTransientError(err)) {
        throw toAppError(err);
      }

      opts?.onRetry?.(attempt, err);

      const delay = Math.min(
        baseDelay * Math.pow(2, attempt - 1) + Math.random() * baseDelay,
        maxDelay,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw toAppError(lastError);
}

export function getUserFriendlyMessage(err: unknown): string {
  if (err instanceof AppError) {
    switch (err.code) {
      case "NETWORK_ERROR":
        return "Network error. Please check your connection and try again.";
      case "TIMEOUT":
        return "The request timed out. Please try again.";
      case "NOT_FOUND":
        return "The requested resource was not found.";
      case "CONFLICT":
        return err.message;
      case "VALIDATION":
        return err.message;
      case "AUTH_ERROR":
        return "Authentication failed. Please sign in again.";
      case "PERMISSION_DENIED":
        return "You do not have permission to perform this action.";
      default:
        return "An unexpected error occurred. Please try again.";
    }
  }
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred. Please try again.";
}
