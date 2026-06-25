-- Profile username hardening and creator application workflow for Supabase V2.

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null and deleted_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_username_format_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_username_format_check
      check (
        username is null
        or username ~ '^[A-Za-z0-9_-]{3,32}$'
      )
      not valid;
  end if;
end;
$$;

create or replace function public.is_username_available(
  p_username text,
  p_current_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.profiles p
    where p.username is not null
      and lower(p.username) = lower(trim(p_username))
      and p.deleted_at is null
      and (p_current_user_id is null or p.id <> p_current_user_id)
  );
$$;

revoke execute on function public.is_username_available(text, uuid) from public, anon, service_role;
grant execute on function public.is_username_available(text, uuid) to authenticated;

create or replace function public.creator_application_work_links_valid(p_links text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(p_links), 0) between 1 and 5
    and not exists (
      select 1
      from unnest(p_links) as link(url)
      where link.url is null
        or link.url !~ '^https?://[^[:space:]]+$'
    );
$$;

create table if not exists public.creator_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  about text not null,
  portfolio_url text,
  social_url text,
  work_links text[] not null,
  status text not null default 'pending',
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_applications_status_check check (status in ('pending', 'approved', 'rejected')),
  constraint creator_applications_about_not_blank check (length(trim(about)) > 0),
  constraint creator_applications_work_links_count_check check (
    cardinality(work_links) between 1 and 5
  ),
  constraint creator_applications_work_links_url_check check (
    public.creator_application_work_links_valid(work_links)
  ),
  constraint creator_applications_portfolio_url_check check (
    portfolio_url is null
    or portfolio_url ~ '^https?://[^[:space:]]+$'
  ),
  constraint creator_applications_social_url_check check (
    social_url is null
    or social_url ~ '^https?://[^[:space:]]+$'
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'creator_applications_work_links_url_check'
      and conrelid = 'public.creator_applications'::regclass
  ) then
    alter table public.creator_applications
      add constraint creator_applications_work_links_url_check
      check (public.creator_application_work_links_valid(work_links))
      not valid;
  end if;
end;
$$;

create unique index if not exists creator_applications_one_pending_per_user_idx
  on public.creator_applications (applicant_id)
  where status = 'pending';

create index if not exists creator_applications_status_created_at_idx
  on public.creator_applications (status, created_at desc);

create index if not exists creator_applications_applicant_created_at_idx
  on public.creator_applications (applicant_id, created_at desc);

create or replace function public.set_creator_application_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_creator_application_user_review_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.deleted_at is null
  ) then
    return new;
  end if;

  if (
    old.status is distinct from new.status
    or old.admin_note is distinct from new.admin_note
    or old.reviewed_by is distinct from new.reviewed_by
    or old.reviewed_at is distinct from new.reviewed_at
  ) then
    raise exception 'Only admins may review creator applications';
  end if;

  return new;
end;
$$;

create or replace function public.apply_creator_application_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('approved', 'rejected') and old.status is distinct from new.status then
    new.reviewed_at = coalesce(new.reviewed_at, now());
    new.reviewed_by = coalesce(new.reviewed_by, auth.uid());
  end if;

  if new.status = 'approved' and old.status is distinct from 'approved' then
    update public.profiles
    set role = 'creator'
    where id = new.applicant_id
      and role <> 'admin';
  end if;

  return new;
end;
$$;

revoke execute on function public.creator_application_work_links_valid(text[]) from public, anon, service_role;
grant execute on function public.creator_application_work_links_valid(text[]) to authenticated;
revoke execute on function public.set_creator_application_updated_at() from public, anon, authenticated, service_role;
revoke execute on function public.prevent_creator_application_user_review_update() from public, anon, authenticated, service_role;
revoke execute on function public.apply_creator_application_review() from public, anon, authenticated, service_role;

drop trigger if exists set_creator_applications_updated_at on public.creator_applications;
create trigger set_creator_applications_updated_at
  before update on public.creator_applications
  for each row execute function public.set_creator_application_updated_at();

drop trigger if exists prevent_creator_application_user_review_update on public.creator_applications;
create trigger prevent_creator_application_user_review_update
  before update on public.creator_applications
  for each row execute function public.prevent_creator_application_user_review_update();

drop trigger if exists apply_creator_application_review on public.creator_applications;
create trigger apply_creator_application_review
  before update of status on public.creator_applications
  for each row execute function public.apply_creator_application_review();

alter table public.creator_applications enable row level security;

drop policy if exists "creator_applications_select_own_or_admin" on public.creator_applications;
create policy "creator_applications_select_own_or_admin"
  on public.creator_applications
  for select
  to authenticated
  using (
    applicant_id = (select auth.uid())
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.deleted_at is null
    )
  );

drop policy if exists "creator_applications_insert_own_pending" on public.creator_applications;
create policy "creator_applications_insert_own_pending"
  on public.creator_applications
  for insert
  to authenticated
  with check (
    applicant_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'user'
        and p.deleted_at is null
    )
    and status = 'pending'
    and admin_note is null
    and reviewed_by is null
    and reviewed_at is null
  );

drop policy if exists "creator_applications_update_admin_only" on public.creator_applications;
create policy "creator_applications_update_admin_only"
  on public.creator_applications
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.deleted_at is null
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.deleted_at is null
    )
  );

revoke all on public.creator_applications from anon;
grant select, insert, update on public.creator_applications to authenticated;