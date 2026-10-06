# Customer-led website copy

## Agreed direction

The customer is the hero. KV guides them towards a suitable space and keeps their belongings nearby while they move through a change in life.

Bobby's central customer need: "I need somewhere for belongings I'm not ready to part with." The desired outcome is relief and peace of mind, knowing their belongings are safe with KV. The main decision difficulty is choosing the right size, followed by price.

Moving and downsizing households lead the homepage. Businesses have their own use case and size-finder option. Students have supporting homepage and FAQ coverage. Vehicle storage remains an availability-led offer rather than the main promise.

The homepage leads with "Make room for what's next. Keep what matters." The plan is: find your space, arrange your rental, move forward with peace of mind. The primary action is "Find your space"; size help is the secondary action.

## Implementation coverage

- Homepage, locations, all four local search landing pages, reviews, contact, size finder, unit listings and detail pages.
- Checkout, both payment paths, confirmation, hold timer, account setup, sign-in, tenant dashboard, lease fallback, and maintenance forms.
- Shared navigation, footer, enquiry success messages, chat greeting and fallback replies, page descriptions, and location schema wording.
- Canonical FAQ and shared assistant guidance. The sample blog draft and empty blog state also follow the new direction. Existing database-authored posts and promotions are not modified.
- Privacy and terms wording is clearer; these remain labelled drafts and retain the existing policy requirements. No legal approval is implied.

## Size guidance corrections

Size-finder suggestions now use inclusive area ranges rather than one broad size category. A studio/one-bedroom recommendation includes both 5x10 and 10x10; a two- to three-bedroom recommendation includes both 10x15 and 10x20.

Climate control directs to Haley Road, the only confirmed climate-controlled location. If a visitor prefers another location, the result explains the change and offers a separate comparison without the climate-control filter. Recommendations are starting estimates, not capacity guarantees or a reason to automatically buy a larger unit.

The listing page retains the suggested range when visitors change location. A deliberately selected size category replaces the range; clearing filters removes it. Sold-out types respect the same size and location filters. Unit-detail location amenities no longer imply that every selected unit has climate control or vehicle parking.

## Operational boundaries

The current inventory is intentionally demo data. A short notice appears only in mock mode. No API credentials, cron scheduling, payment mode, real rental, or physical access settings are changed.

The homepage rental step adapts to the configured payment mode. Reservation-first checkout explicitly explains that payment and rental completion come before access. Paid-rental confirmation still explains lease signing and access setup; it does not promise an automatic Nokē invitation or immediate entry. Nokē unlocking is described as an app action, not a feature of this website. Chat offers a phone call or callback rather than a live takeover.

Before live launch, verify the SiteLink eSign response mapping, billing frequency configuration, actual SiteLink-to-Nokē activation flow, lock requirements, and scheduler. API documentation review does not establish that these are configured or working in KV's account. The separate SiteLink policy restriction on AI-agent integrations still needs to be respected; shared wording changes do not grant or enable that integration.

An admin-saved FAQ overrides agent-brain/faq.md at runtime. If one exists, compare and update it intentionally or use the admin reset-to-file action to adopt this rewrite. Database-authored blog posts and promotions also need their own review before publication.

## Validation

Type checking, linting, and the test suite pass. Regression tests cover advertised size-range boundaries, location preference, climate routing, vehicle searches, sold-out filtering, and invalid ranges. The production build completes; without a local DATABASE_URL it logs the existing database lookup warning during sitemap generation. Live account, payment, and physical-access checks require the actual configured services and are not claimed here.
