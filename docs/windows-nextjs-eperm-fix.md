# Windows Next.js EPERM Fix

On Windows, especially when the project is inside OneDrive, Next.js can fail to start if a previous dev server, file sync, antivirus scan, or editor process keeps `.next/trace` locked.

The safe local fix is:

```bash
npm run clean:next
npm run dev
```

Or run both steps together:

```bash
npm run dev:clean
```

Before deleting `.next`, stop any existing dev server for this project. The `.next` folder is a generated cache and can be recreated by Next.js. Do not delete project source folders, `Data`, `public`, Supabase scripts, or environment files.

This is a local development cleanup only. It does not change routes, Supabase reads, imports, database state, or production application logic.
