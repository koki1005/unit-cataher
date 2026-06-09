-- Background image support
-- Users get a global background; folders and urls each get an optional card background.
-- focal_x / focal_y are in [0,1] and map to CSS object-position so the focal point stays visible across aspect ratios.

alter table users  add column if not exists bg_image_url text;
alter table users  add column if not exists bg_focal_x   real not null default 0.5;
alter table users  add column if not exists bg_focal_y   real not null default 0.5;

alter table folders add column if not exists bg_image_url text;
alter table folders add column if not exists bg_focal_x   real not null default 0.5;
alter table folders add column if not exists bg_focal_y   real not null default 0.5;

alter table urls    add column if not exists bg_image_url text;
alter table urls    add column if not exists bg_focal_x   real not null default 0.5;
alter table urls    add column if not exists bg_focal_y   real not null default 0.5;

-- RPC: update user (global) background
create or replace function set_user_background(
  p_user_id uuid,
  p_image_url text,
  p_focal_x real,
  p_focal_y real
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update users
  set bg_image_url = p_image_url,
      bg_focal_x   = coalesce(p_focal_x, 0.5),
      bg_focal_y   = coalesce(p_focal_y, 0.5)
  where users.id = p_user_id;
  return found;
end;
$$;

grant execute on function set_user_background(uuid, text, real, real) to anon, authenticated;

-- Update existing login/register/set_password RPCs to return bg fields too
-- Return type changed, so DROP first then recreate
drop function if exists register_user_with_password(text, text);
drop function if exists login_with_password(text, text);

create or replace function register_user_with_password(
  p_account_name text,
  p_password text
)
returns table(id uuid, account_name text, created_at timestamptz, has_password boolean, bg_image_url text, bg_focal_x real, bg_focal_y real)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_account_name text;
  v_created_at timestamptz;
begin
  if length(p_account_name) < 8 then
    raise exception 'account_name_too_short';
  end if;
  if p_password is null or length(p_password) < 1 then
    raise exception 'password_required';
  end if;
  if exists (select 1 from users u where u.account_name = p_account_name) then
    raise exception 'account_name_taken';
  end if;

  insert into users (account_name, password_hash)
  values (p_account_name, crypt(p_password, gen_salt('bf')))
  returning users.id, users.account_name, users.created_at
  into v_id, v_account_name, v_created_at;

  return query select v_id, v_account_name, v_created_at, true, null::text, 0.5::real, 0.5::real;
end;
$$;

create or replace function login_with_password(
  p_account_name text,
  p_password text
)
returns table(id uuid, account_name text, created_at timestamptz, has_password boolean, bg_image_url text, bg_focal_x real, bg_focal_y real)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row users%rowtype;
begin
  select * into v_row from users where users.account_name = p_account_name;
  if not found then
    raise exception 'account_not_found';
  end if;

  if v_row.password_hash is null then
    return query select v_row.id, v_row.account_name, v_row.created_at, false, v_row.bg_image_url, v_row.bg_focal_x, v_row.bg_focal_y;
    return;
  end if;

  if p_password is null or length(p_password) < 1 then
    raise exception 'password_required';
  end if;

  if crypt(p_password, v_row.password_hash) <> v_row.password_hash then
    raise exception 'invalid_password';
  end if;

  return query select v_row.id, v_row.account_name, v_row.created_at, true, v_row.bg_image_url, v_row.bg_focal_x, v_row.bg_focal_y;
end;
$$;

grant execute on function register_user_with_password(text, text) to anon, authenticated;
grant execute on function login_with_password(text, text) to anon, authenticated;

-- RPC: fetch latest bg state for the user (so we can refresh after upload)
create or replace function get_user_background(p_user_id uuid)
returns table(bg_image_url text, bg_focal_x real, bg_focal_y real)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query select u.bg_image_url, u.bg_focal_x, u.bg_focal_y from users u where u.id = p_user_id;
end;
$$;

grant execute on function get_user_background(uuid) to anon, authenticated;

-- Storage bucket: backgrounds
insert into storage.buckets (id, name, public)
values ('backgrounds', 'backgrounds', true)
on conflict (id) do update set public = true;

-- Storage policies (open: app-level user_id guards in path)
drop policy if exists "backgrounds_select" on storage.objects;
drop policy if exists "backgrounds_insert" on storage.objects;
drop policy if exists "backgrounds_update" on storage.objects;
drop policy if exists "backgrounds_delete" on storage.objects;
create policy "backgrounds_select" on storage.objects for select using (bucket_id = 'backgrounds');
create policy "backgrounds_insert" on storage.objects for insert with check (bucket_id = 'backgrounds');
create policy "backgrounds_update" on storage.objects for update using (bucket_id = 'backgrounds') with check (bucket_id = 'backgrounds');
create policy "backgrounds_delete" on storage.objects for delete using (bucket_id = 'backgrounds');
