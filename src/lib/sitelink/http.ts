/**
 * Shared SiteLink HTTP details. Storable's firewall in front of
 * api.smdservers.net returns HTTP 403 unless the request carries a
 * standard User-Agent. Call Center and Reporting SOAP calls, and the
 * WSDL contract script, all send this value.
 */
export const SITELINK_USER_AGENT = "Mozilla/5.0 (compatible; KVSelfStorage/1.0)";

/**
 * SiteLink corporate username. A license key may already be embedded as
 * `user:::key` on SITELINK_API_USERNAME. Otherwise, when
 * SITELINK_API_LICENSE_KEY is set, append it the same way.
 */
export function siteLinkCorpUserName(username: string, licenseKey?: string | null): string {
  if (username.includes(":::")) return username;
  const key = licenseKey?.trim();
  if (!key) return username;
  return `${username}:::${key}`;
}
