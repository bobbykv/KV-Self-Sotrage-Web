"use client";

import { useActionState, useState } from "react";
import { startHold, type HoldFormState } from "./actions";

export function HoldForm({ location, unitId, holdMinutes, minDate, maxDate }: { location: string; unitId: number; holdMinutes: number; minDate: string; maxDate: string }) {
  const [values, setValues] = useState({ firstName: "", lastName: "", email: "", phone: "", moveInDate: minDate });
  const [edited, setEdited] = useState(false);
  const [state, action, pending] = useActionState<HoldFormState, FormData>(async (prev, form) => {
    setEdited(false);
    return startHold(prev, form);
  }, {});
  function field(name: keyof typeof values) {
    return { value: values[name], onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((current) => ({ ...current, [name]: e.target.value }));
      setEdited(true);
    } };
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="location" value={location} />
      <input type="hidden" name="unitId" value={unitId} />
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="label">First name</span>
          <input name="firstName" required autoComplete="given-name" className="input" {...field("firstName")} />
        </label>
        <label>
          <span className="label">Last name</span>
          <input name="lastName" required autoComplete="family-name" className="input" {...field("lastName")} />
        </label>
      </div>
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" required autoComplete="email" inputMode="email" className="input" {...field("email")} />
      </label>
      <label className="block">
        <span className="label">Mobile number</span>
        <input name="phone" type="tel" required autoComplete="tel" inputMode="tel" className="input" {...field("phone")} />
      </label>
      <label className="block">
        <span className="label">Move-in date</span>
        <input name="moveInDate" type="date" required min={minDate} max={maxDate} className="input" {...field("moveInDate")} />
      </label>
      <p className="text-xs text-kv-muted">Use the email and mobile number you want us to contact you on.</p>
      {!pending && !edited && state.error && (
        <p className="rounded-xl bg-kv-red-50 p-3 text-sm font-semibold text-kv-red" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Starting your hold..." : "Hold this unit"}
      </button>
      <p className="text-xs text-kv-muted">Checkout shows your full move-in total, including fees and HST. We hold this unit for {holdMinutes} minutes while you review. Starting this step doesn&apos;t take a payment.</p>
    </form>
  );
}
