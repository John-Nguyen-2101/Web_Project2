-- Optional Step 7B seed example.
-- Review and edit before running. This is intentionally not wired to any script.
-- Replace the placeholder UUID with the profile/auth user id that should own
-- the imported songs and blog posts, for example SUPABASE_IMPORT_USER_ID.
-- The id must already exist in auth.users when public.profiles(id) references
-- auth.users(id). Run docs/step-7a-profile-foundation.sql first.

insert into public.profiles (
  id,
  username,
  display_name,
  bio,
  avatar_url,
  website_url,
  is_public
) values (
  '00000000-0000-0000-0000-000000000000',
  'lufe',
  'Lufe Audio',
  'Music learning profile for public songs, chords, and blog posts.',
  null,
  null,
  true
)
on conflict (id) do update set
  username = excluded.username,
  display_name = excluded.display_name,
  bio = excluded.bio,
  avatar_url = excluded.avatar_url,
  website_url = excluded.website_url,
  is_public = excluded.is_public,
  updated_at = now();

-- Example visible public links. Edit or remove before running.
insert into public.profile_social_links (
  profile_id,
  platform,
  label,
  url,
  sort_order,
  is_visible
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'youtube',
    'YouTube',
    'https://www.youtube.com/@lufeaudio1526',
    10,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'facebook',
    'Facebook',
    'https://www.facebook.com/guitaristVN/',
    20,
    true
  )
on conflict (profile_id, platform, url) do update set
  label = excluded.label,
  sort_order = excluded.sort_order,
  is_visible = excluded.is_visible;
