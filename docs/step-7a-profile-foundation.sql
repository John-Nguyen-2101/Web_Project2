-- Step 7A/7B profile foundation SQL.
-- Review before running. This intentionally does not touch songs, song_versions,
-- blog_posts, or auth behavior beyond public read access for profile display.
--
-- Public profile surface exposed by this script:
-- profiles: id, username, display_name, bio, avatar_url, website_url, is_public
-- profile_social_links: visible public links for public profiles only
--
-- The grants below are column-level where practical so private/auth-sensitive
-- profile columns added later are not accidentally exposed through PostgREST.

alter table public.profiles
  add column if not exists username text,
  add column if not exists display_name text,
  add column if not exists bio text,
  add column if not exists avatar_url text,
  add column if not exists website_url text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists is_public boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists profiles_username_unique_idx
  on public.profiles (username)
  where username is not null;

create index if not exists profiles_is_public_idx
  on public.profiles (is_public);

create table if not exists public.profile_social_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null,
  label text,
  url text not null,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  constraint profile_social_links_platform_check
    check (platform in (
      'youtube', 'tiktok', 'instagram', 'facebook',
      'spotify', 'soundcloud', 'website', 'other'
    )),
  constraint profile_social_links_unique unique (profile_id, platform, url)
);

create index if not exists profile_social_links_profile_id_idx
  on public.profile_social_links (profile_id);

create index if not exists profile_social_links_visible_sort_idx
  on public.profile_social_links (profile_id, is_visible, sort_order);

alter table public.profiles enable row level security;
alter table public.profile_social_links enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Public profiles are viewable'
  ) then
    create policy "Public profiles are viewable"
      on public.profiles
      for select
      using (is_public = true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_social_links'
      and policyname = 'Visible profile social links are viewable'
  ) then
    create policy "Visible profile social links are viewable"
      on public.profile_social_links
      for select
      using (
        is_visible = true
        and exists (
          select 1
          from public.profiles
          where profiles.id = profile_social_links.profile_id
            and profiles.is_public = true
        )
      );
  end if;
end $$;

revoke select on public.profiles from anon, authenticated;
revoke select on public.profile_social_links from anon, authenticated;

grant select (
  id,
  username,
  display_name,
  bio,
  avatar_url,
  website_url,
  is_public
) on public.profiles to anon, authenticated;

grant select (
  id,
  profile_id,
  platform,
  label,
  url,
  sort_order,
  is_visible,
  created_at
) on public.profile_social_links to anon, authenticated;
