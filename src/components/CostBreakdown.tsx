import { money } from "@/lib/catalog";
import type { MoveInCost } from "@/lib/sitelink/types";

export function CostBreakdown({ cost, hstRate }: { cost: MoveInCost; hstRate: number }) {
  return (
    <div>
      <table className="w-full text-sm" aria-label="Move-in cost breakdown">
        <tbody>
          {cost.lines.map((l, i) => (
            <tr key={i} className="border-b border-kv-line">
              <td className="py-2.5 pr-3">{l.label}</td>
              <td className={`py-2.5 text-right font-semibold tabular-nums ${l.amount < 0 ? "text-green-700" : ""}`}>{money(l.amount)}</td>
            </tr>
          ))}
          <tr className="border-b border-kv-line text-kv-muted">
            <td className="py-2.5 pr-3">Subtotal</td>
            <td className="py-2.5 text-right font-semibold tabular-nums">{money(cost.preTax)}</td>
          </tr>
          <tr className="border-b border-kv-line">
            <td className="py-2.5 pr-3 font-semibold text-kv-navy">
              {cost.taxLabel}
              {cost.taxSource === "computed" && <span className="ml-1 text-xs font-normal text-kv-muted">({Math.round(hstRate * 1000) / 10}%)</span>}
            </td>
            <td className="py-2.5 text-right font-semibold tabular-nums">{money(cost.tax)}</td>
          </tr>
          <tr>
            <td className="pt-3 text-base font-extrabold text-kv-navy">Total due today</td>
            <td className="pt-3 text-right text-xl font-extrabold text-kv-red tabular-nums">{money(cost.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
