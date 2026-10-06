"use client";

import Link from "next/link";
import { useState } from "react";
import { getLocation } from "@/config/locations";
import { sizeFinderHref, STORAGE_NEEDS, type SizeFinderAnswer } from "@/lib/size-finder";

const LOCS = [
  { id: "", label: "Any location" },
  { id: "haley", label: "Haley Road, Antigonish" },
  { id: "hwy4", label: "Addington Forks, Exit 31" },
  { id: "stellarton", label: "Stellarton, Heritage Avenue" },
] as const;

export function SizeFinder() {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<SizeFinderAnswer>({});
  const choice = STORAGE_NEEDS.find((w) => w.id === a.what);
  const climateRedirect = a.sensitive === true && a.location && a.location !== "haley";

  const option = (active: boolean) => `w-full rounded-2xl border px-5 py-4 text-left font-semibold transition ${active ? "border-kv-red bg-kv-red-50 text-kv-red" : "border-kv-line bg-white text-kv-navy hover:border-kv-navy"}`;

  return (
    <div className="card p-6 sm:p-8">
      <p className="text-xs font-bold text-kv-muted">{step === 3 ? "Your suggested sizes" : a.what === "vehicle" ? `Step ${step === 2 ? 2 : 1} of 2` : `Step ${step + 1} of 3`}</p>
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
          <legend className="text-xl font-extrabold text-kv-navy">Do you need climate control?</legend>
          <p className="mt-1 text-sm text-kv-muted">Climate-controlled units are at Haley Road in Antigonish. Call us if you&apos;re unsure whether you need one.</p>
          <div className="mt-4 space-y-2">
            <button type="button" className={option(a.sensitive === true)} onClick={() => { setA({ ...a, sensitive: true }); setStep(2); }}>
              Yes
            </button>
            <button type="button" className={option(a.sensitive === false)} onClick={() => { setA({ ...a, sensitive: false }); setStep(2); }}>
              No
            </button>
            <button type="button" className={option(a.sensitive === "unsure")} onClick={() => { setA({ ...a, sensitive: "unsure" }); setStep(2); }}>
              Not sure
            </button>
          </div>
        </fieldset>
      )}
      {step === 2 && (
        <fieldset className="mt-3">
          <legend className="text-xl font-extrabold text-kv-navy">Which location works for you?</legend>
          <div className="mt-4 space-y-2">
            {LOCS.map((l) => (
              <button key={l.id} type="button" className={option(a.location === l.id)} onClick={() => { setA({ ...a, location: l.id }); setStep(3); }}>
                {l.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {step === 3 && choice && (
        <div className="mt-3">
          <h2 className="text-2xl font-extrabold text-kv-navy">Start with these sizes</h2>
          <p className="mt-2 text-kv-muted">
            {choice.result} This is an estimate. Large furniture, box count and space to walk inside can change what you need.
          </p>
          {a.sensitive === true && <p className="mt-3 text-sm text-kv-muted">For climate control, compare units at Haley Road in Antigonish.</p>}
          {climateRedirect && <p className="mt-3 text-sm text-kv-muted">You chose {getLocation(a.location || "haley").shortName}. You can also compare options there without the climate-control filter.</p>}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href={sizeFinderHref(a)} className="btn-primary">
              See matching units &amp; prices
            </Link>
            <button type="button" className="btn-ghost" onClick={() => { setA({}); setStep(0); }}>
              Start again
            </button>
          </div>
          {climateRedirect && (
            <Link href={sizeFinderHref({ ...a, sensitive: false })} className="mt-4 inline-block text-sm font-semibold text-kv-red underline">
              Compare options at {getLocation(a.location || "haley").shortName}
            </Link>
          )}
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
