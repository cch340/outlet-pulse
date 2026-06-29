-- Staff Monitor schema. No auth yet: RLS is permissive.
-- When auth lands, replace each "allow all" policy with per-user policies
-- (e.g. using auth.uid() and an owner/membership column).

create extension if not exists "pgcrypto";

create table brands (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  color     text not null,
  category  text not null
);

create table outlets (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  location  text not null
);

create table stores (
  brand_id  uuid not null references brands(id) on delete restrict,
  outlet_id uuid not null references outlets(id) on delete restrict,
  primary key (brand_id, outlet_id)
);

create table staff (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  brand_id  uuid not null references brands(id) on delete restrict,
  outlet_id uuid not null references outlets(id) on delete restrict,
  role      text not null,
  joined    date not null
);

create table staff_history (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references staff(id) on delete cascade,
  brand_id   uuid not null references brands(id) on delete restrict,
  outlet_id  uuid not null references outlets(id) on delete restrict,
  from_label text not null,
  to_label   text,
  reason     text,
  created_at timestamptz not null default now()
);

create table follow_ups (
  id        uuid primary key default gen_random_uuid(),
  date      date not null,
  staff_id  uuid references staff(id) on delete set null,
  brand_id  uuid not null references brands(id) on delete restrict,
  outlet_id uuid not null references outlets(id) on delete restrict,
  status    text not null default 'pending' check (status in ('done','pending'))
);

create table follow_up_tasks (
  id           uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null references follow_ups(id) on delete cascade,
  label        text not null,
  done         boolean not null default false,
  sort         int not null default 0
);

-- Permissive RLS for the no-auth phase. REPLACE before any real launch.
alter table brands           enable row level security;
alter table outlets          enable row level security;
alter table stores           enable row level security;
alter table staff            enable row level security;
alter table staff_history    enable row level security;
alter table follow_ups       enable row level security;
alter table follow_up_tasks  enable row level security;

create policy "allow all" on brands          for all using (true) with check (true);
create policy "allow all" on outlets         for all using (true) with check (true);
create policy "allow all" on stores          for all using (true) with check (true);
create policy "allow all" on staff           for all using (true) with check (true);
create policy "allow all" on staff_history   for all using (true) with check (true);
create policy "allow all" on follow_ups      for all using (true) with check (true);
create policy "allow all" on follow_up_tasks for all using (true) with check (true);
