import { readFile } from "fs/promises";
import path from "path";
import vm from "vm";

import type { BlogPost, SiteData, SongListItem } from "@/lib/site-shared";

const projectRoot = process.cwd();

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

export async function getSongList() {
  const filePath = resolveProjectFile("Data", "song-list.js");
  const source = await readFile(filePath, "utf8");
  const context = { window: {} as { SONG_LIST?: SongListItem[] } };

  vm.runInNewContext(source, context, { filename: filePath });

  return Array.isArray(context.window.SONG_LIST) ? context.window.SONG_LIST : [];
}
