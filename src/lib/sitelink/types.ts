import type { LocationKey } from "@/config/locations";

export type Unit = {
  locationKey: LocationKey;
  unitId: number;
  unitName: string;
  unitTypeId: number;
  typeName: string;
  widthFt: number;
  lengthFt: number;
  areaSqFt: number;
  floor: number | null;
  climate: boolean;
  power: boolean;
  inside: boolean;
  alarm: boolean;
  vehicle: boolean;
  /** Price we quote online: web rate when SiteLink has one, otherwise standard. */
  rate: number;
  standardRate: number;
  rented: boolean;
  rentable: boolean;
  excludedFromWebsite: boolean;
  waitingListReserved: boolean;
  description: string;
};

export type PriceListEntry = {
  locationKey: LocationKey;
  unitTypeId: number;
  typeName: string;
  widthFt: number;
  lengthFt: number;
  climate: boolean;
  standardRate: number;
  webRate: number | null;
  vacant: number | null;
  total: number | null;
};

export type CostLineKind = "rent" | "fee" | "deposit" | "insurance" | "discount" | "tax" | "other";
export type CostLine = { label: string; amount: number; kind: CostLineKind };

export type MoveInCost = {
  lines: CostLine[];
  preTax: number;
  tax: number;
  taxLabel: string;
  total: number;
  /** "sitelink" = SiteLink provided tax; "computed" = SiteLink returned no tax columns so we applied HST_RATE. */
  taxSource: "sitelink" | "computed";
  startDate: string | null;
  endDate: string | null;
};

export type Tenant = {
  tenantId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  accessCode: string;
  company: string;
};

export type Ledger = {
  ledgerId: number;
  unitId: number;
  unitName: string;
  rent: number;
  paidThrough: string | null;
  balance: number;
  scheduledMoveOut: string | null;
  accessCode: string;
};

export type Balance = {
  ledgerId: number;
  unitName: string;
  currentBalance: number;
  pastDue: number;
  daysPastDue: number;
};

export type BillingInfo = {
  autopay: boolean;
  method: string;
  /** Last four only; SiteLink returns masked numbers for this method. */
  last4: string | null;
  expires: string | null;
};

export type Reservation = {
  waitingId: number;
  tenantId: number;
  unitId: number;
  unitName: string;
  name: string;
  expires: string | null;
  needed: string | null;
  quotedRate: number;
  status: number;
  source: string;
};

export type ReportSummary = {
  pastDueCount: number | null;
  pastDueAmount: number | null;
  moveInsToday: number | null;
  moveOutsToday: number | null;
  occupancyPct: number | null;
};
