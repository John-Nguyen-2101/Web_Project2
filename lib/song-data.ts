import { readFile } from "fs/promises";
import path from "path";
import vm from "vm";

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
  lines: ParsedSongLine[];
};

type RawSong = Omit<ParsedSong, "lines"> & {
  lines?: ParsedSongLine[];
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

export async function getSongById(songId: string) {
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
