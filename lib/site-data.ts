import { readFile } from "fs/promises";
import path from "path";
import vm from "vm";

import type { BlogPost, SiteData, SongListItem } from "@/lib/site-shared";
import { supabaseRead } from "@/lib/supabase-server";

const projectRoot = process.cwd();

type SupabaseSongListRow = {
  id: string;
  legacy_song_id: string | null;
  slug: string | null;
  title: string | null;
  author_name: string | null;
  style: string | null;
  recommended_tempo_text: string | null;
  bpm: number | null;
  time_sig_top: number | null;
  time_sig_bottom: number | null;
  meter_mode: string | null;
  view_count: number | null;
  created_at: string | null;
  updated_at: string | null;
};

function resolveProjectFile(...segments: string[]) {
  return path.join(projectRoot, ...segments);
}

async function readProjectJson<T>(...segments: string[]) {
  const filePath = resolveProjectFile(...segments);
  const fileContents = await readFile(filePath, "utf8");
  return JSON.parse(fileContents) as T;
}

export async function getSiteData() {
  return readProjectJson<SiteData>("Data", "data.json");
}

export async function getPosts() {
  return readProjectJson<BlogPost[]>("Data", "posts.json");
}

export async function getPostBySlug(slug: string) {
  const posts = await getPosts();
  return posts.find((post) => post.slug === slug) ?? null;
}

async function getLocalSongList() {
  const filePath = resolveProjectFile("Data", "song-list.js");
  const source = await readFile(filePath, "utf8");
  const context = { window: {} as { SONG_LIST?: SongListItem[] } };

  vm.runInNewContext(source, context, { filename: filePath });

  return Array.isArray(context.window.SONG_LIST) ? context.window.SONG_LIST : [];
}

function toSongListItem(row: SupabaseSongListRow): SongListItem {
  const identifier = row.slug || row.legacy_song_id || row.id;
  const top = row.time_sig_top || 4;
  const bottom = row.time_sig_bottom || 4;

  return {
    id: identifier,
    title: row.title || "Untitled song",
    author: row.author_name || "",
    style: row.style || undefined,
    rhythm: row.meter_mode || row.recommended_tempo_text || undefined,
    bpm: row.bpm || 80,
    timeSig: `${top}/${bottom}`,
    views: row.view_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getSupabaseSongList() {
  const rows = await supabaseRead<SupabaseSongListRow[]>("songs", {
    query: {
      select:
        "id,legacy_song_id,slug,title,author_name,style,recommended_tempo_text,bpm,time_sig_top,time_sig_bottom,meter_mode,view_count,created_at,updated_at",
      status: "eq.published",
      visibility: "eq.public",
      order: "updated_at.desc.nullslast,title.asc",
    },
  });

  return rows.map(toSongListItem);
}

function getSongListDedupeKey(song: SongListItem) {
  return song.id.toLowerCase();
}

function mergeSongLists(
  supabaseSongs: SongListItem[],
  localSongs: SongListItem[],
) {
  const seen = new Set(supabaseSongs.map(getSongListDedupeKey));
  const merged = [...supabaseSongs];

  for (const song of localSongs) {
    const key = getSongListDedupeKey(song);

    if (!seen.has(key)) {
      merged.push(song);
      seen.add(key);
    }
  }

  return merged;
}

export async function getSongList() {
  try {
    const [supabaseSongs, localSongs] = await Promise.all([
      getSupabaseSongList(),
      getLocalSongList(),
    ]);

    if (supabaseSongs.length) {
      return mergeSongLists(supabaseSongs, localSongs);
    }
  } catch (error) {
    console.warn(
      "Supabase song list read failed; falling back to local song-list.js.",
      error,
    );
  }

  return getLocalSongList();
}
