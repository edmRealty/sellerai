-- SellerAI Phase 1: multi-tenant persistence, RBAC, audit logging
-- Apply with: supabase db push  (or run in the Supabase SQL editor)

-- ============================================================
-- Roles & profiles
-- ============================================================
create type public.user_role as enum ('seller', 'agent', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  phone text,
  role public.user_role not null default 'seller',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a seller profile for every new auth user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role lookup helper (security definer so RLS policies can use it)
create or replace function public.current_role()
returns public.user_role
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'seller');
$$;

create or replace function public.is_staff()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select public.current_role() in ('agent', 'admin');
$$;

-- ============================================================
-- Listings
-- data holds the client ListingData shape verbatim (reversible
-- migration: the seller app can rehydrate from this column alone).
-- ============================================================
create type public.listing_status as enum (
  'draft', 'agent_review', 'approved', 'published',
  'off_market', 'under_contract', 'sold', 'archived'
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references auth.users(id) on delete set null,
  client_session_id text,                -- seller_ai_session_v2 id, for reconciliation
  address text not null default '',
  step text not null default 'confirm',  -- ChatStep name, unchanged from client
  status public.listing_status not null default 'draft',
  working_price numeric,
  consumer_notice_status text not null default 'not_sent',
  listing_agreement_status text not null default 'not_sent',
  data jsonb not null default '{}'::jsonb,  -- full ListingData
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_seller_idx on public.listings (seller_id);
create index listings_session_idx on public.listings (client_session_id);
create index listings_status_idx on public.listings (status);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger listings_touch before update on public.listings
  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ============================================================
-- Append-only event / audit log
-- ============================================================
create table public.listing_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role public.user_role,
  event_type text not null,   -- e.g. listing_created, step_advanced, cn_requested,
                              -- cn_signed, cn_approved, la_sent, la_signed, la_approved,
                              -- price_changed, status_changed
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index listing_events_listing_idx on public.listing_events (listing_id, created_at);

-- ============================================================
-- Documents (versioned; storage_path points at Supabase Storage)
-- ============================================================
create table public.listing_documents (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  kind text not null,          -- consumer_notice, listing_agreement, lead_paint,
                               -- seller_disclosure, photo, upload
  version int not null default 1,
  status text not null default 'draft',  -- draft, sent, signed, approved
  storage_path text,
  file_name text,
  signed_by uuid references auth.users(id) on delete set null,
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

create index listing_documents_listing_idx on public.listing_documents (listing_id, kind);

-- ============================================================
-- Leads (already used by /api/lead)
-- ============================================================
create table if not exists public.seller_leads (
  id uuid primary key default gen_random_uuid(),
  address text,
  source text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_events enable row level security;
alter table public.listing_documents enable row level security;
alter table public.seller_leads enable row level security;

-- profiles: user reads/updates own; staff reads all
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_staff());
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid());

-- listings: seller owns rows; staff reads/updates all
create policy listings_seller_read on public.listings
  for select using (seller_id = auth.uid() or public.is_staff());
create policy listings_seller_insert on public.listings
  for insert with check (seller_id = auth.uid());
create policy listings_seller_update on public.listings
  for update using (seller_id = auth.uid() or public.is_staff());

-- events: visible to listing participants; insert-only, no update/delete
create policy events_read on public.listing_events
  for select using (
    public.is_staff()
    or exists (select 1 from public.listings l
               where l.id = listing_id and l.seller_id = auth.uid())
  );
create policy events_insert on public.listing_events
  for insert with check (
    public.is_staff()
    or exists (select 1 from public.listings l
               where l.id = listing_id and l.seller_id = auth.uid())
  );

-- documents: same visibility as listings
create policy documents_read on public.listing_documents
  for select using (
    public.is_staff()
    or exists (select 1 from public.listings l
               where l.id = listing_id and l.seller_id = auth.uid())
  );
create policy documents_write on public.listing_documents
  for insert with check (
    public.is_staff()
    or exists (select 1 from public.listings l
               where l.id = listing_id and l.seller_id = auth.uid())
  );

-- leads: anonymous inserts happen through the service role only
create policy leads_staff_read on public.seller_leads
  for select using (public.is_staff());
