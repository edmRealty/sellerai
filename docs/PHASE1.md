# Phase 1: Multi-tenant persistence, auth, RBAC, audit logging

Date: 2026-07-14. Scope per the SellerAI build brief, Phase 1. Everything
degrades gracefully: with no Supabase environment configured, the app
behaves exactly like the previous localStorage-only prototype.

## What was added

### Database (`supabase/migrations/20260714000000_phase1.sql`)
- `profiles` — one row per auth user, `role` enum (`seller` default,
  `agent`, `admin`), auto-created by trigger on signup.
- `listings` — uuid listing ID, `seller_id`, promoted columns (address,
  step, status, working_price, consumer_notice_status,
  listing_agreement_status) and `data` jsonb holding the client
  `ListingData` shape verbatim (reversible migration).
- `listing_events` — append-only audit log: actor, role, event type,
  payload, timestamp. Events: listing_created, step_advanced,
  price_changed, cn/la_status_changed, cn/la_approved.
- `listing_documents` — versioned document records (Phase 3 will attach
  Supabase Storage paths).
- `seller_leads` — formalizes the table `/api/lead` already inserts into.
- RLS on everything: sellers see only their rows; agents/admins see all
  via `security definer` role helpers; events are insert-only.

Apply with `supabase db push` or paste into the Supabase SQL editor.
Promote an agent: `update profiles set role = 'agent' where email = '...';`

### Auth (seller magic-code, agent portal gate)
- Seller: the existing **activation** step now sends a Supabase email OTP
  (6-digit code) when configured — same UX, but verifying the code creates
  a real cookie session (`lib/listing-sync.ts`, `lib/supabase/browser.ts`).
  Falls back to the legacy `/api/send-email` activation code otherwise.
- Agent: `/agent/login` (email OTP). `middleware.ts` refreshes sessions
  and blocks `/agent` for non-agent/admin roles when Supabase is live.

### Server persistence & API
- `POST /api/listings/sync` — debounced upsert of the seller's listing
  (RLS-owned), writes audit events on step/price/status transitions.
- `GET /api/listings/current` — seller's live listing; used by wait-step
  polling so agent approvals arrive across devices without refresh.
- `GET /api/listings/events` — audit timeline for a listing.
- `GET /api/agent/listings` — staff-only listing inventory.
- `POST /api/agent/listings/[id]/approve` — staff-only approval
  transaction (`approve-cn` / `approve-listing`): updates the listing and
  records the approving agent in `listing_events`.
- Shared helpers: `lib/supabase/{config,server,browser}.ts`, `lib/auth.ts`,
  `lib/listing-events.ts`.

### Client wiring (surgical, UX unchanged)
- `app/page.tsx`: persist effect additionally calls `scheduleListingSync`
  (no-op pre-auth); `consumer-wait`/`listing-wait` also poll the server and
  merge released statuses into localStorage, which the existing 2s local
  polls already consume. Activation handlers try Supabase OTP first.
- `app/agent/page.tsx`: fetches server listings when available ("Server
  mode" badge); approvals become server transactions; local prototype mode
  is preserved as fallback.

## Environment
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
In Supabase Auth settings, enable Email OTP ("Email" provider, OTP length
6) for seller activation and agent login.

## Deliberate scope cuts (later phases)
- Pre-authentication steps (intro → final-price) stay browser-local; server
  truth starts at email verification, which is where compliance-critical
  waits and signatures begin. Lead capture already records address interest.
- Documents/photos still store names only — Phase 3 moves them to Storage
  with versioning.
- Consumer Notice / Listing Agreement email flows unchanged; Phase 3 ties
  their signed PDFs to `listing_documents` + events.
- `/api/auth/users`, `data/users.json`, and the admin delete/nuke routes are
  legacy; replace/remove when the agent portal fully cuts over. Remove the
  plaintext mock credentials in `data/users.json` before production.
- Realtime subscriptions can replace polling in Phase 2+ without API changes.
