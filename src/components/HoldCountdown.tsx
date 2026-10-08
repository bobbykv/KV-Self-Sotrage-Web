"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function HoldCountdown({ holdId, expiresAt, location }: { holdId: string; expiresAt: string; location: string }) {
  const end = new Date(expiresAt).getTime();
  const [left, setLeft] = useState(() => Math.max(0, end - Date.now()));

  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, end - Date.now())), 1000);
    return () => clearInterval(t);
  }, [end]);

  useEffect(() => {
    if (left === 0) void fetch(`/api/holds/${holdId}/release`, { method: "POST" }).catch(() => undefined);
  }, [left, holdId]);

  if (left === 0) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-kv-navy/70 p-4" role="alertdialog" aria-labelledby="expired-title">
        <div className="max-w-sm rounded-3xl bg-white p-6 text-center">
          <h2 id="expired-title" className="text-xl font-extrabold text-kv-navy">
            Your unit hold has ended
          </h2>
          <p className="mt-2 text-sm text-kv-muted">Check availability and start a new hold.</p>
          <Link href={`/units?location=${location}`} className="btn-primary mt-5 w-full">
            See available units
          </Link>
        </div>
      </div>
    );
  }

  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <div className="rounded-2xl bg-kv-navy px-4 py-3 text-white" role="timer" aria-live="off">
      <p className="text-sm font-semibold" aria-label={`${m} minutes ${s} seconds left`}>
        Your hold ends in {m}:{String(s).padStart(2, "0")}.
      </p>
      <p className="mt-1 text-xs text-white/80">We hold your unit for 20 minutes while you check out. A hold does not take a payment or give you access.</p>
    </div>
  );
}
