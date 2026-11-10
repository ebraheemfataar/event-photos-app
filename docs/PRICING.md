# Snap & Share — Pricing & plans

The plan for charging hosts, adapted to what the app can enforce today. The
original brief is kept verbatim at the bottom; the decisions below take
precedence where they differ. Roadmap position: [ROADMAP.md → Monetisation](ROADMAP.md#monetisation).

## Decisions (agreed)

| # | Question | Decision | Why |
|---|---|---|---|
| 1 | What is a "guest" for the cap? | A **contributor**: each phone (browser guest id) that has added at least one photo. The host never counts. Viewing is unlimited. | Guests are anonymous; there's no join step to count. Contributors are countable on the server at upload time, and cheating (clearing the browser) only *raises* the count, so it can't be used to dodge paying. When guest passes land (roadmap Phase 6) a pass replaces the browser id with no rule change. |
| 2 | Host email | **Not** asked at creation (the landing design is name / date / note). **Required at checkout** for paid plans (receipt + reminders), optional for free events. | Keeps free events friction-free; paid hosts give an email anyway. |
| 3 | Which features to sell | **Only what exists.** Launch plans differ by contributor cap, retention and badge. Each other feature joins its plan when built. | Don't charge for features that aren't there. |
| 4 | Payment provider | **PayFast first** (account exists; supports card + Instant EFT), behind a provider interface; Yoco can be added later. | No new SDK needed: PayFast's form + ITN work with `fetch` and Node `crypto`. |
| 5 | VAT | **Not VAT-registered**: prices are final, no VAT line on receipts or the pricing page. Revisit on registration (check the SARS compulsory threshold with an accountant). | Showing VAT while unregistered isn't allowed. |

Further decisions made while planning:

- **One purchase path.** Every event is created on Free. Picking a paid plan at creation creates the event, then goes straight to checkout for that plan. Upgrading later is the same flow, charging only the difference. Plans are only ever *raised* by a verified payment.
- **Existing live events** (created before pricing) become Free with `expires_at` = launch + 90 days and **no contributor cap**. They can't be emailed, so their host pages show a "Keep this album" banner.
- **Badge** = a small "Made with Snap & Share" line in the album footer and on the printed QR table card (the card already ends in "No app · No login · Just scan").
- **"Forever"** retention on Unlimited stays, but storage per event is still capped by the photo-size limits; revisit if storage cost becomes real.

## Plans at launch (per event, once-off, ZAR, stored as integer cents)

| Plan | Price | Contributors | Album kept | At launch | Added when built |
|---|---|---|---|---|---|
| `free` | R0 | 20 | 30 days | badge shown | — |
| `small` | R149 | 100 | 90 days | badge shown | full-res downloads |
| `medium` | R399 | 300 | 1 year | **no badge** | video uploads, co-hosts |
| `unlimited` | R799 | no limit | forever | no badge | ZIP export, live slideshow |

**Add-ons at launch:** `keep_1yr` (+1 year retention, R49), `guests_50` (+50 contributor slots, R79, stackable).
**Later:** `highlight_video` (R99, needs the feature), `qr_cards_20` (R199, physical fulfilment: print partner, shipping address, pending/printed/shipped).
**Later (need host accounts):** 3-event pack (20% off), returning-host 10% coupon, `pro` subscription (R499/month or R4,990/year, unlimited events at Medium level, own logo).

## Stages

### Stage A — Foundations (no payments yet)
- **Phase 2c:** uploads go through the server (a Server Function issues a one-time signed upload URL and inserts the row). This is the single place to enforce the contributor cap, rate limits and (later) the video block. Also issues the browser **guest id** (`photos.guest_id`), used for the cap and for "delete my own photo".
- `events.plan` (default `free`), `events.expires_at`, `events.extra_contributors`, `events.host_email` (nullable).
- `plans` and `add_ons` tables, seeded from the tables above. **Limits live only there** — components read them through `lib/data.ts`, nothing hardcoded.
- **Expiry job:** Vercel Cron (daily) calls a protected route that deletes events past `expires_at` (rows + storage files) and sends reminders 7 days and 1 day before, for events with an email. Replaces the retention item in roadmap Phase 4. *Needs an email provider — new dependency, ask first.*
- Host page shows plan, contributors used / cap, and the deletion date.

### Stage B — Paid plans v1
- **Contributor cap enforced on the server** (2c upload step): a new contributor beyond the cap gets "This album is full — ask the host to upgrade"; existing contributors keep uploading.
- **Plan picker at creation** (Free selected) and a **pricing page**, built from the landing page's card and button styles (the design file has no pricing board).
- **Upgrade prompt** when the host nears or hits a limit; price = new plan − plans already paid for that event (integer cents, never negative).
- **`event_purchases`** (event_id, plan, add_ons, amount_cents, status `pending → paid | failed | cancelled`, provider, provider_ref, email, created/paid timestamps).
- **Payments:** `lib/payments/` provider interface (`createCheckout`, `verifyNotification`); PayFast implementation:
  - redirect checkout with a signed form (merchant id/key, amount, `m_payment_id` = purchase id, `notify_url`, passphrase signature);
  - ITN handler route: verify the signature, check the request comes from PayFast, confirm with PayFast's validate endpoint, check the amount and merchant match, and only then mark the purchase `paid` and raise the plan. **Never** from the browser's return redirect. Idempotent on repeat ITNs. No card data ever touches the app.
  - Secrets (`PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, sandbox flag) as server-only env vars.
- Badge hidden on Medium and above; retention set from the plan + add-ons.
- **Tests:** contributor cap enforcement (server, not just UI); upgrade price difference; ITN signature/amount verification and idempotency (forged / replayed / wrong-amount notifications rejected); plan only changes after a verified ITN. Use the PayFast sandbox for an end-to-end run.

### Stage C — Needs host accounts (roadmap Phase 7)
3-event pack credits, returning-host coupon (`coupons` table), `pro` subscription (`subscriptions` table; PayFast subscriptions or Yoco), co-hosts, own logo instead of the badge.

### Stage D — Feature add-ons, as each feature is built
Video uploads (Medium+; blocked on Free/Small in the 2c upload step), full-res downloads, ZIP export, live slideshow, highlight video, printed QR card packs.

## Open items
- Refund policy and terms of sale (needed before Stage B goes live).
- Email provider choice for receipts/reminders (Stage A).
- PayFast sandbox credentials for development; production credentials added to Vercel as Sensitive.

---

## Appendix — original brief (verbatim)

> Add pricing and plan limits to Snap & Share. Read the codebase first, then propose a plan before writing code.
>
> PRICING MODEL
> - Hosts pay ONCE per event (not monthly). Guests never pay and never need an account.
> - Price depends on guest count, not on the type of event.
> - Each event is bought separately. One host can own many events, each with its own plan.
>
> PLANS (per event, once-off, ZAR)
>
> | Plan      | Price | Max guests | Album kept | Features |
> |-----------|-------|------------|------------|----------|
> | free      | R0    | 20         | 30 days    | Snap & Share badge shown |
> | small     | R149  | 100        | 90 days    | full-res downloads |
> | medium    | R399  | 300        | 1 year     | + video uploads, co-hosts, no badge |
> | unlimited | R799  | no limit   | forever    | + ZIP export, live slideshow |
>
> ADD-ONS (once-off, per event)
> - keep_1yr: +1 year retention, R49
> - guests_50: +50 guest slots, R79 (stackable)
> - highlight_video: R99
> - qr_cards_20: printed QR card pack (20 cards), R199, physical order (store shipping address, status: pending/printed/shipped)
>
> DISCOUNTS
> - 3-event pack: buy 3 event credits at 20% off the sum of their plan prices
> - Returning host: 10% off their next paid event (one-time coupon issued after the first paid event ends)
>
> RECURRING (planners, venues, HR teams)
> - pro: R499/month or R4,990/year, unlimited events at "medium" level, own logo instead of our badge
>
> IMPLEMENTATION
> 1. Supabase: add tables `plans` (seed the data above), `event_purchases` (event_id, plan, add_ons, amount_cents, status, provider_ref), `subscriptions` and `coupons`. Add `plan` and `expires_at` columns to events. Put plan limits in config/seed data, not hardcoded in components.
> 2. Enforce limits on the server (RLS policies and API checks), not just in the UI:
>    - block guest joins over max_guests: show "This album is full, ask the host to upgrade"
>    - block video uploads on free and small
>    - a scheduled job deletes albums past expires_at, with email reminders 7 days and 1 day before
> 3. Upgrade flow: when a host hits a limit, show an upgrade prompt that charges only the difference between their current plan and the new one.
> 4. Payments: build a provider interface first, then implement Yoco checkout (PayFast as fallback). Mark a purchase paid ONLY from a verified webhook, never from the client redirect. Never store card details.
> 5. Pricing page and plan picker at event creation, matching the V3 design in docs/design/snap-share-v3-spec.html.
> 6. Tests for limit enforcement, upgrade price difference, coupon use and webhook verification.
>
> Store all amounts as integer cents. Ask me before adding any new dependency.
