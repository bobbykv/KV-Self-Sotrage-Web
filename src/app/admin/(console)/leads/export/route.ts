import { getAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";

function csv(v: unknown): string {
  const s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return new Response("Unauthorized", { status: 401 });
  const channel = new URL(req.url).searchParams.get("channel");
  const leads = await db.lead.findMany({ where: channel ? { channel } : {}, orderBy: { createdAt: "desc" } });
  const cols = ["createdAt", "name", "phone", "email", "locationKey", "unitType", "unitSize", "notes", "channel", "reason", "ghlStatus", "ghlSentAt"] as const;
  const body = [cols.join(","), ...leads.map((l) => cols.map((c) => csv(l[c])).join(","))].join("\n");
  await audit(admin.email, "leads.export", channel ?? "all", { count: leads.length });
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="kv-leads-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
