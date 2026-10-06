/**
 * SiteLink integer enums. The WSDL types these as plain `int`, so values can
 * only come from the Transaction API PDF or SiteLink support.
 *
 * VERIFIED = confirmed in the v2.19 Transaction API doc.
 * UNVERIFIED = our best reading; overridable by env, and listed in
 * docs/SITELINK.md as a go-live question for SiteLink support.
 */
const envInt = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && process.env[name] !== undefined && process.env[name] !== "" ? v : fallback;
};

/** VERIFIED: QTRentalTypeID 2 = Order (Reservation). */
export const QT_RENTAL_TYPE_RESERVATION = 2;

/** VERIFIED: iSource 5 = Website. */
export const SOURCE_WEBSITE = 5;
export const SOURCE_WEBSITE_LABEL = "Website";

/** UNVERIFIED: ReservationNewWithSource_v5 iInquiryType. */
export const INQUIRY_TYPE = envInt("SITELINK_INQUIRY_TYPE", 0);

/** UNVERIFIED: ReservationUpdate_v4 iStatus for an open reservation. */
export const RESERVATION_STATUS_OPEN = envInt("SITELINK_RESERVATION_STATUS_OPEN", 0);

/**
 * UNVERIFIED: iStatus to release an expired website hold. Unset by default:
 * until SiteLink confirms the value we let dExpires lapse instead of guessing.
 */
export const RESERVATION_STATUS_CANCELLED: number | null =
  process.env.SITELINK_RESERVATION_STATUS_CANCELLED ? Number(process.env.SITELINK_RESERVATION_STATUS_CANCELLED) : null;
export const RESERVATION_CANCEL_TYPE = envInt("SITELINK_RESERVATION_CANCEL_TYPE", 0);

/** UNVERIFIED: MoveInWithDiscount_v7 iPayMethod (0 = credit card). */
export const PAY_METHOD_CREDIT_CARD = envInt("SITELINK_PAY_METHOD_CC", 0);

/** UNVERIFIED: MoveInWithDiscount_v7 ChannelType. */
export const CHANNEL_TYPE_WEBSITE = envInt("SITELINK_CHANNEL_TYPE", 0);

/** UNVERIFIED: iBillingFrequency (0 = site default / monthly). */
export const BILLING_FREQUENCY_DEFAULT = envInt("SITELINK_BILLING_FREQUENCY", 0);
