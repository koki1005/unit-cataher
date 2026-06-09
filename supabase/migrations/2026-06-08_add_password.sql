-- Unit Catcher: パスワード機能追加マイグレーション
-- 既存DBにこのファイルをSupabase SQL Editorで実行する

create extension if not exists pgcrypto;

-- 1. users テーブルに password_hash 列を追加 (既存ユーザはNULL)
alter table users add column if not exists password_hash text;

-- 2. RLS: users への直接アクセスを禁止し RPC 経由に統一
drop policy if exists "allow all on users" on users;
drop policy if exists "deny direct on users" on users;
create policy "deny direct on users" on users for all using (false) with check (false);

-- 3. RPC 関数群: 既存定義があると戻り値の型変更でエラーになるため先にDROPする
drop function if exists register_user_with_password(text, text);
drop function if exists login_with_password(text, text);
drop function if exists set_user_password(uuid, text, text);
drop function if exists change_user_password(uuid, text, text);

-- 4. RPC: 新規ユーザ登録 (パスワード必須)
create or replace function register_user_with_password(
  p_account_name text,
  p_password text
)
returns table(id uuid, account_name text, created_at timestamptz, has_password boolean)
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

  return query select v_id, v_account_name, v_created_at, true;
end;
$$;

-- 4. RPC: ログイン (パスワード未設定アカウントは has_password=false で返す)
create or replace function login_with_password(
  p_account_name text,
  p_password text
)
returns table(id uuid, account_name text, created_at timestamptz, has_password boolean)
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
    return query select v_row.id, v_row.account_name, v_row.created_at, false;
    return;
  end if;

  if p_password is null or length(p_password) < 1 then
    raise exception 'password_required';
  end if;

  if crypt(p_password, v_row.password_hash) <> v_row.password_hash then
    raise exception 'invalid_password';
  end if;

  return query select v_row.id, v_row.account_name, v_row.created_at, true;
end;
$$;

-- 5. RPC: パスワード未設定ユーザの初回パスワード設定
create or replace function set_user_password(
  p_user_id uuid,
  p_account_name text,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row users%rowtype;
begin
  if p_new_password is null or length(p_new_password) < 1 then
    raise exception 'password_required';
  end if;

  select * into v_row from users where users.id = p_user_id and users.account_name = p_account_name;
  if not found then
    raise exception 'account_not_found';
  end if;
  if v_row.password_hash is not null then
    raise exception 'password_already_set';
  end if;

  update users
  set password_hash = crypt(p_new_password, gen_salt('bf'))
  where users.id = p_user_id;

  return true;
end;
$$;

-- 6. RPC: パスワード変更 (現在のパスワード必須)
create or replace function change_user_password(
  p_user_id uuid,
  p_current_password text,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row users%rowtype;
begin
  if p_new_password is null or length(p_new_password) < 1 then
    raise exception 'password_required';
  end if;

  select * into v_row from users where users.id = p_user_id;
  if not found then
    raise exception 'account_not_found';
  end if;
  if v_row.password_hash is null then
    raise exception 'password_not_set';
  end if;
  if p_current_password is null or crypt(p_current_password, v_row.password_hash) <> v_row.password_hash then
    raise exception 'invalid_password';
  end if;

  update users
  set password_hash = crypt(p_new_password, gen_salt('bf'))
  where users.id = p_user_id;

  return true;
end;
$$;

-- 7. anon/authenticated ロールに RPC 実行権限を付与
grant execute on function register_user_with_password(text, text) to anon, authenticated;
grant execute on function login_with_password(text, text) to anon, authenticated;
grant execute on function set_user_password(uuid, text, text) to anon, authenticated;
grant execute on function change_user_password(uuid, text, text) to anon, authenticated;
