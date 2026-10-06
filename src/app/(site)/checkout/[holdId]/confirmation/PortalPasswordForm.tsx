"use client";

import Link from "next/link";
import { useActionState } from "react";
import { setPortalPassword } from "./actions";

export function PortalPasswordForm({ holdId, email }: { holdId: string; email: string }) {
  const [state, action, pending] = useActionState(setPortalPassword.bind(null, holdId), {} as { ok?: boolean; error?: string });
  if (state.ok)
    return (
      <p className="rounded-xl bg-kv-navy-50 p-4 text-sm text-kv-navy">
        Your password is ready. Sign in at <Link href="/portal/login" className="font-bold underline">kvselfstorage.ca/portal</Link> with {email}.
      </p>
    );
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="label">Create your account password</span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </label>
      {state.error && <p className="text-sm font-semibold text-kv-red">{state.error}</p>}
      <button className="btn-navy w-full" disabled={pending}>
        {pending ? "Saving…" : "Create my account password"}
      </button>
    </form>
  );
}
