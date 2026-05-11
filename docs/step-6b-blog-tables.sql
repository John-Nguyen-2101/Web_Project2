-- Step 6B blog tables only.
-- Safe to run after the Step 3 core schema exists, especially public.profiles.
-- This script intentionally does not touch songs or song_versions.

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  legacy_post_id integer unique,
  slug text not null unique,
  title text not null,
  excerpt text,
  cover_image_url text,
  content_html text not null,
  content_json jsonb,
  author_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_author_id_idx
  on public.blog_posts (author_id);

create index if not exists blog_posts_status_idx
  on public.blog_posts (status);

create index if not exists blog_posts_published_at_idx
  on public.blog_posts (published_at desc);

create table if not exists public.blog_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.blog_post_tags (
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  tag_id uuid not null references public.blog_tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

create index if not exists blog_post_tags_tag_id_idx
  on public.blog_post_tags (tag_id);
