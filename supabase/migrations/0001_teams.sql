-- NLH Dealer Trainer — accounts, stores (organizations) and synced results.
-- Run once in the Supabase SQL editor (or with `supabase db push`).
--
-- Roles inside a store: owner (manages the store), trainer (sees staff results, sets work),
-- dealer (trains). Every table has Row Level Security: users only ever see their own data,
-- plus the results of the staff of stores where they are owner/trainer.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

-- Create a profile row for every new user.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- organizations (stores / schools)
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  -- House rules applied to staff training (blinds, ante, rake, jackpot …), same shape as the app settings.
  house_rules jsonb not null default '{}'::jsonb,
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'trainer', 'dealer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists memberships_user_idx on public.memberships (user_id);

-- The creator of a store becomes its owner.
create or replace function public.handle_new_org() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.memberships (org_id, user_id, role) values (new.id, new.created_by, 'owner');
  return new;
end $$;
drop trigger if exists on_org_created on public.organizations;
create trigger on_org_created after insert on public.organizations
  for each row execute function public.handle_new_org();

-- Helpers (security definer so policies can use them without recursion).
create or replace function public.is_org_member(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m where m.org_id = org and m.user_id = auth.uid());
$$;
create or replace function public.is_org_manager(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m where m.org_id = org and m.user_id = auth.uid() and m.role in ('owner', 'trainer'));
$$;
create or replace function public.manages_user(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships mine
    join public.memberships theirs on theirs.org_id = mine.org_id
    where mine.user_id = auth.uid() and mine.role in ('owner', 'trainer') and theirs.user_id = target
  );
$$;

-- Join a store with its invite code (as a dealer).
create or replace function public.join_org(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare org uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select id into org from public.organizations where invite_code = code;
  if org is null then raise exception 'invalid invite code'; end if;
  insert into public.memberships (org_id, user_id, role) values (org, auth.uid(), 'dealer')
  on conflict (org_id, user_id) do nothing;
  return org;
end $$;

-- ---------------------------------------------------------------- synced answer records
-- Mirrors AnswerRecord in src/stats/types.ts. `id` is generated on the device, so syncing is idempotent.
create table if not exists public.answer_records (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  at timestamptz not null,
  mode text not null check (mode in ('hand', 'winner', 'pot', 'sidepot')),
  level smallint not null check (level between 1 and 5),
  correct boolean not null,
  time_ms integer not null check (time_ms >= 0),
  speed text not null check (speed in ('fast', 'normal', 'slow')),
  score integer not null default 0,
  skills text[] not null default '{}',
  parts jsonb,
  session_id text,
  created_at timestamptz not null default now()
);
create index if not exists answer_records_user_at_idx on public.answer_records (user_id, at desc);

-- ---------------------------------------------------------------- row level security
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.answer_records enable row level security;

drop policy if exists "profiles: own or managed" on public.profiles;
create policy "profiles: own or managed" on public.profiles for select
  using (id = auth.uid() or public.manages_user(id));
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "orgs: members read" on public.organizations;
create policy "orgs: members read" on public.organizations for select
  using (public.is_org_member(id));
drop policy if exists "orgs: signed-in create" on public.organizations;
create policy "orgs: signed-in create" on public.organizations for insert
  with check (auth.uid() is not null and created_by = auth.uid());
drop policy if exists "orgs: managers update" on public.organizations;
create policy "orgs: managers update" on public.organizations for update
  using (public.is_org_manager(id)) with check (public.is_org_manager(id));

drop policy if exists "memberships: own or managed org" on public.memberships;
create policy "memberships: own or managed org" on public.memberships for select
  using (user_id = auth.uid() or public.is_org_manager(org_id));
drop policy if exists "memberships: managers change roles" on public.memberships;
create policy "memberships: managers change roles" on public.memberships for update
  using (public.is_org_manager(org_id)) with check (public.is_org_manager(org_id));
drop policy if exists "memberships: managers remove, users leave" on public.memberships;
create policy "memberships: managers remove, users leave" on public.memberships for delete
  using (user_id = auth.uid() or public.is_org_manager(org_id));

drop policy if exists "records: insert own" on public.answer_records;
create policy "records: insert own" on public.answer_records for insert
  with check (user_id = auth.uid());
drop policy if exists "records: read own or managed" on public.answer_records;
create policy "records: read own or managed" on public.answer_records for select
  using (user_id = auth.uid() or public.manages_user(user_id));
drop policy if exists "records: delete own" on public.answer_records;
create policy "records: delete own" on public.answer_records for delete
  using (user_id = auth.uid());
