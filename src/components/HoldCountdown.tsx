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
            Your hold has ended
          </h2>
          <p className="mt-2 text-sm text-kv-muted">No problem — nothing was charged and the unit is back on the list. You can start again whenever you&apos;re ready.</p>
          <Link href={`/units?location=${location}`} className="btn-primary mt-5 w-full">
            Back to available units
          </Link>
        </div>
      </div>
    );
  }

  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-kv-navy px-4 py-3 text-white" role="timer" aria-live="off">
      <p className="text-sm">
        We&apos;re holding this unit for you. Take your time — if the timer runs out, you can just start again.
      </p>
      <p className="shrink-0 font-mono text-2xl font-bold text-kv-yellow tabular-nums" aria-label={`${m} minutes ${s} seconds left`}>
        {m}:{String(s).padStart(2, "0")}
      </p>
    </div>
  );
}
