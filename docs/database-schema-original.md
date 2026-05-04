Step 3: Final Consolidated Supabase Schema

This is the final Step 3 schema design for the project.No code changes, no Supabase connection, no UI implementation yet.

It covers:

songs

song versioning

uploader identity via auth.users

public user profiles + social links

blog posts + tags

future comments, likes, ratings

1. Design Principles

Primary choices

Use auth.users as the source of identity

Use profiles as the public-facing user table

Store song metadata in songs

Store structured chord/lyric content in song_versions.content_json

Keep quick_text_legacy during migration

Store blog content as content_html now

Keep comments/likes/ratings in separate tables later

Why

current app already has rich song metadata

future upload-song UI needs structured beat/cell data

versioning is important for editing songs safely

current blog content is already HTML, so migration should stay simple first

2. Main Relationships

auth.users
  -> profiles (1:1)

profiles
  -> profile_social_links (1:many)
  -> songs.uploaded_by (1:many)
  -> blog_posts.author_id (1:many)

songs
  -> song_versions (1:many)
  -> current_version_id -> song_versions.id (1:1 current pointer)

blog_posts
  -> blog_post_tags (1:many)
  -> blog_tags through blog_post_tags

future:
songs
  -> song_comments
  -> song_likes
  -> song_ratings

3. Profiles

profiles

Public profile for each auth user.

Columns

id uuid primary key

username text unique

display_name text

bio text

avatar_url text

location text

website_url text

is_public boolean not null default true

created_at timestamptz not null default now()

updated_at timestamptz not null default now()

FK

id references auth.users(id) on delete cascade

Indexes

unique on username

index on is_public

SQL

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  bio text,
  avatar_url text,
  location text,
  website_url text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_is_public_idx on public.profiles (is_public);

profile_social_links

Public social/platform links for profiles.

Columns

id uuid primary key default gen_random_uuid()

profile_id uuid not null

platform text not null

label text

url text not null

sort_order integer not null default 0

is_visible boolean not null default true

created_at timestamptz not null default now()

FK

profile_id references profiles(id) on delete cascade

Constraints

platform in:

youtube

tiktok

instagram

facebook

spotify

soundcloud

website

other

unique (profile_id, platform, url)

Indexes

index on profile_id

index on (profile_id, is_visible, sort_order)

SQL

create table public.profile_social_links (
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

create index profile_social_links_profile_id_idx
  on public.profile_social_links (profile_id);

create index profile_social_links_visible_sort_idx
  on public.profile_social_links (profile_id, is_visible, sort_order);

How uploader info displays

songs.uploaded_by -> profiles.id

then fetch profiles.display_name, avatar_url, bio

then fetch profile_social_links for public profile/social display

4. Songs

songs

Song-level metadata and ownership.

Columns

id uuid primary key default gen_random_uuid()

legacy_song_id text unique

slug text unique

title text not null

author_name text not null

style text

recommended_tempo_text text

bpm integer not null

time_sig_top integer not null

time_sig_bottom integer not null

meter_mode text

song_key text

scale text

uploaded_by uuid not null

status text not null default 'published'

visibility text not null default 'public'

current_version_id uuid

view_count integer not null default 0

like_count integer not null default 0

comment_count integer not null default 0

rating_avg numeric(3,2)

rating_count integer not null default 0

created_at timestamptz not null default now()

updated_at timestamptz not null default now()

published_at timestamptz

FK

uploaded_by references profiles(id) on delete restrict

Constraints

bpm > 0

time_sig_top > 0

time_sig_bottom > 0

status in draft, published, archived

visibility in public, unlisted, private

Indexes

unique on slug

unique on legacy_song_id

index on uploaded_by

index on (status, visibility)

index on title

index on author_name

SQL

create table public.songs (
  id uuid primary key default gen_random_uuid(),
  legacy_song_id text unique,
  slug text unique,
  title text not null,
  author_name text not null,
  style text,
  recommended_tempo_text text,
  bpm integer not null check (bpm > 0),
  time_sig_top integer not null check (time_sig_top > 0),
  time_sig_bottom integer not null check (time_sig_bottom > 0),
  meter_mode text,
  song_key text,
  scale text,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  visibility text not null default 'public'
    check (visibility in ('public', 'unlisted', 'private')),
  current_version_id uuid,
  view_count integer not null default 0,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  rating_avg numeric(3,2),
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index songs_uploaded_by_idx on public.songs (uploaded_by);
create index songs_status_visibility_idx on public.songs (status, visibility);
create index songs_title_idx on public.songs (title);
create index songs_author_name_idx on public.songs (author_name);

5. Song Versioning

song_versions

Versioned song content.

Columns

id uuid primary key default gen_random_uuid()

song_id uuid not null

version_number integer not null

content_json jsonb not null

quick_text_legacy text

change_summary text

created_by uuid not null

is_current boolean not null default false

created_at timestamptz not null default now()

FK

song_id references songs(id) on delete cascade

created_by references profiles(id) on delete restrict

Constraints

unique (song_id, version_number)

only one current version per song

Indexes

unique partial index on (song_id) where is_current = true

index on song_id

index on created_by

gin index on content_json

SQL

create table public.song_versions (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  version_number integer not null,
  content_json jsonb not null,
  quick_text_legacy text,
  change_summary text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  constraint song_versions_song_id_version_number_unique
    unique (song_id, version_number)
);

create unique index song_versions_one_current_idx
  on public.song_versions (song_id)
  where is_current = true;

create index song_versions_song_id_idx on public.song_versions (song_id);
create index song_versions_created_by_idx on public.song_versions (created_by);
create index song_versions_content_json_gin_idx
  on public.song_versions using gin (content_json);

Then add current-version pointer:

alter table public.songs
add constraint songs_current_version_id_fkey
foreign key (current_version_id)
references public.song_versions(id)
on delete set null;

6. Song Content JSON Model

Use content_json as primary storage.

Recommended shape

{
  "schema_version": 1,
  "time_signature": {
    "top": 4,
    "bottom": 4
  },
  "meter_mode": "simple",
  "layout": {
    "cells_per_bar": 4,
    "cell_to_beat_map": [1, 2, 3, 4]
  },
  "sections": [
    {
      "id": "verse1",
      "label": "Verse",
      "blocks": [
        {
          "type": "bar_line",
          "cells": [
            {
              "beat_index": 1,
              "lyric": "May",
              "chord_basic": "C",
              "chord_adv": null
            },
            {
              "beat_index": 2,
              "lyric": "mắn",
              "chord_basic": null,
              "chord_adv": null
            },
            {
              "beat_index": 3,
              "lyric": "cả",
              "chord_basic": null,
              "chord_adv": null
            },
            {
              "beat_index": 4,
              "lyric": "đời",
              "chord_basic": null,
              "chord_adv": null
            }
          ]
        }
      ]
    }
  ]
}

Why this worksSupports:

section titles like [Verse]

chords

basic vs advanced chords

lyrics per beat

empty beats

transpose

playback

2/4, 3/4, 4/4, 6/8

future visual beat-box upload editor

QuickText decision

content_json = source of truth

quick_text_legacy = compatibility fallback during migration

7. Blog Posts

blog_posts

Store blog content in DB instead of local JSON.

Columns

id uuid primary key default gen_random_uuid()

legacy_post_id integer unique

slug text not null unique

title text not null

excerpt text

cover_image_url text

content_html text not null

content_json jsonb

author_id uuid not null

status text not null default 'draft'

published_at timestamptz

created_at timestamptz not null default now()

updated_at timestamptz not null default now()

FK

author_id references profiles(id) on delete restrict

Constraints

status in draft, published, archived

Indexes

unique on slug

index on author_id

index on status

index on published_at desc

SQL

create table public.blog_posts (
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

create index blog_posts_author_id_idx on public.blog_posts (author_id);
create index blog_posts_status_idx on public.blog_posts (status);
create index blog_posts_published_at_idx on public.blog_posts (published_at desc);

Content recommendation

keep content_html as primary for now

optionally support content_json later for rich-text editor migration

blog_tags

Reusable blog tags.

Columns

id uuid primary key default gen_random_uuid()

slug text not null unique

name text not null unique

created_at timestamptz not null default now()

SQL

create table public.blog_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  created_at timestamptz not null default now()
);

blog_post_tags

Join table between posts and tags.

Columns

post_id uuid not null

tag_id uuid not null

PK

(post_id, tag_id)

FK

post_id references blog_posts(id) on delete cascade

tag_id references blog_tags(id) on delete cascade

Indexes

index on tag_id

SQL

create table public.blog_post_tags (
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  tag_id uuid not null references public.blog_tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

create index blog_post_tags_tag_id_idx on public.blog_post_tags (tag_id);

8. Future Tables

These should be separate from songs.

song_comments

create table public.song_comments (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid references public.song_comments(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index song_comments_song_id_idx on public.song_comments (song_id);
create index song_comments_user_id_idx on public.song_comments (user_id);
create index song_comments_parent_comment_id_idx on public.song_comments (parent_comment_id);

song_likes

create table public.song_likes (
  song_id uuid not null references public.songs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (song_id, user_id)
);

create index song_likes_user_id_idx on public.song_likes (user_id);

song_ratings

create table public.song_ratings (
  song_id uuid not null references public.songs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (song_id, user_id)
);

create index song_ratings_user_id_idx on public.song_ratings (user_id);

9. Mapping Current Local Data

Current SONG_DATA -> schema

From current local song JS:

id -> songs.legacy_song_id

title -> songs.title

author -> songs.author_name

style -> songs.style

recommendedTempo -> songs.recommended_tempo_text

bpm -> songs.bpm

timeSigTop -> songs.time_sig_top

timeSigBottom -> songs.time_sig_bottom

meterMode -> songs.meter_mode

key -> songs.song_key

scale -> songs.scale

quickText -> song_versions.quick_text_legacy

parsed quickText -> song_versions.content_json

Current song-list.js

views -> songs.view_count

Current posts.json -> schema

id -> blog_posts.legacy_post_id

slug -> blog_posts.slug

title -> blog_posts.title

desc -> blog_posts.excerpt

date -> blog_posts.published_at

tag -> blog_tags.name + blog_post_tags

cover -> blog_posts.cover_image_url

content -> blog_posts.content_html

10. Migration Notes / Risks

current songs have no uploader field

initial migration should assign a default admin profile

current blog dates are strings like 20-02-2026

convert to proper timestamp during import

current blog covers are relative paths

normalize later to local public paths or storage URLs

quickText should not remain primary long-term

keep only as compatibility fallback

songs.current_version_id and song_versions.is_current are intentionally both present

easier reads + safer auditing

comments/likes/ratings should never be embedded in songs

11. Recommended Final Strategy

Use this schema:

profiles

profile_social_links

songs

song_versions

blog_posts

blog_tags

blog_post_tags

Future:

song_comments

song_likes

song_ratings

Final storage policy

song metadata -> songs

structured chord/lyrics -> song_versions.content_json

quickText fallback -> song_versions.quick_text_legacy

blog body now -> blog_posts.content_html

blog rich-text later -> optional blog_posts.content_json

If you want, the next step can be Step 4: data import design, where I map each current local file into seed-ready rows for these tables without importing anything yet.