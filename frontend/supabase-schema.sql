-- Run this entire script in Supabase SQL Editor (supabase.com → your project → SQL Editor)

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  balance numeric default 0,
  status text default 'Active',
  invoices int default 0,
  created_at timestamptz default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  client text not null,
  date date not null,
  amount numeric default 0,
  status text default 'Draft',
  notes text,
  items jsonb,
  created_at timestamptz default now()
);

create table if not exists quotations (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  client text not null,
  date date not null,
  amount numeric default 0,
  status text default 'Draft',
  notes text,
  items jsonb,
  created_at timestamptz default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  description text not null,
  category text,
  type text default 'expense',
  amount numeric default 0,
  created_at timestamptz default now()
);

-- Enable Row Level Security (RLS) - open access for now (tighten when auth is wired up)
alter table clients enable row level security;
alter table invoices enable row level security;
alter table quotations enable row level security;
alter table expenses enable row level security;

create policy "Allow all on clients" on clients for all using (true) with check (true);
create policy "Allow all on invoices" on invoices for all using (true) with check (true);
create policy "Allow all on quotations" on quotations for all using (true) with check (true);
create policy "Allow all on expenses" on expenses for all using (true) with check (true);
