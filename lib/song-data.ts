import { readFile } from "fs/promises";
import path from "path";
import vm from "vm";

import { getProfileById } from "@/lib/profile-data";
import { supabaseRead } from "@/lib/supabase-server";
import type { ContentOwnerProfile } from "@/lib/site-shared";

export type SongLineToken = {
  lyric: string;
  chord?: string | null;
  chordBasic?: string | null;
  chordAdv?: string | null;
  beatIndex: number;
};

export type SongSectionLine = {
  section: string;
  id: string;
};

export type SongTokenLine = {
  tokens: SongLineToken[];
};

export type ParsedSongLine = SongSectionLine | SongTokenLine;

export type SongLayout = {
  cellsPerBar?: number;
  strongCells?: number[];
  cellLabels?: string[];
  cellToBeatMap?: number[];
};

export type ParsedSong = {
  id: string;
  title: string;
  author: string;
  style: string;
  recommendedTempo: string;
  bpm: number;
  timeSigTop: number;
  timeSigBottom: number;
  meterMode?: string;
  key?: string;
  tone?: string;
  scale?: string;
  quickText?: string;
  layout?: SongLayout;
  uploaderProfile?: ContentOwnerProfile;
  lines: ParsedSongLine[];
};

type RawSong = Omit<ParsedSong, "lines"> & {
  lines?: ParsedSongLine[];
};

type SupabaseSongRow = {
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
  song_key: string | null;
  scale: string | null;
  current_version_id: string | null;
  uploaded_by: string | null;
};

type SupabaseSongVersionRow = {
  id: string;
  song_id: string;
  version_number: number | null;
  content_json: SupabaseSongContent;
  quick_text_legacy: string | null;
  is_current: boolean | null;
};

type SupabaseSongContent = {
  format?: string;
  source?: {
    raw?: string;
  };
  meter?: {
    cells_per_bar?: number;
    strong_cells?: number[];
    cell_labels?: string[];
    cell_to_beat_map?: number[];
    beat_map?: number[];
    count_labels?: string[];
  };
  layout?: {
    cells_per_bar?: number;
    strong_cells?: number[];
    cell_labels?: string[];
    cell_to_beat_map?: number[];
  };
  sections?: Array<{
    id?: string;
    label?: string;
    bars?: Array<{
      cells?: Array<{
        beat_index?: number;
        lyric?: string;
        chord?: {
          basic?: string | null;
          advanced?: string | null;
        } | null;
      }>;
    }>;
  }>;
};

function slugifySection(text: string) {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim() || "section";
}

function parseChordSpec(chordSpecRaw: string) {
  const raw = String(chordSpecRaw || "").trim();
  if (!raw) {
    return { chordBasic: null, chordAdv: null };
  }

  const parts = raw.split("|").map((part) => part.trim());

  return {
    chordBasic: parts[0] || null,
    chordAdv: parts[1] || null,
  };
}

function getBarGridConfig(song: RawSong) {
  const layoutMap = song.layout?.cellToBeatMap;
  const layoutCellsPerBar = song.layout?.cellsPerBar || layoutMap?.length;

  if (layoutCellsPerBar && layoutMap?.length) {
    return {
      cellsPerBar: layoutCellsPerBar,
      cellToBeatMap: layoutMap,
    };
  }

  const top = song?.timeSigTop;
  const bottom = song?.timeSigBottom;

  if (top === 2 && bottom === 4) {
    return {
      cellsPerBar: 4,
      cellToBeatMap: [1, 1, 2, 2],
    };
  }

  if (top === 3 && bottom === 4) {
    return {
      cellsPerBar: 3,
      cellToBeatMap: [1, 2, 3],
    };
  }

  if (top === 4 && bottom === 4) {
    return {
      cellsPerBar: 4,
      cellToBeatMap: [1, 2, 3, 4],
    };
  }

  if (top === 6 && bottom === 8) {
    return {
      cellsPerBar: 6,
      cellToBeatMap: [1, 1, 1, 2, 2, 2],
    };
  }

  return {
    cellsPerBar: top || 4,
    cellToBeatMap: Array.from({ length: top || 4 }, (_, index) => index + 1),
  };
}

function parseInlineCell(cellRaw: string) {
  const raw = String(cellRaw || "").trim();
  if (!raw) {
    return {
      lyric: "",
      chordBasic: null,
      chordAdv: null,
    };
  }

  const match = raw.match(/^\[([^\]]+)\]\s*(.*)$/);

  if (!match) {
    return {
      lyric: raw,
      chordBasic: null,
      chordAdv: null,
    };
  }

  const chordSpec = match[1].trim();
  const lyric = (match[2] || "").trim();
  const { chordBasic, chordAdv } = parseChordSpec(chordSpec);

  return {
    lyric,
    chordBasic,
    chordAdv,
  };
}

function parseBarLine(
  line: string,
  options: {
    cellsPerBar: number;
    cellToBeatMap: number[];
  },
) {
  const { cellsPerBar, cellToBeatMap } = options;

  const cellTexts = String(line)
    .split("/")
    .map((part) => part.trim());

  if (cellTexts.length > cellsPerBar) {
    throw new Error(
      `Bar có ${cellTexts.length} ô lyric nhưng nhịp này chỉ cho ${cellsPerBar} ô: ${line}`,
    );
  }

  while (cellTexts.length < cellsPerBar) {
    cellTexts.push("");
  }

  return {
    tokens: cellTexts.map((cellText, index) => {
      const parsed = parseInlineCell(cellText);

      return {
        lyric: parsed.lyric,
        chordBasic: parsed.chordBasic,
        chordAdv: parsed.chordAdv,
        beatIndex: cellToBeatMap[index] ?? 1,
      };
    }),
  };
}

function parseQuickLines(
  inputText: string,
  options: {
    cellsPerBar: number;
    cellToBeatMap: number[];
  },
) {
  const rawLines = String(inputText || "")
    .split(/\r?\n/)
    .map((line) => line.trim());

  const lines: ParsedSongLine[] = [];
  const sectionCounter: Record<string, number> = {};

  for (const rawLine of rawLines) {
    if (!rawLine || rawLine.startsWith("//")) {
      continue;
    }

    const sectionMatch = rawLine.match(/^\[(.+?)\]$/);
    if (sectionMatch) {
      const sectionName = sectionMatch[1].trim();
      const baseId = slugifySection(sectionName);
      sectionCounter[baseId] = (sectionCounter[baseId] || 0) + 1;
      const count = sectionCounter[baseId];

      lines.push({
        section: sectionName,
        id: count === 1 ? baseId : `${baseId}${count}`,
      });
      continue;
    }

    lines.push(parseBarLine(rawLine, options));
  }

  return lines;
}

function parseSong(rawSong: RawSong): ParsedSong {
  if (rawSong.lines && rawSong.lines.length) {
    return rawSong as ParsedSong;
  }

  const gridConfig = getBarGridConfig(rawSong);

  return {
    ...rawSong,
    lines: parseQuickLines(rawSong.quickText || "", {
      cellsPerBar: gridConfig.cellsPerBar,
      cellToBeatMap: gridConfig.cellToBeatMap,
    }),
  };
}

function linesFromSupabaseContent(content: SupabaseSongContent): ParsedSongLine[] {
  const lines: ParsedSongLine[] = [];

  for (const section of content.sections || []) {
    const sectionLabel = section.label || "Section";

    lines.push({
      section: sectionLabel,
      id: section.id || slugifySection(sectionLabel),
    });

    for (const bar of section.bars || []) {
      lines.push({
        tokens: (bar.cells || []).map((cell) => ({
          lyric: cell.lyric || "",
          chordBasic: cell.chord?.basic || null,
          chordAdv: cell.chord?.advanced || null,
          beatIndex: cell.beat_index || 1,
        })),
      });
    }
  }

  return lines;
}

function layoutFromSupabaseContent(content: SupabaseSongContent): SongLayout | undefined {
  if (content.layout) {
    return {
      cellsPerBar: content.layout.cells_per_bar,
      strongCells: content.layout.strong_cells,
      cellLabels: content.layout.cell_labels,
      cellToBeatMap: content.layout.cell_to_beat_map,
    };
  }

  const layout = content.meter;

  if (!layout) {
    return undefined;
  }

  return {
    cellsPerBar: layout.cells_per_bar,
    strongCells: layout.strong_cells,
    cellLabels: layout.cell_labels || layout.count_labels,
    cellToBeatMap: layout.cell_to_beat_map || layout.beat_map,
  };
}

function supabaseRowsToParsedSong(
  song: SupabaseSongRow,
  version: SupabaseSongVersionRow,
  uploaderProfile?: ContentOwnerProfile,
): ParsedSong | null {
  const content = version.content_json;

  if (!content || content.format !== "lufe.song_content.v1") {
    return null;
  }

  const lines = linesFromSupabaseContent(content);

  if (!lines.length) {
    return null;
  }

  return {
    id: song.legacy_song_id || song.slug || song.id,
    title: song.title || "Untitled song",
    author: song.author_name || "",
    style: song.style || "",
    recommendedTempo: song.recommended_tempo_text || "",
    bpm: song.bpm || 80,
    timeSigTop: song.time_sig_top || 4,
    timeSigBottom: song.time_sig_bottom || 4,
    meterMode: song.meter_mode || undefined,
    key: song.song_key || undefined,
    tone: song.song_key || undefined,
    scale: song.scale || undefined,
    quickText: version.quick_text_legacy || content.source?.raw || undefined,
    layout: layoutFromSupabaseContent(content),
    uploaderProfile,
    lines,
  };
}

async function getSupabaseSongRow(songId: string) {
  const commonQuery = {
    select:
      "id,legacy_song_id,slug,title,author_name,style,recommended_tempo_text,bpm,time_sig_top,time_sig_bottom,meter_mode,song_key,scale,current_version_id,uploaded_by",
    limit: "1",
  };

  const byLegacyId = await supabaseRead<SupabaseSongRow[]>("songs", {
    query: {
      ...commonQuery,
      legacy_song_id: `eq.${songId}`,
    },
  });

  if (byLegacyId[0]) {
    return byLegacyId[0];
  }

  const bySlug = await supabaseRead<SupabaseSongRow[]>("songs", {
    query: {
      ...commonQuery,
      slug: `eq.${songId}`,
    },
  });

  return bySlug[0] || null;
}

async function getSupabaseCurrentVersion(song: SupabaseSongRow) {
  const commonQuery = {
    select:
      "id,song_id,version_number,content_json,quick_text_legacy,is_current",
    limit: "1",
  };

  if (song.current_version_id) {
    const byCurrentId = await supabaseRead<SupabaseSongVersionRow[]>(
      "song_versions",
      {
        query: {
          ...commonQuery,
          id: `eq.${song.current_version_id}`,
        },
      },
    );

    if (byCurrentId[0]) {
      return byCurrentId[0];
    }
  }

  const byCurrentFlag = await supabaseRead<SupabaseSongVersionRow[]>(
    "song_versions",
    {
      query: {
        ...commonQuery,
        song_id: `eq.${song.id}`,
        is_current: "eq.true",
      },
    },
  );

  return byCurrentFlag[0] || null;
}

async function getSongFromSupabase(songId: string) {
  const song = await getSupabaseSongRow(songId);

  if (!song) {
    return null;
  }

  const currentVersion = await getSupabaseCurrentVersion(song);

  if (!currentVersion) {
    return null;
  }

  const uploaderProfile = song.uploaded_by
    ? await getProfileById(song.uploaded_by)
    : null;

  return supabaseRowsToParsedSong(
    song,
    currentVersion,
    uploaderProfile || undefined,
  );
}

async function getSongFromLocalFile(songId: string) {
  try {
    const filePath = path.join(process.cwd(), "Data", "songs", `song-${songId}.js`);
    const source = await readFile(filePath, "utf8");
    const context = { window: {} as { SONG_DATA?: RawSong } };

    vm.runInNewContext(source, context, { filename: filePath });

    if (!context.window.SONG_DATA) {
      return null;
    }

    return parseSong(context.window.SONG_DATA);
  } catch {
    return null;
  }
}

export async function getSongById(songId: string) {
  try {
    const supabaseSong = await getSongFromSupabase(songId);

    if (supabaseSong) {
      return supabaseSong;
    }
  } catch (error) {
    console.warn(
      `Supabase song read failed for ${songId}; falling back to local data.`,
      error,
    );
  }

  return getSongFromLocalFile(songId);
}
