import { useEffect, useRef, useState } from "react";

/**
 * Returns a debounced version of `value` that only updates after `delayMs`
 * of inactivity. Useful for search inputs to avoid filtering/re-rendering
 * on every keystroke.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}

/**
 * Returns a stable debounced callback that only fires after `delayMs`
 * of inactivity since the last invocation.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs = 300,
): (...args: Args) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (...args: Args) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => fnRef.current(...args), delayMs);
  };
}
