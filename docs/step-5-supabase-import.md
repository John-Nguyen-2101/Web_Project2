# Step 5 Supabase Song Import

Step 5 imports only trusted local migration output into Supabase. It does not connect the frontend to Supabase and does not import non-production sample songs.

## Inputs

- `migration-output/songs.json`
- `migration-output/song_versions.json`
- `migration-output/validation_report.json` for safety validation

The current trusted output contains `Ngayxuanlpxv` only.

## Environment

Create a local `.env` file. This file is ignored by Git.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_IMPORT_USER_ID=your-user-or-profile-id
```

Use `SUPABASE_SERVICE_ROLE_KEY` only in local scripts or server-only code. Never expose it in client-side code.

`SUPABASE_IMPORT_USER_ID` is required because the trusted migration output does not contain ownership fields. The importer uses it for `songs.uploaded_by` and `song_versions.created_by`.

## Import Command

Dry-run first:

```bash
npm run import:songs:dry-run
```

The dry-run validates env vars and trusted migration output, prints the final payload shape, and makes no Supabase network request.

Real import, only after approval:

```bash
npm run import:songs
```

The importer:

- validates required environment variables
- validates that migration output is trusted and import-eligible
- upserts `songs` by `legacy_song_id`
- upserts `song_versions` by `song_id,version_number`
- updates `songs.current_version_id` after version rows exist
- prints a JSON summary

## Safe Retry

The import is designed to be repeatable. Re-running the command should update the same rows because the stable keys are:

- `songs.legacy_song_id`
- `song_versions.song_id + version_number`

If an import needs to be rolled back, delete only rows tied to the trusted imported `songs.legacy_song_id` values, starting with child rows in `song_versions`, then parent rows in `songs`. Do not run destructive SQL without first reviewing the exact row set.

## Verification

In Supabase Table Editor or SQL Editor, verify:

```sql
select id, legacy_song_id, title, current_version_id
from songs
where legacy_song_id = 'Ngayxuanlpxv';
```

```sql
select id, song_id, version_number, version_name, is_primary
from song_versions
where song_id = (
  select id from songs where legacy_song_id = 'Ngayxuanlpxv'
)
order by version_number;
```
