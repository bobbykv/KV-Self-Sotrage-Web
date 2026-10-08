import "server-only";
import { getLocation, type LocationKey } from "@/config/locations";
import type { TenantLink } from "./auth";
import { log, safeErrorMessage } from "./log";
import { sitelink } from "./sitelink/client";
import type { Balance, BillingInfo, Ledger, Tenant } from "./sitelink/types";

/** Show Nokē copy at sites that have the amenity. Simulator still does not activate locks. */
function showNoke(locationKey: LocationKey) {
  return getLocation(locationKey).amenities.nokeRemoteUnlock;
}

export type PortalAccount = {
  locationKey: LocationKey;
  locationName: string;
  noke: boolean;
  tenant: Tenant | null;
  ledgers: (Ledger & { pastDue: number; daysPastDue: number })[];
  billing: BillingInfo | null;
  error: string | null;
};

/** Live SiteLink reads for a signed-in tenant (portal traffic is low; no caching of personal data). */
export async function loadPortalAccounts(links: TenantLink[]): Promise<PortalAccount[]> {
  return Promise.all(
    links.map(async ({ locationKey, tenantId }) => {
      const loc = getLocation(locationKey);
      try {
        const [info, ledgers, balances, billing] = await Promise.all([
          sitelink.tenantInfo(locationKey, tenantId),
          sitelink.ledgers(locationKey, tenantId),
          sitelink.balances(locationKey, tenantId).catch(() => [] as Balance[]),
          sitelink.billingInfo(locationKey, tenantId).catch(() => null),
        ]);
        return {
          locationKey,
          locationName: loc.name,
          noke: showNoke(locationKey),
          tenant: info?.tenant ?? null,
          ledgers: ledgers.ledgers.map((l) => {
            const b = balances.find((x) => x.ledgerId === l.ledgerId) ?? balances.find((x) => x.unitName === l.unitName);
            return { ...l, balance: b?.currentBalance ?? l.balance, pastDue: b?.pastDue ?? 0, daysPastDue: b?.daysPastDue ?? 0, accessCode: l.accessCode || info?.tenant.accessCode || "" };
          }),
          billing,
          error: null,
        };
      } catch (err) {
        log.warn("portal load failed", { locationKey, err });
        return { locationKey, locationName: loc.name, noke: showNoke(locationKey), tenant: null, ledgers: [], billing: null, error: safeErrorMessage(err, 120) };
      }
    }),
  );
}

export async function tenantOwnsLedger(link: TenantLink, ledgerId: number): Promise<Ledger | null> {
  const { ledgers } = await sitelink.ledgers(link.locationKey, link.tenantId);
  return ledgers.find((l) => l.ledgerId === ledgerId) ?? null;
}
