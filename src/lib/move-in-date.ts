/** Calendar dates for the facilities, independent of the server's timezone. */
export function halifaxDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Halifax", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function moveInWindow(days = 30, now = new Date()) {
  const min = halifaxDate(now);
  const end = new Date(`${min}T12:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + days);
  return { min, max: end.toISOString().slice(0, 10) };
}

export function parseMoveInDate(value: string, days = 30, now = new Date()): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  const { min, max } = moveInWindow(days, now);
  return value >= min && value <= max ? date : null;
}
