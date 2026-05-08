-- Unit Catcher database schema

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  account_name text not null unique check (length(account_name) >= 8),
  created_at timestamptz not null default now()
);

create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  parent_id uuid references folders(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists urls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  folder_id uuid references folders(id) on delete set null,
  name text not null,
  url text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists folders_user_parent_position_idx
  on folders(user_id, parent_id, position);

create index if not exists urls_user_folder_position_idx
  on urls(user_id, folder_id, position);

-- Enable Row Level Security
alter table users enable row level security;
alter table folders enable row level security;
alter table urls enable row level security;

-- RLS policies: allow all operations (auth is handled in app via account_name)
create policy "allow all on users" on users for all using (true) with check (true);
create policy "allow all on folders" on folders for all using (true) with check (true);
create policy "allow all on urls" on urls for all using (true) with check (true);
