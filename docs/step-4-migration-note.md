# Step 4 Migration Note

`Ngayxuanlpxv` is the golden parser fixture for Step 4.

The other current song files are temporary/non-production samples. They are still parsed so the migration utility stays tolerant of older or dirty quickText, but they are not trusted import data and their warnings do not block Step 4.

Use this command for Step 4 refinement:

```bash
npm run migrate:songs:trusted
```

The trusted baseline should preserve the musical structure from `Data/songs/song-Ngayxuanlpxv.js`:

- 3 sections
- 32 bars
- 4 cells per bar
- inline chords, including `[G]` in bar 31
- empty timing cells
- grouped lyric cells originally written with braces

