-- Supabase Storage policies for V2 media.
-- Creates policies for avatars and artwork-media only.
-- Creates only the requested public buckets and policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']::text[]),
  ('artwork-media', 'artwork-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- avatars
-- Path format: {user_id}/avatar-{uuid}.{ext}
-- ---------------------------------------------------------------------------

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own_folder_or_admin" on storage.objects;
create policy "avatars_insert_own_folder_or_admin"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and array_length(storage.foldername(name), 1) = 1
    and storage.filename(name) like 'avatar-%'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_admin())
    )
  );

drop policy if exists "avatars_update_own_folder_or_admin" on storage.objects;
create policy "avatars_update_own_folder_or_admin"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and array_length(storage.foldername(name), 1) = 1
    and storage.filename(name) like 'avatar-%'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_admin())
    )
  )
  with check (
    bucket_id = 'avatars'
    and array_length(storage.foldername(name), 1) = 1
    and storage.filename(name) like 'avatar-%'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_admin())
    )
  );

drop policy if exists "avatars_delete_own_folder_or_admin" on storage.objects;
create policy "avatars_delete_own_folder_or_admin"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and array_length(storage.foldername(name), 1) = 1
    and storage.filename(name) like 'avatar-%'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- artwork-media
-- Path format: {author_id}/{artwork_id}/display/{sort_order}-{uuid}.{ext}
-- Public bucket: media for draft/private/hidden artworks must not be uploaded here.
-- Private originals/drafts storage will be added in a future migration.
-- ---------------------------------------------------------------------------

drop policy if exists "artwork_media_public_read" on storage.objects;
create policy "artwork_media_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'artwork-media');

drop policy if exists "artwork_media_insert_author_artwork_or_admin" on storage.objects;
create policy "artwork_media_insert_author_artwork_or_admin"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'artwork-media'
    and array_length(storage.foldername(name), 1) = 3
    and (storage.foldername(name))[3] = 'display'
    and coalesce(storage.filename(name), '') <> ''
    and exists (
      select 1
      from public.artworks a
      where a.id::text = (storage.foldername(name))[2]
        and a.author_id::text = (storage.foldername(name))[1]
        and a.status = 'published'
        and a.visibility = 'public'
        and a.deleted_at is null
        and (
          (a.author_id = (select auth.uid()) and (select private.is_creator_or_admin()))
          or (select private.is_admin())
        )
    )
  );

drop policy if exists "artwork_media_update_author_artwork_or_admin" on storage.objects;
create policy "artwork_media_update_author_artwork_or_admin"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'artwork-media'
    and array_length(storage.foldername(name), 1) = 3
    and (storage.foldername(name))[3] = 'display'
    and coalesce(storage.filename(name), '') <> ''
    and exists (
      select 1
      from public.artworks a
      where a.id::text = (storage.foldername(name))[2]
        and a.author_id::text = (storage.foldername(name))[1]
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
    bucket_id = 'artwork-media'
    and array_length(storage.foldername(name), 1) = 3
    and (storage.foldername(name))[3] = 'display'
    and coalesce(storage.filename(name), '') <> ''
    and exists (
      select 1
      from public.artworks a
      where a.id::text = (storage.foldername(name))[2]
        and a.author_id::text = (storage.foldername(name))[1]
        and a.status = 'published'
        and a.visibility = 'public'
        and a.deleted_at is null
        and (
          (a.author_id = (select auth.uid()) and (select private.is_creator_or_admin()))
          or (select private.is_admin())
        )
    )
  );

drop policy if exists "artwork_media_delete_author_artwork_or_admin" on storage.objects;
create policy "artwork_media_delete_author_artwork_or_admin"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'artwork-media'
    and array_length(storage.foldername(name), 1) = 3
    and (storage.foldername(name))[3] = 'display'
    and coalesce(storage.filename(name), '') <> ''
    and exists (
      select 1
      from public.artworks a
      where a.id::text = (storage.foldername(name))[2]
        and a.author_id::text = (storage.foldername(name))[1]
        and (
          a.author_id = (select auth.uid()) and (select private.is_creator_or_admin())
          or (select private.is_admin())
        )
    )
  );