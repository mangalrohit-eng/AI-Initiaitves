"use client";

import * as React from "react";
import { useToast } from "@/components/feedback/ToastProvider";

export type AsyncOpState = "idle" | "loading" | "success" | "error";

export type AsyncOpMessages<T> = {
  /** Title shown in the loading toast (auto-fires on `fire()`). */
  loadingTitle: string;
  /** Optional secondary line in the loading toast. */
  loadingDescription?: string;
  /** Title for the success toast, can use the resolved value. */
  successTitle: string | ((value: T) => string);
  /** Optional secondary line for the success toast. */
  successDescription?: string | ((value: T) => string | undefined);
  /** Title for the error toast (defaults to "Something went wrong"). */
  errorTitle?: string | ((error: unknown) => string);
  /** Optional secondary line for the error toast — typically the error message. */
  errorDescription?: string | ((error: unknown) => string | undefined);
};

export type UseAsyncOpOptions<T, A extends unknown[]> = {
  run: (...args: A) => Promise<T>;
  messages: AsyncOpMessages<T>;
  onSuccess?: (value: T) => void;
  onError?: (error: unknown) => void;
  /** When true, no toasts fire and only `state` is exposed. */
  silent?: boolean;
  /** When true, on error allows user to retry via the toast action. */
  retryable?: boolean;
};

export type UseAsyncOpResult<T, A extends unknown[]> = {
  state: AsyncOpState;
  error: unknown;
  data: T | undefined;
  fire: (...args: A) => Promise<T | undefined>;
  reset: () => void;
};

function resolveMessage<T, R>(value: R | ((arg: T) => R), arg: T): R {
  return typeof value === "function" ? (value as (a: T) => R)(arg) : value;
}

/**
 * Standardised wrapper for async operations that need user-facing
 * loading / success / failure feedback.
 *
 * Auto-fires a loading toast on `fire()`, swaps to success or error on settle,
 * and exposes `state` for in-button busy / disabled rendering.
 */
export function useAsyncOp<T, A extends unknown[] = []>(
  options: UseAsyncOpOptions<T, A>,
): UseAsyncOpResult<T, A> {
  const { run, messages, onSuccess, onError, silent, retryable } = options;
  const toast = useToast();
  const [state, setState] = React.useState<AsyncOpState>("idle");
  const [error, setError] = React.useState<unknown>(null);
  const [data, setData] = React.useState<T | undefined>(undefined);
  const lastArgs = React.useRef<A | null>(null);
  const mounted = React.useRef(true);

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fire = React.useCallback(
    async (...args: A): Promise<T | undefined> => {
      lastArgs.current = args;
      setState("loading");
      setError(null);
      const toastId = silent
        ? null
        : toast.loading({
            title: messages.loadingTitle,
            description: messages.loadingDescription,
          });
      try {
        const value = await run(...args);
        if (!mounted.current) return value;
        setData(value);
        setState("success");
        if (toastId) {
          toast.update(toastId, {
            kind: "success",
            title: resolveMessage(messages.successTitle, value),
            description: messages.successDescription
              ? resolveMessage(messages.successDescription, value)
              : undefined,
            action: undefined,
          });
        }
        onSuccess?.(value);
        return value;
      } catch (e) {
        if (!mounted.current) throw e;
        setError(e);
        setState("error");
        if (toastId) {
          const errorTitle = messages.errorTitle
            ? resolveMessage(messages.errorTitle, e)
            : "Something went wrong";
          const errorDescription = messages.errorDescription
            ? resolveMessage(messages.errorDescription, e)
            : e instanceof Error
              ? e.message
              : undefined;
          toast.update(toastId, {
            kind: "error",
            title: errorTitle,
            description: errorDescription,
            action:
              retryable && lastArgs.current
                ? {
                    label: "Retry",
                    onClick: () => {
                      void fire(...(lastArgs.current as A));
                    },
                  }
                : undefined,
          });
        }
        onError?.(e);
        return undefined;
      }
    },
    [run, messages, onSuccess, onError, silent, retryable, toast],
  );

  const reset = React.useCallback(() => {
    setState("idle");
    setError(null);
    setData(undefined);
  }, []);

  return { state, error, data, fire, reset };
}
