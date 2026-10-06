import "server-only";
/**
 * SiteLink stand-in used when SITELINK_MODE=mock or APP_TEST_MODE=1.
 * Returns DataSets shaped like the real API so the mappers and every flow
 * above them run unchanged. Prices here are DEMO values, not KV's real rates.
 *
 * State is persisted in Postgres (MockSiteLinkState) so fake rentals and the
 * demo portal login survive serverless restarts on Vercel.
 *
 * Demo tenant login: demo@kvselfstorage.ca / demo1234
 * Simulator cards: 4242…4242 approve · 4000…0002 decline · 4000…0119 timeout
 */
import type { LocationKey } from "@/config/locations";
import { loadMockPayload, saveMockPayload } from "./mock-store";
import type { Args } from "./soap";
import type { DataSet, Row } from "./dataset";

type MockUnit = Row & { UnitID: string; bRented: string };
type MockTenant = { TenantID: number; sFName: string; sLName: string; sEmail: string; sPhone: string; sAccessCode: string; password: string };
type MockReservation = Row;
type MockLedger = {
  LedgerID: number;
  TenantID: number;
  UnitID: number;
  sUnitName: string;
  dcRent: number;
  dPaidThru: string;
  dcChargeBalance: number;
  dcPastDue: number;
  iDaysPastDue: number;
  dSchedOut: string;
  autopay: boolean;
};

export type MockState = {
  units: Record<LocationKey, MockUnit[]>;
  tenants: Record<LocationKey, MockTenant[]>;
  reservations: Record<LocationKey, MockReservation[]>;
  ledgers: Record<LocationKey, MockLedger[]>;
  nextId: number;
  /** WaitingIDs that already completed a simulated move-in (idempotent reject). */
  completedMoves: string[];
};

const g = globalThis as unknown as { __kvMock?: MockState };

type Spec = { type: string; w: number; l: number; rate: number; climate?: boolean; inside?: boolean; power?: boolean; count: number; rented: number };

const SPECS: Record<LocationKey, Spec[]> = {
  haley: [
    { type: "Drive-up", w: 5, l: 5, rate: 65, count: 4, rented: 3 },
    { type: "Drive-up", w: 5, l: 10, rate: 95, count: 6, rented: 4 },
    { type: "Drive-up", w: 10, l: 10, rate: 140, count: 8, rented: 6 },
    { type: "Drive-up", w: 10, l: 20, rate: 210, count: 4, rented: 4 },
    { type: "Climate Controlled", w: 5, l: 10, rate: 120, climate: true, inside: true, power: true, count: 4, rented: 2 },
    { type: "Climate Controlled", w: 10, l: 10, rate: 175, climate: true, inside: true, power: true, count: 4, rented: 3 },
    { type: "Outdoor Parking", w: 10, l: 30, rate: 75, count: 6, rented: 3 },
    { type: "Indoor Vehicle Storage", w: 12, l: 35, rate: 190, inside: true, count: 2, rented: 2 },
  ],
  hwy4: [
    { type: "Drive-up", w: 5, l: 10, rate: 90, count: 6, rented: 3 },
    { type: "Drive-up", w: 10, l: 10, rate: 135, count: 8, rented: 5 },
    { type: "Drive-up", w: 10, l: 15, rate: 165, count: 4, rented: 2 },
    { type: "Drive-up", w: 10, l: 20, rate: 200, count: 4, rented: 3 },
    { type: "Drive-up", w: 10, l: 30, rate: 255, count: 2, rented: 2 },
  ],
  stellarton: [
    { type: "Drive-up", w: 5, l: 10, rate: 95, count: 6, rented: 2 },
    { type: "Drive-up", w: 10, l: 10, rate: 140, count: 8, rented: 4 },
    { type: "Drive-up", w: 10, l: 15, rate: 175, count: 4, rented: 4 },
    { type: "Drive-up", w: 10, l: 20, rate: 210, count: 6, rented: 3 },
  ],
};

const PREFIX: Record<LocationKey, string> = { haley: "H", hwy4: "A", stellarton: "S" };

/** Simulator-only cards — never send these to a live processor. */
export const SIM_CARD_APPROVE = "4242424242424242";
export const SIM_CARD_DECLINE = "4000000000000002";
export const SIM_CARD_TIMEOUT = "4000000000000119";

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10) + "T00:00:00";
}

export function initMockState(): MockState {
  const units = {} as MockState["units"];
  let typeId = 100;
  let unitId = 1000;
  for (const [loc, specs] of Object.entries(SPECS) as [LocationKey, Spec[]][]) {
    units[loc] = [];
    for (const s of specs) {
      typeId++;
      for (let i = 0; i < s.count; i++) {
        unitId++;
        units[loc].push({
          UnitID: String(unitId),
          sUnitName: `${PREFIX[loc]}${s.w}${s.l}-${i + 1}`,
          UnitTypeID: String(typeId),
          sTypeName: s.type,
          dcWidth: String(s.w),
          dcLength: String(s.l),
          iFloor: "1",
          bClimate: String(!!s.climate),
          bInside: String(!!s.inside),
          bPower: String(!!s.power),
          bAlarm: "false",
          dcStdRate: String(s.rate),
          dcWebRate: String(s.rate),
          bRentable: "true",
          bRented: String(i < s.rented),
          bExcludeFromWebsite: "false",
          sUnitDesc: "",
        });
      }
    }
  }
  const demo = (TenantID: number): MockTenant => ({
    TenantID,
    sFName: "Demo",
    sLName: "Tenant",
    sEmail: "demo@kvselfstorage.ca",
    sPhone: "9025550100",
    sAccessCode: "4821",
    password: "demo1234",
  });
  const haleyUnit = units.haley.find((u) => u.bRented === "true" && u.sTypeName === "Drive-up")!;
  const stelUnit = units.stellarton.find((u) => u.bRented === "true")!;
  return {
    units,
    tenants: { haley: [demo(501)], hwy4: [], stellarton: [demo(701)] },
    reservations: { haley: [], hwy4: [], stellarton: [] },
    ledgers: {
      haley: [
        {
          LedgerID: 9001,
          TenantID: 501,
          UnitID: Number(haleyUnit.UnitID),
          sUnitName: haleyUnit.sUnitName,
          dcRent: 65,
          dPaidThru: isoDay(-12),
          dcChargeBalance: 74.1,
          dcPastDue: 74.1,
          iDaysPastDue: 12,
          dSchedOut: "",
          autopay: false,
        },
      ],
      hwy4: [],
      stellarton: [
        {
          LedgerID: 9101,
          TenantID: 701,
          UnitID: Number(stelUnit.UnitID),
          sUnitName: stelUnit.sUnitName,
          dcRent: 95,
          dPaidThru: isoDay(18),
          dcChargeBalance: 0,
          dcPastDue: 0,
          iDaysPastDue: 0,
          dSchedOut: "",
          autopay: true,
        },
      ],
    },
    nextId: 20000,
    completedMoves: [],
  };
}

function normalize(raw: MockState): MockState {
  return {
    ...raw,
    completedMoves: Array.isArray(raw.completedMoves) ? raw.completedMoves.map(String) : [],
  };
}

async function loadState(): Promise<MockState> {
  const fromDb = await loadMockPayload<MockState>();
  if (fromDb?.units && fromDb?.tenants && fromDb?.ledgers) {
    const st = normalize(fromDb);
    g.__kvMock = st;
    return st;
  }
  if (g.__kvMock) return g.__kvMock;
  const initial = initMockState();
  g.__kvMock = initial;
  await saveMockPayload(initial);
  return initial;
}

async function persist(st: MockState): Promise<void> {
  g.__kvMock = st;
  await saveMockPayload(st);
}

const ok = (code = 1, msg = ""): Row => ({ Ret_Code: String(code), Ret_Msg: msg });
const fail = (msg: string, code = -1): DataSet => ({ RT: [ok(code, msg)] });
const s = (v: unknown) => (v === undefined || v === null ? "" : v instanceof Date ? v.toISOString() : String(v));

function activeReservationUnitIds(st: MockState, loc: LocationKey): Set<string> {
  const now = Date.now();
  return new Set(
    st.reservations[loc]
      .filter((r) => r.iStatus === "0" && new Date(r.dExpires).getTime() > now)
      .map((r) => r.UnitID),
  );
}

const MUTATING = new Set([
  "TenantNewDetailed_v3",
  "TenantLoginAndSecurityUpdate",
  "ReservationNewWithSource_v5",
  "ReservationUpdate_v4",
  "MoveInWithDiscount_v7",
  "ScheduleMoveOut",
]);

export async function invokeMock(method: string, loc: LocationKey, args: Args): Promise<DataSet> {
  await new Promise((r) => setTimeout(r, 30));
  const st = await loadState();
  let result: DataSet;

  switch (method) {
    case "SiteInformation":
      result = { Table: [{ sLocationCode: loc, sSiteName: loc }], RT: [ok()] };
      break;
    case "UnitsInformationAvailableUnitsOnly_v2": {
      const reserved = activeReservationUnitIds(st, loc);
      result = {
        Table: st.units[loc].filter((u) => u.bRented !== "true").map((u) => ({ ...u, bWaitingListReserved: String(reserved.has(u.UnitID)) })),
        RT: [ok()],
      };
      break;
    }
    case "UnitsInformation_v3":
      result = { Table: st.units[loc], RT: [ok()] };
      break;
    case "UnitsInformationByUnitID": {
      const u = st.units[loc].find((x) => x.UnitID === s(args.UnitID));
      result = u
        ? { Table: [{ ...u, bWaitingListReserved: String(activeReservationUnitIds(st, loc).has(u.UnitID)) }], RT: [ok()] }
        : fail("Unit not found");
      break;
    }
    case "UnitTypePriceList_v2": {
      const byType = new Map<string, Row & { iTotalVacant: string; iTotalUnits: string }>();
      for (const u of st.units[loc]) {
        const e = byType.get(u.UnitTypeID) ?? { ...u, iTotalVacant: "0", iTotalUnits: "0" };
        e.iTotalUnits = String(Number(e.iTotalUnits) + 1);
        if (u.bRented !== "true") e.iTotalVacant = String(Number(e.iTotalVacant) + 1);
        byType.set(u.UnitTypeID, e);
      }
      result = { Table: [...byType.values()], RT: [ok()] };
      break;
    }
    case "PaymentTypesRetrieve":
      result = {
        Table: [
          { PmtTypeID: "5", sPmtTypeDesc: "Visa", bCreditCard: "true" },
          { PmtTypeID: "6", sPmtTypeDesc: "Master Card", bCreditCard: "true" },
          { PmtTypeID: "7", sPmtTypeDesc: "American Express", bCreditCard: "true" },
        ],
        RT: [ok()],
      };
      break;
    case "DiscountPlansRetrieve":
    case "KeypadZonesRetrieve":
      result = { RT: [ok()] };
      break;
    case "TenantSearchDetailed": {
      const email = s(args.sEmailAddress).toLowerCase();
      const last = s(args.sTenantLastName).toLowerCase();
      const phone = s(args.sPhoneNumber).replace(/\D/g, "");
      const rows = st.tenants[loc].filter(
        (t) =>
          (email && t.sEmail.toLowerCase() === email) ||
          (last && t.sLName.toLowerCase().startsWith(last)) ||
          (phone && t.sPhone.endsWith(phone.slice(-7))),
      );
      result = { Table: rows.map(tenantRow), RT: [ok()] };
      break;
    }
    case "TenantNewDetailed_v3": {
      const id = ++st.nextId;
      st.tenants[loc].push({
        TenantID: id,
        sFName: s(args.sFName),
        sLName: s(args.sLName),
        sEmail: s(args.sEmail),
        sPhone: s(args.sPhone),
        sAccessCode: String(1000 + (id % 9000)),
        password: s(args.sWebPassword),
      });
      result = { RT: [ok(id)] };
      break;
    }
    case "TenantLogin": {
      const t = st.tenants[loc].find(
        (x) => x.sEmail.toLowerCase() === s(args.sTenantLogin).toLowerCase() && x.password === s(args.sTenantPassword) && x.password,
      );
      result = t ? { Table: [tenantRow(t)], RT: [ok(t.TenantID)] } : fail("Invalid login", -2);
      break;
    }
    case "TenantInfoByTenantID": {
      const t = st.tenants[loc].find((x) => x.TenantID === Number(args.iTenantID));
      result = t ? { Table: [tenantRow(t)], RT: [ok()] } : fail("Tenant not found");
      break;
    }
    case "TenantLoginAndSecurityUpdate": {
      const t = st.tenants[loc].find((x) => x.TenantID === Number(args.TenantID));
      if (!t) {
        result = fail("Tenant not found");
        break;
      }
      t.sEmail = s(args.sEmail) || t.sEmail;
      t.password = s(args.sWebPassword);
      result = { RT: [ok()] };
      break;
    }
    case "TenantIDByUnitNameOrAccessCode": {
      const unit = st.units[loc].find((u) => u.sUnitName.toLowerCase() === s(args.sUnitName).toLowerCase());
      const ledger = unit && st.ledgers[loc].find((l) => l.UnitID === Number(unit.UnitID));
      result = ledger ? { Table: [{ TenantID: String(ledger.TenantID) }], RT: [ok(ledger.TenantID)] } : fail("No tenant for unit");
      break;
    }
    case "LedgersByTenantID_v3": {
      const tenant = st.tenants[loc].find((t) => t.TenantID === Number(args.sTenantID));
      const rows = st.ledgers[loc].filter((l) => l.TenantID === Number(args.sTenantID));
      result = { Table: rows.map((l) => ({ ...stringify(l), sAccessCode: tenant?.sAccessCode ?? "" })), RT: [ok()] };
      break;
    }
    case "CustomerAccountsBalanceDetails_v2": {
      const rows = st.ledgers[loc].filter((l) => l.TenantID === Number(args.iTenantID));
      result = {
        Table: rows.map((l) => ({
          LedgerID: String(l.LedgerID),
          sUnitName: l.sUnitName,
          dcBalance: String(l.dcChargeBalance),
          dcPastDue: String(l.dcPastDue),
          iDaysPastDue: String(l.iDaysPastDue),
        })),
        RT: [ok()],
      };
      break;
    }
    case "TenantBillingInfoByTenantID_v3": {
      const l = st.ledgers[loc].find((x) => x.TenantID === Number(args.iTenantID));
      result = {
        Table: [
          {
            iAutoBillType: l?.autopay ? "1" : "0",
            sCreditCardNum: l?.autopay ? "XXXXXXXXXXXX4242" : "",
            dCreditCardExpir: l?.autopay ? "2028-04-30T00:00:00" : "",
          },
        ],
        RT: [ok()],
      };
      break;
    }
    case "ReservationNewWithSource_v5": {
      const unit = st.units[loc].find((u) => u.UnitID === s(args.sUnitID));
      if (!unit || unit.bRented === "true") {
        result = fail("Unit not available");
        break;
      }
      if (activeReservationUnitIds(st, loc).has(unit.UnitID)) {
        result = fail("Unit already reserved", -5);
        break;
      }
      const tenant = st.tenants[loc].find((t) => t.TenantID === Number(args.sTenantID));
      const id = ++st.nextId;
      st.reservations[loc].push({
        WaitingID: String(id),
        TenantID: s(args.sTenantID),
        UnitID: unit.UnitID,
        sUnitName: unit.sUnitName,
        sFName: tenant?.sFName ?? "",
        sLName: tenant?.sLName ?? "",
        dExpires: s(args.dExpires),
        dNeeded: s(args.dNeeded),
        dcRate_Quoted: s(args.dcQuotedRate),
        iStatus: "0",
        QTRentalTypeID: s(args.QTRentalTypeID),
        iSource: s(args.iSource),
        sSource: s(args.sSource),
      });
      result = { RT: [ok(id)] };
      break;
    }
    case "ReservationUpdate_v4": {
      const r = st.reservations[loc].find((x) => x.WaitingID === s(args.WaitingID));
      if (!r) {
        result = fail("Reservation not found");
        break;
      }
      r.dExpires = s(args.dExpires);
      r.iStatus = s(args.iStatus ?? 0);
      result = { RT: [ok()] };
      break;
    }
    case "ReservationList_v3": {
      const id = Number(args.WaitingID ?? 0);
      const rows = st.reservations[loc].filter((r) => !id || Number(r.WaitingID) === id);
      result = { Table: rows, RT: [ok()] };
      break;
    }
    case "ReservationNoteInsert":
      result = { RT: [ok()] };
      break;
    case "MoveInCostRetrieveWithDiscount_Reservation_v4": {
      const unit = st.units[loc].find((u) => u.UnitID === s(args.iUnitID));
      if (!unit) {
        result = fail("Unit not found");
        break;
      }
      const rent = Number(unit.dcWebRate);
      result = {
        Table: [
          {
            ChargeDescription: "Rent (first month)",
            ChargeAmount: rent.toFixed(2),
            dcTax1: (rent * 0.14).toFixed(2),
            dcTax2: "0",
            dcDiscount: "0",
            StartDate: s(args.dMoveInDate),
            EndDate: "",
          },
          { ChargeDescription: "Administrative fee", ChargeAmount: "20.00", dcTax1: "2.80", dcTax2: "0", dcDiscount: "0" },
        ],
        RT: [ok()],
      };
      break;
    }
    case "MoveInWithDiscount_v7": {
      const pan = s(args.sCreditCardNumber).replace(/\D/g, "");
      const waitingId = s(args.WaitingID);
      if (pan === SIM_CARD_TIMEOUT) {
        throw new Error("MoveInWithDiscount_v7: transport error Simulated payment timeout");
      }
      if (pan === SIM_CARD_DECLINE) {
        result = fail("Card declined by processor", -11);
        break;
      }
      if (pan !== SIM_CARD_APPROVE) {
        result = fail("Card declined by processor", -11);
        break;
      }
      if (waitingId && st.completedMoves.includes(waitingId)) {
        result = fail("Payment already processed for this reservation", -12);
        break;
      }
      const unit = st.units[loc].find((u) => u.UnitID === s(args.UnitID));
      if (!unit || unit.bRented === "true") {
        result = fail("Unit not available", -3);
        break;
      }
      unit.bRented = "true";
      const id = ++st.nextId;
      const r = st.reservations[loc].find((x) => x.WaitingID === waitingId);
      if (r) r.iStatus = "2";
      if (waitingId) st.completedMoves.push(waitingId);
      st.ledgers[loc].push({
        LedgerID: id,
        TenantID: Number(args.TenantID),
        UnitID: Number(unit.UnitID),
        sUnitName: unit.sUnitName,
        dcRent: Number(unit.dcWebRate),
        dPaidThru: isoDay(30),
        dcChargeBalance: 0,
        dcPastDue: 0,
        iDaysPastDue: 0,
        dSchedOut: "",
        autopay: false,
      });
      result = { Table: [{ LedgerID: String(id), iLeaseNum: String(id), lngReceiptID: String(id + 500000) }], RT: [ok(id)] };
      break;
    }
    case "ScheduleMoveOut": {
      const l = st.ledgers[loc].find((x) => x.LedgerID === Number(args.iLedgerID));
      if (!l) {
        result = fail("Ledger not found");
        break;
      }
      l.dSchedOut = s(args.dScheduledOut);
      result = { RT: [ok()] };
      break;
    }
    case "SiteLinkeSignCreateLeaseURL_v2":
      result =
        loc === "hwy4"
          ? fail("eSign is not configured for this site", -20)
          : { Table: [{ sURL: `/portal/demo-lease?ledger=${s(args.iLedgerID)}` }], RT: [ok()] };
      break;
    case "PastDueBalances":
      result = {
        Table: st.ledgers[loc].filter((l) => l.dcPastDue > 0).map((l) => ({ sUnitName: l.sUnitName, dcPastDue: String(l.dcPastDue) })),
        RT: [ok()],
      };
      break;
    case "MoveInsAndMoveOuts":
      result = { Table: [{ sMoveType: "Move In", dDate: isoDay(0), sUnitName: "demo" }], RT: [ok()] };
      break;
    case "OccupancyStatistics": {
      const all = st.units[loc];
      const pct = (all.filter((u) => u.bRented === "true").length / all.length) * 100;
      result = { Table: [{ dcUnitOccupancyPct: pct.toFixed(1) }], RT: [ok()] };
      break;
    }
    default:
      result = fail(`Mock does not implement ${method}`);
  }

  if (MUTATING.has(method) && !(result.RT?.[0] && Number(result.RT[0].Ret_Code) < 0)) {
    await persist(st);
  }
  return result;
}

function tenantRow(t: MockTenant): Row {
  return { TenantID: String(t.TenantID), sFName: t.sFName, sLName: t.sLName, sEmail: t.sEmail, sPhone: t.sPhone, sAccessCode: t.sAccessCode };
}

function stringify(o: Record<string, unknown>): Row {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, s(v)]));
}

/** Test helper — reset in-process cache (does not clear Postgres). */
export function resetMockMemory() {
  delete g.__kvMock;
}
