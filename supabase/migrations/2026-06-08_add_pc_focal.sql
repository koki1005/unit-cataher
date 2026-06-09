-- Per-device focal points: phone uses bg_focal_x/y (existing), PC uses bg_focal_x_pc/y_pc (new)

alter table users   add column if not exists bg_focal_x_pc real not null default 0.5;
alter table users   add column if not exists bg_focal_y_pc real not null default 0.5;
alter table folders add column if not exists bg_focal_x_pc real not null default 0.5;
alter table folders add column if not exists bg_focal_y_pc real not null default 0.5;
alter table urls    add column if not exists bg_focal_x_pc real not null default 0.5;
alter table urls    add column if not exists bg_focal_y_pc real not null default 0.5;

-- Update set_user_background to accept PC focal too
drop function if exists set_user_background(uuid, text, real, real);
drop function if exists set_user_background(uuid, text, real, real, real, real);

create or replace function set_user_background(
  p_user_id uuid,
  p_image_url text,
  p_focal_x real,
  p_focal_y real,
  p_focal_x_pc real,
  p_focal_y_pc real
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update users
  set bg_image_url   = p_image_url,
      bg_focal_x     = coalesce(p_focal_x, 0.5),
      bg_focal_y     = coalesce(p_focal_y, 0.5),
      bg_focal_x_pc  = coalesce(p_focal_x_pc, 0.5),
      bg_focal_y_pc  = coalesce(p_focal_y_pc, 0.5)
  where users.id = p_user_id;
  return found;
end;
$$;

grant execute on function set_user_background(uuid, text, real, real, real, real) to anon, authenticated;

-- Recreate register/login/get_user_background with new return columns
drop function if exists register_user_with_password(text, text);
drop function if exists login_with_password(text, text);
drop function if exists get_user_background(uuid);

create or replace function register_user_with_password(
  p_account_name text,
  p_password text
)
returns table(
  id uuid, account_name text, created_at timestamptz, has_password boolean,
  bg_image_url text, bg_focal_x real, bg_focal_y real, bg_focal_x_pc real, bg_focal_y_pc real
)
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

  return query select v_id, v_account_name, v_created_at, true, null::text, 0.5::real, 0.5::real, 0.5::real, 0.5::real;
end;
$$;

create or replace function login_with_password(
  p_account_name text,
  p_password text
)
returns table(
  id uuid, account_name text, created_at timestamptz, has_password boolean,
  bg_image_url text, bg_focal_x real, bg_focal_y real, bg_focal_x_pc real, bg_focal_y_pc real
)
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
    return query select v_row.id, v_row.account_name, v_row.created_at, false,
      v_row.bg_image_url, v_row.bg_focal_x, v_row.bg_focal_y, v_row.bg_focal_x_pc, v_row.bg_focal_y_pc;
    return;
  end if;

  if p_password is null or length(p_password) < 1 then
    raise exception 'password_required';
  end if;

  if crypt(p_password, v_row.password_hash) <> v_row.password_hash then
    raise exception 'invalid_password';
  end if;

  return query select v_row.id, v_row.account_name, v_row.created_at, true,
    v_row.bg_image_url, v_row.bg_focal_x, v_row.bg_focal_y, v_row.bg_focal_x_pc, v_row.bg_focal_y_pc;
end;
$$;

create or replace function get_user_background(p_user_id uuid)
returns table(bg_image_url text, bg_focal_x real, bg_focal_y real, bg_focal_x_pc real, bg_focal_y_pc real)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query select u.bg_image_url, u.bg_focal_x, u.bg_focal_y, u.bg_focal_x_pc, u.bg_focal_y_pc
    from users u where u.id = p_user_id;
end;
$$;

grant execute on function register_user_with_password(text, text) to anon, authenticated;
grant execute on function login_with_password(text, text) to anon, authenticated;
grant execute on function get_user_background(uuid) to anon, authenticated;
