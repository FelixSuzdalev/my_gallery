-- Supabase V2 collections management.
-- Extends existing collections and collection_items tables without duplicating them.

alter table public.collections
  add column if not exists cover_url text;

alter table public.collections
  drop constraint if exists collections_cover_url_check;

alter table public.collections
  add constraint collections_cover_url_check
  check (
    cover_url is null
    or cover_url = ''
    or cover_url ~ '^https?://[^[:space:]]+$'
  );

create index if not exists collections_created_by_created_at_idx
  on public.collections(created_by, created_at desc);

create index if not exists collections_public_created_at_idx
  on public.collections(created_at desc)
  where visibility = 'public';

create index if not exists collection_items_artwork_id_idx
  on public.collection_items(artwork_id);

create or replace function public.validate_collection_item_artwork()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  collection_author_id uuid;
begin
  select c.created_by
    into collection_author_id
  from public.collections c
  where c.id = new.collection_id;

  if collection_author_id is null then
    raise exception 'Collection author is required before adding artworks';
  end if;

  if not exists (
    select 1
    from public.artworks a
    where a.id = new.artwork_id
      and a.author_id = collection_author_id
      and a.status = 'published'
      and a.visibility = 'public'
      and a.deleted_at is null
  ) then
    raise exception 'Collection can contain only published public artworks by the collection author';
  end if;

  return new;
end;
$$;

revoke execute on function public.validate_collection_item_artwork()
from public, anon, authenticated, service_role;

drop trigger if exists validate_collection_item_artwork on public.collection_items;
create trigger validate_collection_item_artwork
  before insert or update on public.collection_items
  for each row execute function public.validate_collection_item_artwork();

drop policy if exists "collections_select_own_creator_or_admin" on public.collections;
create policy "collections_select_own_creator_or_admin"
  on public.collections
  for select
  to authenticated
  using (
    created_by = (select auth.uid())
    or exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
        and p.deleted_at is null
    )
  );

drop policy if exists "collections_insert_creator_own_or_admin" on public.collections;
create policy "collections_insert_creator_own_or_admin"
  on public.collections
  for insert
  to authenticated
  with check (
    (
      created_by = (select auth.uid())
      and exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.role in ('creator', 'admin')
          and p.deleted_at is null
      )
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
        and p.deleted_at is null
    )
  );

drop policy if exists "collections_update_creator_own_or_admin" on public.collections;
create policy "collections_update_creator_own_or_admin"
  on public.collections
  for update
  to authenticated
  using (
    (
      created_by = (select auth.uid())
      and exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.role in ('creator', 'admin')
          and p.deleted_at is null
      )
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
        and p.deleted_at is null
    )
  )
  with check (
    (
      created_by = (select auth.uid())
      and exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.role in ('creator', 'admin')
          and p.deleted_at is null
      )
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
        and p.deleted_at is null
    )
  );

drop policy if exists "collections_delete_creator_own_or_admin" on public.collections;
create policy "collections_delete_creator_own_or_admin"
  on public.collections
  for delete
  to authenticated
  using (
    (
      created_by = (select auth.uid())
      and exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.role in ('creator', 'admin')
          and p.deleted_at is null
      )
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
        and p.deleted_at is null
    )
  );

drop policy if exists "collection_items_select_own_creator_or_admin" on public.collection_items;
create policy "collection_items_select_own_creator_or_admin"
  on public.collection_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.collections c
      where c.id = collection_items.collection_id
        and c.created_by = (select auth.uid())
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
        and p.deleted_at is null
    )
  );

drop policy if exists "collection_items_insert_creator_own_or_admin" on public.collection_items;
create policy "collection_items_insert_creator_own_or_admin"
  on public.collection_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.collections c
      join public.artworks a on a.id = collection_items.artwork_id
      join public.profiles p on p.id = (select auth.uid())
      where c.id = collection_items.collection_id
        and a.author_id = c.created_by
        and a.status = 'published'
        and a.visibility = 'public'
        and a.deleted_at is null
        and p.deleted_at is null
        and (
          (c.created_by = (select auth.uid()) and p.role in ('creator', 'admin'))
          or p.role = 'admin'
        )
    )
  );

drop policy if exists "collection_items_update_creator_own_or_admin" on public.collection_items;
create policy "collection_items_update_creator_own_or_admin"
  on public.collection_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.collections c
      join public.profiles p on p.id = (select auth.uid())
      where c.id = collection_items.collection_id
        and p.deleted_at is null
        and (
          (c.created_by = (select auth.uid()) and p.role in ('creator', 'admin'))
          or p.role = 'admin'
        )
    )
  )
  with check (
    exists (
      select 1
      from public.collections c
      join public.artworks a on a.id = collection_items.artwork_id
      join public.profiles p on p.id = (select auth.uid())
      where c.id = collection_items.collection_id
        and a.author_id = c.created_by
        and a.status = 'published'
        and a.visibility = 'public'
        and a.deleted_at is null
        and p.deleted_at is null
        and (
          (c.created_by = (select auth.uid()) and p.role in ('creator', 'admin'))
          or p.role = 'admin'
        )
    )
  );

drop policy if exists "collection_items_delete_creator_own_or_admin" on public.collection_items;
create policy "collection_items_delete_creator_own_or_admin"
  on public.collection_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.collections c
      join public.profiles p on p.id = (select auth.uid())
      where c.id = collection_items.collection_id
        and p.deleted_at is null
        and (
          (c.created_by = (select auth.uid()) and p.role in ('creator', 'admin'))
          or p.role = 'admin'
        )
    )
  );
