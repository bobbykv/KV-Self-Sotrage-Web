"use client";

import { useActionState } from "react";

type State = { ok?: boolean; error?: string; message?: string };

/** Small wrapper so server-rendered forms get pending/success/error states. */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Sending…",
  className = "space-y-3",
  buttonClassName = "btn-primary w-full",
  hideOnSuccess = true,
}: {
  action: (prev: State, form: FormData) => Promise<State>;
  children: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  buttonClassName?: string;
  hideOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  if (state.ok && hideOnSuccess) {
    return (
      <p className="rounded-xl bg-kv-navy-50 p-4 text-sm font-semibold text-kv-navy" role="status">
        {state.message ?? "Done."}
      </p>
    );
  }
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error && (
        <p className="rounded-xl bg-kv-red-50 p-3 text-sm font-semibold text-kv-red" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && state.message && <p className="text-sm font-semibold text-kv-navy">{state.message}</p>}
      <button type="submit" disabled={pending} className={buttonClassName}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
