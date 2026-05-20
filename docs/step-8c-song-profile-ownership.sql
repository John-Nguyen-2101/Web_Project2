-- Step 8C song/profile ownership bridge.
-- Review before running. This does not delete or rewrite song content.
--
-- Goal:
-- - Add a nullable public.songs.profile_id owner reference.
-- - Backfill existing songs to the temporary public profile username 'lufe'.
-- - Expose only the new public-safe owner column needed for profile song lists.

alter table public.songs
  add column if not exists profile_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'songs_profile_id_fkey'
      and conrelid = 'public.songs'::regclass
  ) then
    alter table public.songs
      add constraint songs_profile_id_fkey
      foreign key (profile_id)
      references public.profiles(id)
      on delete set null;
  end if;
end $$;

create index if not exists songs_profile_id_idx
  on public.songs (profile_id);

update public.songs
set profile_id = profiles.id,
    updated_at = now()
from public.profiles
where profiles.username = 'lufe'
  and profiles.is_public = true
  and public.songs.profile_id is null;

grant select (profile_id) on public.songs to anon, authenticated;
