-- Sales Entry app: cloud table for Sales Details
create table if not exists sales_entries (
  id text primary key,
  entry_date date not null,
  entry_time text,
  total numeric not null,
  items jsonb,
  created_at timestamptz default now()
);

-- demo access for the public anon key (fine for a personal/small shop app)
alter table sales_entries enable row level security;
create policy "demo" on sales_entries for all using (true) with check (true);
