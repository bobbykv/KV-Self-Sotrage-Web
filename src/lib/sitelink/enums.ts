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

/** VERIFIED: iSource 5 = Website on reservation methods. */
export const SOURCE_WEBSITE = 5;
export const SOURCE_WEBSITE_LABEL = "Website";

/**
 * VERIFIED (§10.77, §10.79, §10.82): PaymentSimple* iSource.
 * 3 = Call Center, 10 = Website. Staff payments taken on this site use 10.
 */
export const PAYMENT_SOURCE_WEBSITE = 10;

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

/** VERIFIED (§10.62): iPayMethod 1 = check, 2 = cash. */
export const PAY_METHOD_CHECK = 1;
export const PAY_METHOD_CASH = 2;

/** UNVERIFIED: MoveInWithDiscount_v7 ChannelType. */
export const CHANNEL_TYPE_WEBSITE = envInt("SITELINK_CHANNEL_TYPE", 0);

/**
 * VERIFIED (Transaction API §10.62): iBillingFrequency 7 = 28-Day Billing, 3 = calendar monthly.
 * KV bills every 28 days. Override with SITELINK_BILLING_FREQUENCY only if SiteLink says otherwise.
 */
export const BILLING_FREQUENCY_DEFAULT = envInt("SITELINK_BILLING_FREQUENCY", 7);

/**
 * VERIFIED: -999 means "none" for concession, insurance, promotion, and waiting-id
 * parameters on reservation, move-in cost, and MoveInWithDiscount_v7.
 */
export const SITELINK_NONE_ID = -999;

/** VERIFIED (§10.136): iAutoBillType 1 = credit card. */
export const AUTO_BILL_CREDIT_CARD = 1;

/** VERIFIED (§10.136): 0 days after the amount is due. */
export const AUTO_BILL_ON_DAY_PAST_DUE = 0;
