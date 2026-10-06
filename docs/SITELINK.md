# SiteLink integration notes

## Contract

`src/lib/sitelink/contract.generated.json` is generated from the live WSDLs:

```bash
npm run sitelink:contract   # regenerate from the live WSDL
npm run sitelink:check      # fail if the live WSDL no longer matches
```

The envelope builder orders parameters exactly as the WSDL does, injects the
corp/location credentials itself, and throws on any parameter that isn't in the
contract — so a typo or a removed field fails loudly instead of silently
sending the wrong request.

* Call Center: `https://api.smdservers.net/CCWs_3.5/CallCenterWs.asmx`,
  namespace `http://tempuri.org/CallCenterWs/CallCenterWs`
* Reporting: `https://api.smdservers.net/CCWs_3.5/ReportingWs.asmx`,
  namespace `http://tempuri.org/CallCenterWs/ReportingWs`

Responses are .NET DataSets (inline schema + diffgram). `dataset.ts` flattens
them into `{ table: Row[] }`; `RT.Ret_Code < 0` is treated as an error.

## Methods used

| Area | Methods |
| --- | --- |
| Inventory | `UnitsInformationAvailableUnitsOnly_v2`, `UnitsInformation_v3`, `UnitsInformationByUnitID`, `UnitTypePriceList_v2` |
| Holds | `TenantSearchDetailed`, `TenantNewDetailed_v3`, `ReservationNewWithSource_v5`, `ReservationUpdate_v4`, `ReservationNoteInsert`, `ReservationList_v3`, `MoveInCostRetrieveWithDiscount_Reservation_v4` |
| Payment (passthrough only) | `PaymentTypesRetrieve`, `MoveInWithDiscount_v7` |
| Portal | `TenantLogin`, `TenantLoginAndSecurityUpdate`, `TenantInfoByTenantID`, `LedgersByTenantID_v3`, `CustomerAccountsBalanceDetails_v2`, `TenantBillingInfoByTenantID_v3`, `TenantIDByUnitNameOrAccessCode`, `ScheduleMoveOut`, `SiteLinkeSignCreateLeaseURL_v2` |
| Reporting (nightly / on demand) | `PastDueBalances`, `MoveInsAndMoveOuts`, `OccupancyStatistics` |

Not used: any SiteLink AI feature, Panel writes, automatic unit transfers,
refunds.

## Verified vs. unverified

**Verified** (Transaction API v2.19 doc + live WSDL): method signatures,
`QTRentalTypeID = 2` (reservation), `iSource = 5` (website).

**Unverified — confirm with SiteLink support before go-live.** Each has an env
override (see `.env.example`):

| Item | Current assumption | Env override |
| --- | --- | --- |
| `iInquiryType` on `ReservationNewWithSource_v5` | `0` | `SITELINK_INQUIRY_TYPE` |
| Reservation “open” status for `ReservationUpdate_v4` | `0` | `SITELINK_RESERVATION_STATUS_OPEN` |
| Reservation “cancelled” status | *unset* — we let `dExpires` lapse rather than guess | `SITELINK_RESERVATION_STATUS_CANCELLED` |
| `iPayMethod` for credit card on `MoveInWithDiscount_v7` | `0` | `SITELINK_PAY_METHOD_CC` |
| `ChannelType` for website | `0` | `SITELINK_CHANNEL_TYPE` |
| `iBillingFrequency` default | `0` | `SITELINK_BILLING_FREQUENCY` |
| Timezone of `dExpires` / `dNeeded` | facility wall-clock, Atlantic, no offset | `SITELINK_TIMEZONE` |
| Column names in DataSet rows | mapped from several likely names per field (`mappers.ts`) | — |
| `lngLastTimePolled` return value | .NET ticks of the poll time | — |

## Questions for SiteLink support

1. Does a website reservation (`QTRentalTypeID = 2`) block the unit from
   other channels, or only list it on the waiting list? (We also block it
   locally with our own hold table either way.)
2. Values for the unverified enums above.
3. Is `dExpires` interpreted in facility time or UTC?
4. **Does SiteLink offer a hosted or tokenised card-entry method** for
   move-ins, so the website never handles raw card data? If yes, it should
   replace `PAYMENT_MODE=passthrough`. (We have not assumed one exists.)
5. Is eSign (`SiteLinkeSignCreateLeaseURL_v2`) enabled at all three sites?
6. Does `MoveInCostRetrieveWithDiscount_Reservation_v4` return HST in its tax
   columns for Nova Scotia sites?
7. Confirm the API-call allowance (we budget 10,000 calls/location/month).

## Testing with the mock

With no SiteLink credentials the app uses `src/lib/sitelink/mock.ts`:

* Portal login: `demo@kvselfstorage.ca` / `demo1234`
* Pass-through payments: `4242 4242 4242 4242` approves, any other valid card
  declines.
* Highway 4 eSign returns an error so the lease fallback can be tested.

Mock mode refuses to run in production unless `ALLOW_MOCK_IN_PRODUCTION=1` or
`APP_TEST_MODE=1` (hosted simulator — see [TEST_ENVIRONMENT.md](TEST_ENVIRONMENT.md)).

For the Vercel test site, set `APP_TEST_MODE=1` with a dedicated test database.
Portal login: `demo@kvselfstorage.ca` / `demo1234`. Simulator cards:
`4242…4242` approve, `4000…0002` decline, `4000…0119` timeout.
