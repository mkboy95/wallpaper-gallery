-- ============================================================
-- Linux.do 自定义 OAuth Provider 兼容补丁
-- 说明：
-- 1. 支持从 avatar_template 生成可用头像 URL
-- 2. 新用户初始化时兼容 username / avatar_template 元数据
-- ============================================================

create or replace function public.normalize_linuxdo_avatar_url(
  avatar_template text,
  fallback_origin text default 'https://linux.do',
  avatar_size text default '240'
)
returns text
language sql
immutable
as $$
  select
    case
      when avatar_template is null or btrim(avatar_template) = '' then null
      when left(btrim(avatar_template), 2) = '//' then 'https:' || replace(btrim(avatar_template), '{size}', avatar_size)
      when btrim(avatar_template) ~ '^https?://' then replace(btrim(avatar_template), '{size}', avatar_size)
      when left(btrim(avatar_template), 1) = '/' then fallback_origin || replace(btrim(avatar_template), '{size}', avatar_size)
      else fallback_origin || '/' || replace(btrim(avatar_template), '{size}', avatar_size)
    end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fallback_name text;
  fallback_username text;
begin
  fallback_name := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'user_name',
    new.raw_user_meta_data ->> 'preferred_username',
    new.raw_user_meta_data ->> 'username',
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    '用户'
  );

  fallback_username := nullif(
    lower(
      regexp_replace(
        coalesce(
          new.raw_user_meta_data ->> 'username',
          new.raw_user_meta_data ->> 'user_name',
          new.raw_user_meta_data ->> 'preferred_username',
          ''
        ),
        '[^a-zA-Z0-9_-]',
        '',
        'g'
      )
    ),
    ''
  );

  insert into public.profiles (
    id,
    username,
    display_name,
    avatar_url,
    primary_email,
    primary_provider
  )
  values (
    new.id,
    fallback_username,
    fallback_name,
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture',
      public.normalize_linuxdo_avatar_url(new.raw_user_meta_data ->> 'avatar_template')
    ),
    new.email,
    coalesce(new.raw_app_meta_data ->> 'provider', 'email')
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.user_collections (
    user_id,
    name,
    visibility,
    collection_type,
    is_default
  )
  values (
    new.id,
    '默认收藏夹',
    'private',
    'system',
    true
  )
  on conflict do nothing;

  return new;
end;
$$;
