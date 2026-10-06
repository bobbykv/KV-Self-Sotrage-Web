/** Card helpers for pass-through mode. Pure functions; nothing here stores or logs. */

export type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "unknown";

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

export function luhnValid(pan: string): boolean {
  const d = digitsOnly(pan);
  if (d.length < 12 || d.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

export function cardBrand(pan: string): CardBrand {
  const d = digitsOnly(pan);
  if (/^4/.test(d)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "mastercard";
  if (/^3[47]/.test(d)) return "amex";
  if (/^(6011|65|64[4-9])/.test(d)) return "discover";
  return "unknown";
}

const BRAND_NAME_RE: Record<CardBrand, RegExp> = {
  visa: /visa/i,
  mastercard: /master/i,
  amex: /amex|american/i,
  discover: /discover/i,
  unknown: /$^/,
};

/** Maps a brand to the site-specific SiteLink payment type id from PaymentTypesRetrieve. */
export function paymentTypeIdFor(brand: CardBrand, types: { id: number; name: string; isCard: boolean }[]): number | null {
  return types.find((t) => t.isCard && BRAND_NAME_RE[brand].test(t.name))?.id ?? null;
}

/** "MM/YY" or "MM/YYYY" -> last day of that month, or null when invalid/expired. */
export function parseExpiry(input: string, now = new Date()): Date | null {
  const m = input.trim().match(/^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/);
  if (!m) return null;
  const month = Number(m[1]);
  const year = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  if (month < 1 || month > 12) return null;
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  return end.getTime() < now.getTime() ? null : end;
}
