"use client";

import Link from "next/link";
import { useState } from "react";

type Answer = { what?: string; sensitive?: boolean; location?: string };

const WHAT = [
  { id: "boxes", label: "A few boxes, seasonal gear or a dorm room", size: "small", sizes: "5′×5′ or 5′×10′" },
  { id: "apt1", label: "A studio or 1-bedroom apartment", size: "medium", sizes: "5′×10′ to 10′×10′" },
  { id: "home2", label: "A 2–3 bedroom home", size: "large", sizes: "10′×15′ to 10′×20′" },
  { id: "home4", label: "A large home, or business stock & equipment", size: "large", sizes: "10′×20′ to 10′×30′" },
  { id: "vehicle", label: "A car, RV, boat or trailer", size: "parking", sizes: "Parking space or vehicle storage" },
];

const LOCS = [
  { id: "", label: "Any location" },
  { id: "haley", label: "Haley Road, Antigonish (in town)" },
  { id: "hwy4", label: "Addington Forks — Hwy 4, Exit 31" },
  { id: "stellarton", label: "Stellarton / New Glasgow area" },
];

export function SizeFinder() {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answer>({});
  const choice = WHAT.find((w) => w.id === a.what);

  const option = (active: boolean) => `w-full rounded-2xl border px-5 py-4 text-left font-semibold transition ${active ? "border-kv-red bg-kv-red-50 text-kv-red" : "border-kv-line bg-white text-kv-navy hover:border-kv-navy"}`;

  return (
    <div className="card p-6 sm:p-8">
      <p className="text-xs font-bold text-kv-muted">Step {Math.min(step + 1, 3)} of 3</p>
      {step === 0 && (
        <fieldset className="mt-3">
          <legend className="text-xl font-extrabold text-kv-navy">What are you storing?</legend>
          <div className="mt-4 space-y-2">
            {WHAT.map((w) => (
              <button
                key={w.id}
                type="button"
                className={option(a.what === w.id)}
                onClick={() => {
                  setA({ ...a, what: w.id, sensitive: w.id === "vehicle" ? false : a.sensitive });
                  setStep(w.id === "vehicle" ? 2 : 1);
                }}
              >
                {w.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {step === 1 && (
        <fieldset className="mt-3">
          <legend className="text-xl font-extrabold text-kv-navy">Anything sensitive to cold, heat or damp?</legend>
          <p className="mt-1 text-sm text-kv-muted">Wood furniture, electronics, photos, documents, instruments, artwork.</p>
          <div className="mt-4 space-y-2">
            <button type="button" className={option(a.sensitive === true)} onClick={() => (setA({ ...a, sensitive: true }), setStep(2))}>
              Yes — I&apos;d like climate control
            </button>
            <button type="button" className={option(a.sensitive === false)} onClick={() => (setA({ ...a, sensitive: false }), setStep(2))}>
              No — regular storage is fine
            </button>
          </div>
        </fieldset>
      )}
      {step === 2 && (
        <fieldset className="mt-3">
          <legend className="text-xl font-extrabold text-kv-navy">Which location suits you?</legend>
          <div className="mt-4 space-y-2">
            {LOCS.map((l) => (
              <button key={l.id} type="button" className={option(a.location === l.id)} onClick={() => (setA({ ...a, location: l.id }), setStep(3))}>
                {l.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {step === 3 && choice && (
        <div className="mt-3">
          <p className="eyebrow">Our suggestion</p>
          <h2 className="mt-2 text-3xl font-extrabold text-kv-navy">{choice.sizes}</h2>
          <p className="mt-2 text-kv-muted">
            {a.sensitive ? "Climate-controlled units are at our Haley Road location. " : ""}
            Not sure between two sizes? Go a little bigger — it&apos;s easier to stack safely with room to walk in.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/units?size=${choice.size}${a.location ? `&location=${a.location}` : a.sensitive ? "&location=haley" : ""}${a.sensitive ? "&climate=1" : ""}`}
              className="btn-primary"
            >
              Show matching units
            </Link>
            <button type="button" className="btn-ghost" onClick={() => (setA({}), setStep(0))}>
              Start over
            </button>
          </div>
        </div>
      )}
      {step > 0 && step < 3 && (
        <button type="button" onClick={() => setStep(step === 2 && a.what === "vehicle" ? 0 : step - 1)} className="mt-4 text-sm font-semibold text-kv-muted underline">
          Back
        </button>
      )}
    </div>
  );
}
