-- Public aggregate counters only. Raw favorites, likes and comments remain protected by RLS.

create table if not exists public.artwork_stats (
  artwork_id uuid primary key references public.artworks(id) on delete cascade,
  likes_count bigint not null default 0,
  favorites_count bigint not null default 0,
  comments_count bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint artwork_stats_likes_count_check check (likes_count >= 0),
  constraint artwork_stats_favorites_count_check check (favorites_count >= 0),
  constraint artwork_stats_comments_count_check check (comments_count >= 0)
);

create or replace function private.recalculate_artwork_stats(p_artwork_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.artworks a
    where a.id = p_artwork_id
  ) then
    return;
  end if;

  insert into public.artwork_stats (
    artwork_id,
    likes_count,
    favorites_count,
    comments_count,
    updated_at
  )
  values (
    p_artwork_id,
    (
      select count(*)::bigint
      from public.artwork_likes al
      where al.artwork_id = p_artwork_id
    ),
    (
      select count(*)::bigint
      from public.favorites f
      where f.artwork_id = p_artwork_id
    ),
    (
      select count(*)::bigint
      from public.comments c
      where c.artwork_id = p_artwork_id
        and c.status = 'visible'
    ),
    now()
  )
  on conflict (artwork_id) do update
  set likes_count = excluded.likes_count,
      favorites_count = excluded.favorites_count,
      comments_count = excluded.comments_count,
      updated_at = excluded.updated_at;
end;
$$;

create or replace function private.initialize_artwork_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.artwork_stats (artwork_id)
  values (new.id)
  on conflict (artwork_id) do nothing;

  return new;
end;
$$;

create or replace function private.sync_artwork_stats_from_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_artwork_id uuid;
begin
  if tg_op = 'DELETE' then
    changed_artwork_id := old.artwork_id;
  else
    changed_artwork_id := new.artwork_id;
  end if;

  perform private.recalculate_artwork_stats(changed_artwork_id);

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke execute on function private.recalculate_artwork_stats(uuid) from public, anon, authenticated, service_role;
revoke execute on function private.initialize_artwork_stats() from public, anon, authenticated, service_role;
revoke execute on function private.sync_artwork_stats_from_change() from public, anon, authenticated, service_role;

create index if not exists favorites_artwork_id_idx
on public.favorites (artwork_id);

create index if not exists artwork_likes_artwork_id_idx
on public.artwork_likes (artwork_id);

create index if not exists comments_visible_artwork_id_idx
on public.comments (artwork_id)
where status = 'visible';

insert into public.artwork_stats (
  artwork_id,
  likes_count,
  favorites_count,
  comments_count,
  updated_at
)
select
  a.id,
  coalesce(l.likes_count, 0)::bigint,
  coalesce(f.favorites_count, 0)::bigint,
  coalesce(c.comments_count, 0)::bigint,
  now()
from public.artworks a
left join (
  select al.artwork_id, count(*)::bigint as likes_count
  from public.artwork_likes al
  group by al.artwork_id
) l on l.artwork_id = a.id
left join (
  select fav.artwork_id, count(*)::bigint as favorites_count
  from public.favorites fav
  group by fav.artwork_id
) f on f.artwork_id = a.id
left join (
  select com.artwork_id, count(*)::bigint as comments_count
  from public.comments com
  where com.status = 'visible'
  group by com.artwork_id
) c on c.artwork_id = a.id
on conflict (artwork_id) do update
set likes_count = excluded.likes_count,
    favorites_count = excluded.favorites_count,
    comments_count = excluded.comments_count,
    updated_at = excluded.updated_at;

drop trigger if exists initialize_artwork_stats on public.artworks;
create trigger initialize_artwork_stats
  after insert on public.artworks
  for each row execute function private.initialize_artwork_stats();

drop trigger if exists sync_artwork_stats_from_favorites_change on public.favorites;
create trigger sync_artwork_stats_from_favorites_change
  after insert or delete on public.favorites
  for each row execute function private.sync_artwork_stats_from_change();

drop trigger if exists sync_artwork_stats_from_likes_change on public.artwork_likes;
create trigger sync_artwork_stats_from_likes_change
  after insert or delete on public.artwork_likes
  for each row execute function private.sync_artwork_stats_from_change();

drop trigger if exists sync_artwork_stats_from_comments_change on public.comments;
create trigger sync_artwork_stats_from_comments_change
  after insert or delete or update of status on public.comments
  for each row execute function private.sync_artwork_stats_from_change();

alter table public.artwork_stats enable row level security;

drop policy if exists "artwork_stats_select_public_or_admin" on public.artwork_stats;
create policy "artwork_stats_select_public_or_admin"
  on public.artwork_stats
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.artworks a
      where a.id = artwork_stats.artwork_id
        and a.status = 'published'
        and a.visibility = 'public'
        and a.deleted_at is null
    )
    or (select private.is_admin())
  );

revoke all on public.artwork_stats from public;
grant select on public.artwork_stats to anon, authenticated;
revoke insert, update, delete on public.artwork_stats from anon, authenticated;
