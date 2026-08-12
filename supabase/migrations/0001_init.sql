-- ADR-001 §6.2 and §6.3: schema and Row Level Security.
--
-- Every table is scoped to a user and readable only by that user. The publishable
-- key shipped in the client bundle carries no authority of its own; these policies
-- are what actually protect the data.
--
-- Mutations are an append-only event log (task_events) rather than in-place edits,
-- so two devices reconcile without a merge algorithm — see ADR-001 §4.

create extension if not exists pgcrypto;

-- --- enums ------------------------------------------------------------------------

do $$ begin
  create type task_rule as enum ('clock', 'place', 'none');
exception when duplicate_object then null; end $$;

do $$ begin
  create type setter as enum ('client', 'call', 'reviewer', 'agency', 'portal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_kind as enum (
    'completed', 'uncompleted', 'removed', 'restored',
    'moved', 'receipt_confirmed',
    'series_skipped', 'series_ended', 'series_resumed',
    'block_surrendered'
  );
exception when duplicate_object then null; end $$;

-- --- tables -----------------------------------------------------------------------

create table if not exists profiles (
  id               uuid primary key references auth.users on delete cascade,
  user_name        text not null default 'Boniface',
  home_tz          text not null default 'Africa/Nairobi',
  context_aware    boolean not null default true,
  clock_style      text not null default 'countdown'
                     check (clock_style in ('countdown', 'absolute')),
  project_defense  text not null default 'both'
                     check (project_defense in ('quota', 'neglect', 'both')),
  updated_at       timestamptz not null default now()
);

create table if not exists places (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  name            text not null,
  kind            text not null
                    check (kind in ('Where you work', 'Errands', 'Standing places', 'Yours')),
  travel_minutes  integer not null default 15 check (travel_minutes >= 0),
  -- Null until real location awareness arrives; see ADR-001 §9.3.
  lat             double precision,
  lon             double precision,
  geofence_m      integer,
  deleted_at      timestamptz,
  updated_at      timestamptz not null default now()
);

create table if not exists tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  rule         task_rule not null,
  stream       text not null,
  title        text not null,
  short        text,
  -- Not exclusive to place-locked work: a call is at 'anywhere', gym sessions at 'gym'.
  place_id     uuid references places(id) on delete set null,

  -- clock-locked. due_at is the resolved instant, never an offset (ADR-001 §5.1).
  due_at       timestamptz,
  setter_tz    text,
  who          setter,
  pct          smallint check (pct between 0 and 100),
  sleeps       boolean not null default false,
  note         text,
  notes        text,

  -- place-locked
  repeat_dow   smallint check (repeat_dow between 0 and 6),  -- 0=Mon … 6=Sun
  repeat_at    numeric(4,2),                                  -- fractional hour, home zone
  est_minutes  integer,
  queued_since date,

  -- locked to nothing
  sub               text,
  last_touched_at   timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,

  -- A task carries exactly one rule; fields from the other two stay null.
  constraint clock_needs_instant check (rule <> 'clock' or due_at is not null),
  constraint place_needs_place   check (rule <> 'place' or place_id is not null),
  constraint clock_only
    check (rule = 'clock' or (due_at is null and who is null and pct is null)),
  constraint place_only
    check (rule = 'place' or (repeat_dow is null and est_minutes is null)),
  constraint none_only
    check (rule = 'none' or (sub is null and last_touched_at is null))
);

-- Append-only. The client generates the id, so a replayed write is idempotent.
create table if not exists task_events (
  id           uuid primary key,
  user_id      uuid not null references auth.users on delete cascade,
  task_id      uuid references tasks(id) on delete cascade,
  kind         event_kind not null,
  -- day_key for skips, new due_at for moves, 'blk:<d>:<h>' for surrenders
  payload      jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null,   -- client wall clock; the last-write-wins version
  received_at  timestamptz not null default now(),
  device_id    text
);

create table if not exists blocks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  task_id      uuid references tasks(id) on delete cascade,  -- null = unclaimed slot
  dow          smallint not null check (dow between 0 and 6),
  starts_at    numeric(4,2) not null,
  ends_at      numeric(4,2) not null,
  label        text,
  updated_at   timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- --- indexes ----------------------------------------------------------------------

create index if not exists task_events_user_time on task_events (user_id, occurred_at desc);
create index if not exists task_events_task_kind on task_events (user_id, task_id, kind);
create index if not exists tasks_live on tasks (user_id) where deleted_at is null;
create index if not exists places_live on places (user_id) where deleted_at is null;
create index if not exists blocks_user on blocks (user_id);

-- --- row level security -------------------------------------------------------------

alter table profiles    enable row level security;
alter table places      enable row level security;
alter table tasks       enable row level security;
alter table task_events enable row level security;
alter table blocks      enable row level security;

-- `using` governs reads and the pre-image of writes; `with check` stops a client
-- inserting a row it would not be allowed to read back. Both are required.

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own places" on places;
create policy "own places" on places for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own tasks" on tasks;
create policy "own tasks" on tasks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own task_events" on task_events;
create policy "own task_events" on task_events for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own blocks" on blocks;
create policy "own blocks" on blocks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- a profile row for every new user -----------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
