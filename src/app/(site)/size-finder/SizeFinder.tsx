"use client";

import Link from "next/link";
import { useState } from "react";
import { getLocation } from "@/config/locations";
import { sizeFinderHref, STORAGE_NEEDS, type SizeFinderAnswer } from "@/lib/size-finder";

const LOCS = [
  { id: "", label: "Any location" },
  { id: "haley", label: "Haley Road, Antigonish (in town)" },
  { id: "hwy4", label: "Addington Forks, Hwy 4 / Exit 31" },
  { id: "stellarton", label: "Stellarton / New Glasgow area" },
] as const;

export function SizeFinder() {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<SizeFinderAnswer>({});
  const choice = STORAGE_NEEDS.find((w) => w.id === a.what);
  const climateRedirect = a.sensitive && a.location && a.location !== "haley";

  const option = (active: boolean) => `w-full rounded-2xl border px-5 py-4 text-left font-semibold transition ${active ? "border-kv-red bg-kv-red-50 text-kv-red" : "border-kv-line bg-white text-kv-navy hover:border-kv-navy"}`;

  return (
    <div className="card p-6 sm:p-8">
      <p className="text-xs font-bold text-kv-muted">{step === 3 ? "Your starting size estimate" : a.what === "vehicle" ? `Step ${step === 2 ? 2 : 1} of 2` : `Step ${step + 1} of 3`}</p>
      {step === 0 && (
        <fieldset className="mt-3">
          <legend className="text-xl font-extrabold text-kv-navy">What are you storing?</legend>
          <div className="mt-4 space-y-2">
            {STORAGE_NEEDS.map((w) => (
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
          <legend className="text-xl font-extrabold text-kv-navy">Would you prefer climate-controlled storage?</legend>
          <p className="mt-1 text-sm text-kv-muted">Wood furniture, electronics, photos, documents, instruments, artwork.</p>
          <div className="mt-4 space-y-2">
            <button type="button" className={option(a.sensitive === true)} onClick={() => (setA({ ...a, sensitive: true }), setStep(2))}>
              Yes, I&apos;d prefer climate control
            </button>
            <button type="button" className={option(a.sensitive === false)} onClick={() => (setA({ ...a, sensitive: false }), setStep(2))}>
              Show me all storage options
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
          <p className="eyebrow">A starting point for your belongings</p>
          <h2 className="mt-2 text-3xl font-extrabold text-kv-navy">{choice.sizes}</h2>
          <p className="mt-2 text-kv-muted">
            {a.sensitive ? "For climate-controlled storage, we'll show you the options at Haley Road. " : ""}
            {choice.id === "vehicle" ? "Check the space against your vehicle's dimensions before reserving." : choice.id === "business" ? "Business storage needs vary. Start by comparing these sizes, allowing room to reach your stock or equipment." : "The right fit depends on your furniture, number of boxes, and how much room you need to reach things."}
          </p>
          {climateRedirect && <p className="mt-3 text-sm text-kv-muted">You chose {getLocation(a.location || "haley").shortName}. To keep that location, you can compare options there without the climate-control filter below.</p>}
          <p className="mt-3 text-sm text-kv-muted">Not sure? Call <a href="tel:+19028673779" className="font-semibold text-kv-red underline">(902) 867-3779</a> before choosing. We&apos;ll help you compare sizes and prices.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href={sizeFinderHref(a)}
              className="btn-primary"
            >
              {a.sensitive ? "Compare sizes at Haley Road" : "Compare sizes and prices"}
            </Link>
            <button type="button" className="btn-ghost" onClick={() => (setA({}), setStep(0))}>
              Start over
            </button>
          </div>
          {climateRedirect && <Link href={sizeFinderHref({ ...a, sensitive: false })} className="mt-4 inline-block text-sm font-semibold text-kv-red underline">Compare options at {getLocation(a.location || "haley").shortName}</Link>}
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
