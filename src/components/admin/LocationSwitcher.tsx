import Link from "next/link";
import { LOCATIONS, type LocationKey } from "@/config/locations";

export function LocationSwitcher({ current, basePath, extra = "" }: { current?: LocationKey; basePath: string; extra?: string }) {
  const tab = (active: boolean) => `rounded-full px-4 py-2 text-sm font-semibold ${active ? "bg-kv-navy text-white" : "bg-white text-kv-navy border border-kv-line hover:border-kv-navy"}`;
  const q = (loc?: string) => {
    const parts = [loc ? `location=${loc}` : "", extra].filter(Boolean).join("&");
    return parts ? `${basePath}?${parts}` : basePath;
  };
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Location">
      <Link href={q()} className={tab(!current)}>
        All sites
      </Link>
      {LOCATIONS.map((l) => (
        <Link key={l.key} href={q(l.key)} className={tab(current === l.key)}>
          {l.shortName}
        </Link>
      ))}
    </nav>
  );
}

export function Stat({ label, value, sub, tone = "navy" }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "navy" | "red" }) {
  return (
    <div className="rounded-xl bg-kv-navy-50 p-3">
      <p className="text-xs font-semibold text-kv-muted">{label}</p>
      <p className={`text-xl font-extrabold ${tone === "red" ? "text-kv-red" : "text-kv-navy"}`}>{value}</p>
      {sub && <p className="text-[11px] text-kv-muted">{sub}</p>}
    </div>
  );
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-extrabold text-kv-navy">{title}</h1>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    active: "bg-kv-yellow text-kv-navy",
    live: "bg-green-100 text-green-800",
    new: "bg-kv-red text-white",
    in_progress: "bg-kv-yellow text-kv-navy",
    done: "bg-green-100 text-green-800",
    sent: "bg-green-100 text-green-800",
    moved_in: "bg-green-100 text-green-800",
    confirmed_pay_separately: "bg-blue-100 text-blue-800",
    payment_failed: "bg-kv-red text-white",
    failed: "bg-kv-red text-white",
    error: "bg-kv-red text-white",
    published: "bg-green-100 text-green-800",
    draft: "bg-kv-navy-50 text-kv-navy",
  };
  return <span className={`badge ${tone[status] ?? "bg-kv-navy-50 text-kv-muted"}`}>{status.replace(/_/g, " ")}</span>;
}
