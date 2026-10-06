"use client";

import { useActionState } from "react";
import { startHold, type HoldFormState } from "./actions";

export function HoldForm({ location, unitId, holdMinutes, minDate, maxDate }: { location: string; unitId: number; holdMinutes: number; minDate: string; maxDate: string }) {
  const [state, action, pending] = useActionState<HoldFormState, FormData>(startHold, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="location" value={location} />
      <input type="hidden" name="unitId" value={unitId} />
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="label">First name</span>
          <input name="firstName" required autoComplete="given-name" className="input" />
        </label>
        <label>
          <span className="label">Last name</span>
          <input name="lastName" required autoComplete="family-name" className="input" />
        </label>
      </div>
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" required autoComplete="email" inputMode="email" className="input" />
      </label>
      <label className="block">
        <span className="label">Mobile phone</span>
        <input name="phone" type="tel" required autoComplete="tel" inputMode="tel" className="input" />
      </label>
      <label className="block">
        <span className="label">Move-in date</span>
        <input name="moveInDate" type="date" required defaultValue={minDate} min={minDate} max={maxDate} className="input" />
      </label>
      {state.error && (
        <p className="rounded-xl bg-kv-red-50 p-3 text-sm font-semibold text-kv-red" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Holding your unit…" : `Hold this unit for ${holdMinutes} minutes`}
      </button>
      <p className="text-xs text-kv-muted">Nothing is charged to hold. You&apos;ll see the full price breakdown, including HST, on the next screen.</p>
    </form>
  );
}
