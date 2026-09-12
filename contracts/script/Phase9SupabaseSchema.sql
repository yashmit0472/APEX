create extension if not exists "pgcrypto";

-- ============================================
-- AGENTS
-- ============================================

create table if not exists public.agents (
    id uuid primary key default gen_random_uuid(),
    wallet_address text not null unique,
    display_name text,
    authorization_status text not null default 'unknown',
    provider_address text,
    service_id text,
    max_spend numeric(78, 0),
    per_tx_cap numeric(78, 0),
    daily_cap numeric(78, 0),
    total_spent numeric(78, 0) default 0,
    daily_spent numeric(78, 0) default 0,
    authorization_expires_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ============================================
-- PROVIDERS
-- ============================================

create table if not exists public.providers (
    id uuid primary key default gen_random_uuid(),
    wallet_address text not null unique,
    service_type text not null,
    endpoint text,
    active boolean not null default true,
    registered_at timestamptz,
    stake_amount numeric(78, 0) default 0,
    locked_stake numeric(78, 0) default 0,
    eligible boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ============================================
-- PAYMENT INTENTS
-- ============================================

create table if not exists public.payment_intents (
    id uuid primary key default gen_random_uuid(),
    request_id text not null unique,
    agent_address text not null,
    provider_address text not null,
    amount numeric(78, 0) not null,
    service_id text not null,
    deadline timestamptz not null,
    nonce numeric(78, 0) not null,
    stake_required numeric(78, 0) not null default 0,
    risk_score integer,
    firewall_decision text,
    status text not null default 'created',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ============================================
-- PAYMENT TRANSACTIONS
-- ============================================

create table if not exists public.payment_transactions (
    id uuid primary key default gen_random_uuid(),
    request_id text not null,
    agent_address text not null,
    provider_address text not null,
    amount numeric(78, 0) not null,
    job_id numeric(78, 0),
    transaction_hash text,
    block_number numeric(78, 0),
    status text not null default 'pending',
    created_at timestamptz not null default now(),
    confirmed_at timestamptz
);

-- ============================================
-- ESCROW JOBS
-- ============================================

create table if not exists public.escrow_jobs (
    id uuid primary key default gen_random_uuid(),
    job_id numeric(78, 0) not null unique,
    request_id text not null unique,
    agent_address text not null,
    provider_address text not null,
    amount numeric(78, 0) not null,
    stake_required numeric(78, 0) not null default 0,
    deadline timestamptz not null,
    service_id text not null,
    status text not null default 'funded',
    delivery_hash text,
    funded_at timestamptz,
    delivered_at timestamptz,
    settled_at timestamptz,
    refunded_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ============================================
-- FIREWALL EVENTS
-- ============================================

create table if not exists public.firewall_events (
    id uuid primary key default gen_random_uuid(),
    request_id text not null,
    agent_address text not null,
    provider_address text not null,
    amount numeric(78, 0) not null,
    risk_score integer not null,
    decision text not null,
    status text not null default 'evaluated',
    created_at timestamptz not null default now()
);

-- ============================================
-- ACTIVITY EVENTS
-- ============================================

create table if not exists public.activity_events (
    id uuid primary key default gen_random_uuid(),
    event_type text not null,
    actor_address text,
    request_id text,
    job_id numeric(78, 0),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

-- ============================================
-- INDEXES
-- ============================================

create index if not exists idx_agents_wallet
    on public.agents(wallet_address);

create index if not exists idx_providers_wallet
    on public.providers(wallet_address);

create index if not exists idx_payment_intents_agent
    on public.payment_intents(agent_address);

create index if not exists idx_payment_intents_provider
    on public.payment_intents(provider_address);

create index if not exists idx_payment_intents_status
    on public.payment_intents(status);

create index if not exists idx_payment_transactions_request
    on public.payment_transactions(request_id);

create index if not exists idx_escrow_jobs_agent
    on public.escrow_jobs(agent_address);

create index if not exists idx_escrow_jobs_provider
    on public.escrow_jobs(provider_address);

create index if not exists idx_escrow_jobs_status
    on public.escrow_jobs(status);

create index if not exists idx_firewall_events_request
    on public.firewall_events(request_id);

create index if not exists idx_activity_events_actor
    on public.activity_events(actor_address);

create index if not exists idx_activity_events_request
    on public.activity_events(request_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table public.agents enable row level security;
alter table public.providers enable row level security;
alter table public.payment_intents enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.escrow_jobs enable row level security;
alter table public.firewall_events enable row level security;
alter table public.activity_events enable row level security;
