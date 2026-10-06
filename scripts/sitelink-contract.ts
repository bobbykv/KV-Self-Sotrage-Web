/**
 * Pulls method signatures for every SiteLink method we call from the LIVE
 * WSDLs and writes src/lib/sitelink/contract.generated.json.
 *
 *   npm run sitelink:contract   # regenerate (commit the diff after review)
 *   npm run sitelink:check      # fail if live WSDL drifted from the committed contract
 *
 * The SOAP client builds envelopes from this contract (parameter order + types),
 * so a wrapper can't silently send a parameter SiteLink doesn't know about.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { XMLParser } from "fast-xml-parser";

const SERVICES = {
  callcenter: {
    wsdl: "https://api.smdservers.net/CCWs_3.5/CallCenterWs.asmx?WSDL",
    methods: [
      "SiteInformation",
      "UnitsInformationAvailableUnitsOnly_v2",
      "UnitsInformation_v3",
      "UnitsInformationByUnitID",
      "UnitTypePriceList_v2",
      "DiscountPlansRetrieve",
      "PaymentTypesRetrieve",
      "KeypadZonesRetrieve",
      "TenantSearchDetailed",
      "TenantNewDetailed_v3",
      "TenantLogin",
      "TenantInfoByTenantID",
      "TenantLoginAndSecurityUpdate",
      "TenantIDByUnitNameOrAccessCode",
      "TenantBillingInfoByTenantID_v3",
      "LedgersByTenantID_v3",
      "CustomerAccountsBalanceDetails_v2",
      "ReservationNewWithSource_v5",
      "ReservationUpdate_v4",
      "ReservationList_v3",
      "ReservationNoteInsert",
      "MoveInCostRetrieveWithDiscount_Reservation_v4",
      "MoveInWithDiscount_v7",
      "ScheduleMoveOut",
      "SiteLinkeSignCreateLeaseURL_v2",
    ],
  },
  reporting: {
    wsdl: "https://api.smdservers.net/CCWs_3.5/ReportingWs.asmx?WSDL",
    methods: ["PastDueBalances", "MoveInsAndMoveOuts", "OccupancyStatistics"],
  },
} as const;

type Param = { name: string; type: string };
type Contract = Record<string, { service: string; namespace: string; params: Param[] }>;

const OUT = join(process.cwd(), "src/lib/sitelink/contract.generated.json");

async function load(): Promise<Contract> {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", removeNSPrefix: true, isArray: (n) => ["element", "complexType"].includes(n) });
  const contract: Contract = {};
  for (const [service, cfg] of Object.entries(SERVICES)) {
    const res = await fetch(cfg.wsdl);
    if (!res.ok) throw new Error(`${cfg.wsdl} -> HTTP ${res.status}`);
    const doc = parser.parse(await res.text());
    const defs = doc.definitions;
    const namespace: string = defs.targetNamespace;
    const schema = Array.isArray(defs.types.schema) ? defs.types.schema[0] : defs.types.schema;
    const elements: Record<string, unknown>[] = schema.element;
    for (const method of cfg.methods) {
      const el = elements.find((e) => e.name === method) as
        | { complexType?: { sequence?: { element?: { name: string; type: string }[] } }[] }
        | undefined;
      if (!el) throw new Error(`Method ${method} not found in ${service} WSDL`);
      const seq = el.complexType?.[0]?.sequence?.element ?? [];
      contract[method] = {
        service,
        namespace,
        params: seq.map((p) => ({ name: p.name, type: String(p.type).replace(/^.*:/, "") })),
      };
    }
  }
  return contract;
}

async function main() {
  const live = await load();
  if (process.argv.includes("--check")) {
    const committed = JSON.parse(readFileSync(OUT, "utf8")) as Contract;
    const drift: string[] = [];
    for (const [m, sig] of Object.entries(committed)) {
      if (JSON.stringify(sig) !== JSON.stringify(live[m])) drift.push(m);
    }
    if (drift.length) {
      console.error(`SiteLink WSDL drift detected in: ${drift.join(", ")}. Run npm run sitelink:contract and review.`);
      process.exit(1);
    }
    console.log(`SiteLink contract matches live WSDL (${Object.keys(committed).length} methods).`);
    return;
  }
  writeFileSync(OUT, JSON.stringify(live, null, 2) + "\n");
  console.log(`Wrote ${Object.keys(live).length} method signatures to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
