-- Supabase V2 base schema for my_gallery.
-- Preserves V1-compatible table names and columns used by the app.
-- This file is intentionally SQL only; it does not create stats views/RPCs.

create extension if not exists pgcrypto;

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  full_name text,
  avatar_url text,
  bio text,
  role text not null default 'user',
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint profiles_role_check check (role in ('user', 'creator', 'admin'))
);

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null and deleted_at is null;

create table if not exists public.artworks (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  tags text[] not null default array[]::text[],
  status text not null default 'published',
  visibility text not null default 'public',
  comments_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint artworks_status_check check (status in ('draft', 'published', 'archived', 'hidden')),
  constraint artworks_visibility_check check (visibility in ('public', 'unlisted', 'private'))
);

create index if not exists artworks_author_id_idx on public.artworks(author_id);
create index if not exists artworks_created_at_idx on public.artworks(created_at desc);
create index if not exists artworks_tags_idx on public.artworks using gin(tags);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favorites_user_artwork_unique unique (user_id, artwork_id)
);

create index if not exists favorites_artwork_id_idx on public.favorites(artwork_id);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location_name text,
  lat_long point,
  start_date timestamptz not null,
  end_date timestamptz not null,
  external_url text,
  image_url text,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_status_check check (status in ('draft', 'published', 'archived', 'hidden')),
  constraint events_dates_check check (end_date >= start_date)
);

create index if not exists events_start_date_idx on public.events(start_date);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  visibility text not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collections_visibility_check check (visibility in ('public', 'unlisted', 'private'))
);

create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  position integer not null default 0,
  constraint collection_items_collection_artwork_unique unique (collection_id, artwork_id)
);

create index if not exists collection_items_collection_position_idx
  on public.collection_items(collection_id, position);

create table if not exists public.artwork_media (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  bucket_id text not null,
  storage_path text not null,
  media_type text not null default 'image',
  alt_text text,
  width integer,
  height integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint artwork_media_dimensions_check check (
    (width is null or width > 0)
    and (height is null or height > 0)
  ),
  constraint artwork_media_sort_order_check check (sort_order >= 0),
  constraint artwork_media_bucket_check check (bucket_id = 'artwork-media'),
  constraint artwork_media_bucket_path_unique unique (bucket_id, storage_path),
  constraint artwork_media_artwork_sort_order_unique unique (artwork_id, sort_order)
);

create index if not exists artwork_media_artwork_id_idx on public.artwork_media(artwork_id);

create table if not exists public.artwork_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint artwork_likes_user_artwork_unique unique (user_id, artwork_id)
);

create index if not exists artwork_likes_artwork_id_idx on public.artwork_likes(artwork_id);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete set null,
  body text not null,
  status text not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comments_status_check check (status in ('visible', 'hidden', 'deleted', 'pending')),
  constraint comments_body_not_blank check (length(trim(body)) > 0)
);

create index if not exists comments_artwork_id_idx on public.comments(artwork_id);
create index if not exists comments_author_id_idx on public.comments(author_id);
create index if not exists comments_parent_id_idx on public.comments(parent_id);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self_follow_check check (follower_id <> following_id)
);

create index if not exists follows_following_id_idx on public.follows(following_id);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.deleted_at is null
  );
$$;

create or replace function private.is_creator_or_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('creator', 'admin')
      and p.deleted_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- Trigger functions
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    username,
    full_name,
    avatar_url,
    role
  )
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'username', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    'user'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function private.prevent_profile_protected_field_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    old.role is distinct from new.role
    or old.deleted_at is distinct from new.deleted_at
  )
  and current_role not in ('postgres', 'service_role', 'supabase_admin')
  and not (select private.is_admin())
  then
    raise exception 'Only admins may change profile role or deleted_at';
  end if;

  return new;
end;
$$;

create or replace function private.ensure_comment_parent_same_artwork()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is not null and not exists (
    select 1
    from public.comments parent
    where parent.id = new.parent_id
      and parent.artwork_id = new.artwork_id
  ) then
    raise exception 'Comment parent must belong to the same artwork';
  end if;

  return new;
end;
$$;

create or replace function private.validate_artwork_media_path()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  expected_author_id uuid;
  expected_prefix text;
  storage_path_parts text[];
begin
  select a.author_id
    into expected_author_id
  from public.artworks a
  where a.id = new.artwork_id;

  if expected_author_id is null then
    raise exception 'Artwork not found for artwork_media.artwork_id=%', new.artwork_id;
  end if;

  expected_prefix := expected_author_id::text || '/' || new.artwork_id::text || '/display/';
  storage_path_parts := string_to_array(new.storage_path, '/');

  if left(new.storage_path, length(expected_prefix)) <> expected_prefix
     or length(new.storage_path) <= length(expected_prefix) then
    raise exception 'artwork_media.storage_path must start with %', expected_prefix;
  end if;

  if array_length(storage_path_parts, 1) <> 4
     or storage_path_parts[1] <> expected_author_id::text
     or storage_path_parts[2] <> new.artwork_id::text
     or storage_path_parts[3] <> 'display'
     or coalesce(storage_path_parts[4], '') = '' then
    raise exception 'artwork_media.storage_path must match {author_id}/{artwork_id}/display/{filename}';
  end if;

  return new;
end;
$$;

create or replace function private.prevent_comment_identity_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    old.author_id is distinct from new.author_id
    or old.artwork_id is distinct from new.artwork_id
    or old.parent_id is distinct from new.parent_id
  )
  and current_role not in ('postgres', 'service_role', 'supabase_admin')
  and not (select private.is_admin())
  then
    raise exception 'Comment author_id, artwork_id and parent_id cannot be changed';
  end if;

  return new;
end;
$$;

create or replace function private.prevent_comment_unsafe_status_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_role in ('postgres', 'service_role', 'supabase_admin') or (select private.is_admin()) then
    return new;
  end if;

  if old.author_id <> (select auth.uid()) then
    raise exception 'Only the comment author or admin can update a comment';
  end if;

  if old.status = 'pending' and new.status = 'visible' then
    raise exception 'Only admins can approve pending comments';
  end if;

  if (old.status = 'hidden' or new.status = 'hidden') and old.status is distinct from new.status then
    raise exception 'Only admins can change hidden comment status';
  end if;

  if old.status = 'deleted' and new.status is distinct from old.status then
    raise exception 'Deleted comments cannot be restored by non-admin users';
  end if;

  if old.status = 'deleted' and new.status = 'visible' then
    raise exception 'Only admins can restore deleted comments';
  end if;

  if old.body is distinct from new.body and old.status in ('hidden', 'deleted', 'pending') then
    raise exception 'Only admins can edit hidden, deleted or pending comments';
  end if;

  if old.status = 'visible' then
    if new.status not in ('visible', 'deleted') then
      raise exception 'Comment authors may only keep visible comments visible or soft-delete them';
    end if;
    return new;
  end if;

  if old.status is distinct from new.status then
    raise exception 'Only admins can moderate comment status';
  end if;

  return new;
end;
$$;

revoke all on all functions in schema private from public;
revoke all on all functions in schema private from anon, authenticated;

grant execute on function private.is_admin() to anon, authenticated, service_role;
grant execute on function private.is_creator_or_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

drop trigger if exists prevent_profile_protected_field_update on public.profiles;
create trigger prevent_profile_protected_field_update
  before update on public.profiles
  for each row execute function private.prevent_profile_protected_field_update();

drop trigger if exists set_artworks_updated_at on public.artworks;
create trigger set_artworks_updated_at
  before update on public.artworks
  for each row execute function private.set_updated_at();

drop trigger if exists set_events_updated_at on public.events;
create trigger set_events_updated_at
  before update on public.events
  for each row execute function private.set_updated_at();

drop trigger if exists set_collections_updated_at on public.collections;
create trigger set_collections_updated_at
  before update on public.collections
  for each row execute function private.set_updated_at();

drop trigger if exists set_comments_updated_at on public.comments;
create trigger set_comments_updated_at
  before update on public.comments
  for each row execute function private.set_updated_at();

drop trigger if exists validate_artwork_media_path on public.artwork_media;
create trigger validate_artwork_media_path
  before insert or update on public.artwork_media
  for each row execute function private.validate_artwork_media_path();

drop trigger if exists ensure_comment_parent_same_artwork on public.comments;
create trigger ensure_comment_parent_same_artwork
  before insert or update on public.comments
  for each row execute function private.ensure_comment_parent_same_artwork();

drop trigger if exists prevent_comment_identity_update on public.comments;
create trigger prevent_comment_identity_update
  before update on public.comments
  for each row execute function private.prevent_comment_identity_update();


drop trigger if exists prevent_comment_unsafe_status_update on public.comments;
create trigger prevent_comment_unsafe_status_update
  before update on public.comments
  for each row execute function private.prevent_comment_unsafe_status_update();
-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.artworks enable row level security;
alter table public.favorites enable row level security;
alter table public.events enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.artwork_media enable row level security;
alter table public.artwork_likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;

-- profiles
drop policy if exists "profiles_select_public_own_admin" on public.profiles;
create policy "profiles_select_public_own_admin"
  on public.profiles
  for select
  using (
    (is_public = true and deleted_at is null)
    or id = (select auth.uid())
    or (select private.is_admin())
  );

drop policy if exists "profiles_insert_own_safe_profile" on public.profiles;
create policy "profiles_insert_own_safe_profile"
  on public.profiles
  for insert
  to authenticated
  with check (
    id = (select auth.uid())
    and role = 'user'
    and deleted_at is null
  );

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check (id = (select auth.uid()) or (select private.is_admin()));


-- artworks
drop policy if exists "artworks_select_public_or_owner_or_admin" on public.artworks;
create policy "artworks_select_public_or_owner_or_admin"
  on public.artworks
  for select
  using (
    (
      status = 'published'
      and visibility = 'public'
      and deleted_at is null
    )
    or author_id = (select auth.uid())
    or (select private.is_admin())
  );

drop policy if exists "artworks_insert_creator_own_or_admin" on public.artworks;
create policy "artworks_insert_creator_own_or_admin"
  on public.artworks
  for insert
  to authenticated
  with check (
    (author_id = (select auth.uid()) and (select private.is_creator_or_admin()))
    or (select private.is_admin())
  );

drop policy if exists "artworks_update_creator_own_or_admin" on public.artworks;
create policy "artworks_update_creator_own_or_admin"
  on public.artworks
  for update
  to authenticated
  using (
    (author_id = (select auth.uid()) and (select private.is_creator_or_admin()))
    or (select private.is_admin())
  )
  with check (
    (author_id = (select auth.uid()) and (select private.is_creator_or_admin()))
    or (select private.is_admin())
  );

drop policy if exists "artworks_delete_admin_only" on public.artworks;
create policy "artworks_delete_admin_only"
  on public.artworks
  for delete
  to authenticated
  using ((select private.is_admin()));

-- favorites
drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own"
  on public.favorites
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
  on public.favorites
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.artworks a
      where a.id = favorites.artwork_id
        and a.status = 'published'
        and a.visibility = 'public'
        and a.deleted_at is null
    )
  );

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
  on public.favorites
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- events
drop policy if exists "events_select_published_public" on public.events;
create policy "events_select_published_public"
  on public.events
  for select
  using (status = 'published');

drop policy if exists "events_admin_all" on public.events;
create policy "events_admin_all"
  on public.events
  for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- collections
drop policy if exists "collections_select_public_or_admin" on public.collections;
create policy "collections_select_public_or_admin"
  on public.collections
  for select
  using (visibility = 'public' or (select private.is_admin()));

drop policy if exists "collections_admin_all" on public.collections;
create policy "collections_admin_all"
  on public.collections
  for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- collection_items
drop policy if exists "collection_items_select_public_collections_or_admin" on public.collection_items;
create policy "collection_items_select_public_collections_or_admin"
  on public.collection_items
  for select
  using (
    (select private.is_admin())
    or (
      exists (
        select 1
        from public.collections c
        where c.id = collection_items.collection_id
          and c.visibility = 'public'
      )
      and exists (
        select 1
        from public.artworks a
        where a.id = collection_items.artwork_id
          and a.status = 'published'
          and a.visibility = 'public'
          and a.deleted_at is null
      )
    )
  );

drop policy if exists "collection_items_admin_all" on public.collection_items;
create policy "collection_items_admin_all"
  on public.collection_items
  for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- artwork_media
drop policy if exists "artwork_media_select_public_or_owner_or_admin" on public.artwork_media;
create policy "artwork_media_select_public_or_owner_or_admin"
  on public.artwork_media
  for select
  using (
    (select private.is_admin())
    or exists (
      select 1
      from public.artworks a
      where a.id = artwork_media.artwork_id
        and (
          (
            a.status = 'published'
            and a.visibility = 'public'
            and a.deleted_at is null
            and artwork_media.bucket_id = 'artwork-media'
          )
          or a.author_id = (select auth.uid())
        )
    )
  );

drop policy if exists "artwork_media_insert_owner_or_admin" on public.artwork_media;
create policy "artwork_media_insert_owner_or_admin"
  on public.artwork_media
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.artworks a
      where a.id = artwork_media.artwork_id
        and a.status = 'published'
        and a.visibility = 'public'
        and a.deleted_at is null
        and (
          (a.author_id = (select auth.uid()) and (select private.is_creator_or_admin()))
          or (select private.is_admin())
        )
    )
  );

drop policy if exists "artwork_media_update_owner_or_admin" on public.artwork_media;
create policy "artwork_media_update_owner_or_admin"
  on public.artwork_media
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.artworks a
      where a.id = artwork_media.artwork_id
        and a.status = 'published'
        and a.visibility = 'public'
        and a.deleted_at is null
        and (
          (a.author_id = (select auth.uid()) and (select private.is_creator_or_admin()))
          or (select private.is_admin())
        )
    )
  )
  with check (
    exists (
      select 1
      from public.artworks a
      where a.id = artwork_media.artwork_id
        and a.status = 'published'
        and a.visibility = 'public'
        and a.deleted_at is null
        and (
          (a.author_id = (select auth.uid()) and (select private.is_creator_or_admin()))
          or (select private.is_admin())
        )
    )
  );

drop policy if exists "artwork_media_delete_owner_or_admin" on public.artwork_media;
create policy "artwork_media_delete_owner_or_admin"
  on public.artwork_media
  for delete
  to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1
      from public.artworks a
      where a.id = artwork_media.artwork_id
        and a.author_id = (select auth.uid())
        and (select private.is_creator_or_admin())
    )
  );

-- artwork_likes
drop policy if exists "artwork_likes_select_own" on public.artwork_likes;
create policy "artwork_likes_select_own"
  on public.artwork_likes
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "artwork_likes_insert_own" on public.artwork_likes;
create policy "artwork_likes_insert_own"
  on public.artwork_likes
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.artworks a
      where a.id = artwork_likes.artwork_id
        and a.status = 'published'
        and a.visibility = 'public'
        and a.deleted_at is null
    )
  );

drop policy if exists "artwork_likes_delete_own" on public.artwork_likes;
create policy "artwork_likes_delete_own"
  on public.artwork_likes
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- comments
drop policy if exists "comments_select_visible_public_or_own_or_admin" on public.comments;
create policy "comments_select_visible_public_or_own_or_admin"
  on public.comments
  for select
  using (
    (select private.is_admin())
    or author_id = (select auth.uid())
    or (
      status = 'visible'
      and exists (
        select 1
        from public.artworks a
        where a.id = comments.artwork_id
          and a.status = 'published'
          and a.visibility = 'public'
          and a.deleted_at is null
      )
    )
  );

drop policy if exists "comments_insert_own_on_public_commentable_artwork" on public.comments;
create policy "comments_insert_own_on_public_commentable_artwork"
  on public.comments
  for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and status in ('visible', 'pending')
    and exists (
      select 1
      from public.artworks a
      where a.id = comments.artwork_id
        and a.status = 'published'
        and a.visibility = 'public'
        and a.deleted_at is null
        and a.comments_enabled = true
    )
  );

drop policy if exists "comments_update_own_soft_delete_or_admin" on public.comments;
create policy "comments_update_own_soft_delete_or_admin"
  on public.comments
  for update
  to authenticated
  using (author_id = (select auth.uid()) or (select private.is_admin()))
  with check (
    (select private.is_admin())
    or (
      author_id = (select auth.uid())
      and status in ('visible', 'deleted')
    )
  );

drop policy if exists "comments_delete_admin_only" on public.comments;
create policy "comments_delete_admin_only"
  on public.comments
  for delete
  to authenticated
  using ((select private.is_admin()));

-- follows
drop policy if exists "follows_select_own_or_public_profiles" on public.follows;
create policy "follows_select_own_or_public_profiles"
  on public.follows
  for select
  to authenticated
  using (
    follower_id = (select auth.uid())
    or following_id = (select auth.uid())
    or exists (
      select 1
      from public.profiles p
      where p.id = follows.following_id
        and p.is_public = true
        and p.deleted_at is null
    )
  );

drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own"
  on public.follows
  for insert
  to authenticated
  with check (
    follower_id = (select auth.uid())
    and follower_id <> following_id
    and exists (
      select 1
      from public.profiles p
      where p.id = follows.following_id
        and p.is_public = true
        and p.deleted_at is null
    )
  );

drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own"
  on public.follows
  for delete
  to authenticated
  using (follower_id = (select auth.uid()));
-- После регистрации первого пользователя назначьте его администратором вручную:
-- update public.profiles
-- set role = 'admin'
-- where id = 'UUID_ПЕРВОГО_ПОЛЬЗОВАТЕЛЯ';
