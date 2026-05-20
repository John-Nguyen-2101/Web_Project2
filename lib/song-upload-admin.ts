const SONG_CONTENT_FORMAT = "lufe.song_content.v1";

export type SongUploadValues = {
  title: string;
  authorName: string;
  style: string;
  rhythm: string;
  timeSigTop: number;
  timeSigBottom: number;
  quickText: string;
  slug: string;
  legacySongId: string;
};

export type SongUploadIssue = {
  code: string;
  message: string;
  lineNumber: number | null;
  sourceLine: string | null;
};

export type SongUploadContent = {
  format: string;
  source: {
    type: "quickText";
    raw: string;
  };
  meter: {
    time_signature: {
      top: number;
      bottom: number;
    };
    meter_mode: string | null;
    cells_per_bar: number;
    cell_unit: string;
    beat_map: number[];
    beat_groups: number[];
    count_labels: string[];
  };
  sections: Array<{
    id: string;
    label: string;
    order: number;
    bars: Array<{
      bar_index: number;
      source_line: string;
      cells: Array<{
        cell_index: number;
        beat_index: number;
        lyric: string;
        lyric_grouped: boolean;
        chord: {
          basic: string | null;
          advanced: string | null;
          lookup_key_basic: string | null;
          lookup_key_advanced: string | null;
          source: string;
        } | null;
      }>;
    }>;
  }>;
};

export type SongUploadPreview = {
  content: SongUploadContent;
  warnings: SongUploadIssue[];
  errors: SongUploadIssue[];
  stats: {
    sections: number;
    bars: number;
    cells: number;
    chords: number;
  };
};

type SupabaseSongRow = {
  id: string;
  legacy_song_id: string;
  slug: string;
  title: string;
};

type SupabaseSongVersionRow = {
  id: string;
  song_id: string;
  version_number: number;
  is_current: boolean;
};

function slugify(value: string, fallback = "song") {
  return (
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || fallback
  );
}

function issue(
  code: string,
  message: string,
  lineNumber: number | null,
  sourceLine: string | null,
): SongUploadIssue {
  return { code, message, lineNumber, sourceLine };
}

function getMeterConfig(values: SongUploadValues) {
  const top = Number(values.timeSigTop || 4);
  const bottom = Number(values.timeSigBottom || 4);

  const presets: Record<
    string,
    {
      cellsPerBar: number;
      beatGroups: number[];
      beatMap: number[];
      countLabels: string[];
    }
  > = {
    "2/4": {
      cellsPerBar: 4,
      beatGroups: [2, 2],
      beatMap: [1, 1, 2, 2],
      countLabels: ["1", "&", "2", "&"],
    },
    "3/4": {
      cellsPerBar: 3,
      beatGroups: [1, 1, 1],
      beatMap: [1, 2, 3],
      countLabels: ["1", "2", "3"],
    },
    "4/4": {
      cellsPerBar: 4,
      beatGroups: [1, 1, 1, 1],
      beatMap: [1, 2, 3, 4],
      countLabels: ["1", "2", "3", "4"],
    },
    "6/8": {
      cellsPerBar: 6,
      beatGroups: [3, 3],
      beatMap: [1, 1, 1, 2, 2, 2],
      countLabels: ["1", "tri", "let", "2", "tri", "let"],
    },
  };

  const preset = presets[`${top}/${bottom}`];
  const fallback = {
    cellsPerBar: top,
    beatGroups: Array.from({ length: top }, () => 1),
    beatMap: Array.from({ length: top }, (_, index) => index + 1),
    countLabels: Array.from({ length: top }, (_, index) => String(index + 1)),
  };
  const config = preset || fallback;
  const cellUnit =
    bottom === 8 ? "eighth" : bottom === 4 ? "quarter" : `1/${bottom}`;

  return {
    ...config,
    top,
    bottom,
    cellUnit,
    usedFallback: !preset,
  };
}

function normalizeChordName(value: string) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function parseChordMarker(
  markerSource: string,
  lineNumber: number,
  sourceLine: string,
  warnings: SongUploadIssue[],
) {
  const marker = String(markerSource || "");
  const inner = marker.replace(/^\[/, "").replace(/\]$/, "").trim();

  if (!inner) {
    warnings.push(
      issue("empty_chord_marker", "Empty chord marker parsed as no chord.", lineNumber, sourceLine),
    );
    return null;
  }

  const pipeIndex = inner.indexOf("|");
  const basic = normalizeChordName(
    pipeIndex === -1 ? inner : inner.slice(0, pipeIndex),
  );
  const advanced = normalizeChordName(
    pipeIndex === -1 ? "" : inner.slice(pipeIndex + 1),
  );

  return {
    basic,
    advanced,
    lookup_key_basic: basic,
    lookup_key_advanced: advanced,
    source: marker,
  };
}

function parseLyric(rawLyric: string) {
  const trimmed = String(rawLyric || "").trim();
  const grouped = trimmed.match(/^\{([\s\S]*)\}$/);

  if (!grouped) {
    return { lyric: trimmed, lyric_grouped: false };
  }

  return { lyric: grouped[1].trim(), lyric_grouped: true };
}

function parseCell(
  cellRaw: string,
  cellIndex: number,
  meter: ReturnType<typeof getMeterConfig>,
  lineNumber: number,
  sourceLine: string,
  warnings: SongUploadIssue[],
  errors: SongUploadIssue[],
) {
  const raw = String(cellRaw || "").trim();
  const match = raw.match(/^(\[[^\]]*\])\s*(.*)$/);

  if (raw.startsWith("[") && !match) {
    errors.push(
      issue("unterminated_chord_marker", "Cell starts with a chord marker but has no closing bracket.", lineNumber, sourceLine),
    );
  }

  const chord = match
    ? parseChordMarker(match[1], lineNumber, sourceLine, warnings)
    : null;
  const lyric = parseLyric(match ? match[2] : raw);

  return {
    cell_index: cellIndex + 1,
    beat_index: meter.beatMap[cellIndex] || 1,
    lyric: lyric.lyric,
    lyric_grouped: lyric.lyric_grouped,
    chord,
  };
}

function parseBarLine(
  rawLine: string,
  lineNumber: number,
  meter: ReturnType<typeof getMeterConfig>,
  warnings: SongUploadIssue[],
  errors: SongUploadIssue[],
) {
  const cellTexts = String(rawLine)
    .split("/")
    .map((part) => part.trim());

  if (cellTexts.length > meter.cellsPerBar) {
    errors.push(
      issue(
        "too_many_cells_for_meter",
        `Bar has ${cellTexts.length} cells but meter allows ${meter.cellsPerBar}.`,
        lineNumber,
        rawLine,
      ),
    );
  }

  while (cellTexts.length < meter.cellsPerBar) {
    cellTexts.push("");
  }

  return {
    source_line: rawLine,
    cells: cellTexts
      .slice(0, meter.cellsPerBar)
      .map((cell, index) =>
        parseCell(cell, index, meter, lineNumber, rawLine, warnings, errors),
      ),
  };
}

export function parseQuickTextForUpload(
  values: SongUploadValues,
): SongUploadPreview {
  const warnings: SongUploadIssue[] = [];
  const errors: SongUploadIssue[] = [];
  const meter = getMeterConfig(values);
  const sections: SongUploadContent["sections"] = [];
  const sectionCounts: Record<string, number> = {};
  let currentSection: SongUploadContent["sections"][number] | null = null;
  let barIndex = 0;

  if (!values.title.trim()) {
    errors.push(issue("missing_title", "Title is required.", null, null));
  }

  if (!values.authorName.trim()) {
    errors.push(issue("missing_author", "Author name is required.", null, null));
  }

  if (!values.quickText.trim()) {
    errors.push(issue("missing_quick_text", "quickText content is required.", null, null));
  }

  if (meter.usedFallback) {
    warnings.push(
      issue(
        "meter_fallback_used",
        `No explicit preset for ${meter.top}/${meter.bottom}; fallback grid was used.`,
        null,
        null,
      ),
    );
  }

  values.quickText.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    const rawLine = line.trim();

    if (!rawLine || rawLine.startsWith("//")) {
      return;
    }

    const sectionMatch = rawLine.match(/^\[(.+?)\]$/);
    if (sectionMatch) {
      const label = sectionMatch[1].trim();
      const baseId = slugify(label, "section");
      sectionCounts[baseId] = (sectionCounts[baseId] || 0) + 1;
      const count = sectionCounts[baseId];

      currentSection = {
        id: count === 1 ? baseId : `${baseId}-${count}`,
        label,
        order: sections.length + 1,
        bars: [],
      };
      sections.push(currentSection);
      return;
    }

    if (!currentSection) {
      currentSection = {
        id: "intro",
        label: "Intro",
        order: sections.length + 1,
        bars: [],
      };
      sections.push(currentSection);
      warnings.push(
        issue(
          "implicit_intro_section",
          "Bar appeared before any section header; created Intro section.",
          lineNumber,
          rawLine,
        ),
      );
    }

    barIndex += 1;
    currentSection.bars.push({
      bar_index: barIndex,
      ...parseBarLine(rawLine, lineNumber, meter, warnings, errors),
    });
  });

  if (!sections.length) {
    errors.push(issue("no_sections_found", "No sections or bars were parsed from quickText.", null, null));
  }

  const content: SongUploadContent = {
    format: SONG_CONTENT_FORMAT,
    source: {
      type: "quickText",
      raw: values.quickText,
    },
    meter: {
      time_signature: {
        top: meter.top,
        bottom: meter.bottom,
      },
      meter_mode: values.rhythm.trim() || null,
      cells_per_bar: meter.cellsPerBar,
      cell_unit: meter.cellUnit,
      beat_map: meter.beatMap,
      beat_groups: meter.beatGroups,
      count_labels: meter.countLabels,
    },
    sections,
  };

  return {
    content,
    warnings,
    errors,
    stats: countStats(content),
  };
}

function countStats(content: SongUploadContent) {
  let bars = 0;
  let cells = 0;
  let chords = 0;

  for (const section of content.sections) {
    for (const bar of section.bars) {
      bars += 1;
      cells += bar.cells.length;
      chords += bar.cells.filter(
        (cell) => cell.chord && (cell.chord.basic || cell.chord.advanced),
      ).length;
    }
  }

  return {
    sections: content.sections.length,
    bars,
    cells,
    chords,
  };
}

function getSupabaseAdminConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const importUserId = process.env.SUPABASE_IMPORT_USER_ID || "";
  const missing = [];

  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!importUserId) missing.push("SUPABASE_IMPORT_USER_ID");

  if (missing.length) {
    throw new Error(`Missing Supabase admin variable(s): ${missing.join(", ")}`);
  }

  return {
    url: url.replace(/\/+$/, ""),
    serviceRoleKey,
    importUserId,
  };
}

async function supabaseAdminRequest<T>(
  pathname: string,
  options: {
    method?: string;
    query?: Record<string, string>;
    prefer?: string;
    body?: unknown;
  } = {},
) {
  const config = getSupabaseAdminConfig();
  const url = new URL(`${config.url}/rest/v1/${pathname}`);

  for (const [key, value] of Object.entries(options.query || {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? String(data.message)
        : text || response.statusText;

    throw new Error(`Supabase admin ${options.method || "GET"} ${pathname} failed: ${message}`);
  }

  return data as T;
}

export async function saveUploadedSong(values: SongUploadValues) {
  const preview = parseQuickTextForUpload(values);

  if (preview.errors.length) {
    return { preview, song: null, version: null };
  }

  const config = getSupabaseAdminConfig();
  const now = new Date().toISOString();
  const legacySongId =
    values.legacySongId.trim() ||
    slugify(values.slug || values.title, "song");
  const slug = slugify(values.slug || legacySongId || values.title, legacySongId);
  const songRows = await supabaseAdminRequest<SupabaseSongRow[]>("songs", {
    method: "POST",
    query: { on_conflict: "legacy_song_id" },
    prefer: "resolution=merge-duplicates,return=representation",
    body: [
      {
        legacy_song_id: legacySongId,
        slug,
        title: values.title.trim(),
        author_name: values.authorName.trim(),
        style: values.style.trim() || null,
        recommended_tempo_text: values.rhythm.trim() || null,
        bpm: null,
        time_sig_top: values.timeSigTop,
        time_sig_bottom: values.timeSigBottom,
        meter_mode: values.rhythm.trim() || null,
        uploaded_by: config.importUserId,
        status: "published",
        visibility: "public",
        current_version_id: null,
        updated_at: now,
      },
    ],
  });
  const song = songRows[0];

  if (!song) {
    throw new Error("Supabase did not return an upserted song row.");
  }

  await supabaseAdminRequest<SupabaseSongVersionRow[]>(
    `song_versions?song_id=eq.${encodeURIComponent(song.id)}&is_current=eq.true`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        is_current: false,
      },
    },
  );

  const versionRows = await supabaseAdminRequest<SupabaseSongVersionRow[]>(
    "song_versions",
    {
      method: "POST",
      query: { on_conflict: "song_id,version_number" },
      prefer: "resolution=merge-duplicates,return=representation",
      body: [
        {
          song_id: song.id,
          version_number: 1,
          content_json: preview.content,
          quick_text_legacy: values.quickText,
          change_summary: "Uploaded from admin quickText portal",
          created_by: config.importUserId,
          is_current: true,
          created_at: now,
        },
      ],
    },
  );
  const version = versionRows[0];

  if (!version) {
    throw new Error("Supabase did not return an upserted song version row.");
  }

  await supabaseAdminRequest<SupabaseSongRow[]>(
    `songs?id=eq.${encodeURIComponent(song.id)}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        current_version_id: version.id,
        updated_at: now,
      },
    },
  );

  return { preview, song, version };
}

export function valuesFromFormData(formData: FormData): SongUploadValues {
  const timeSignature = String(formData.get("timeSignature") || "4/4");
  const [topRaw, bottomRaw] = timeSignature.split("/");

  return {
    title: String(formData.get("title") || ""),
    authorName: String(formData.get("authorName") || ""),
    style: String(formData.get("style") || ""),
    rhythm: String(formData.get("rhythm") || ""),
    timeSigTop: Number(topRaw) || 4,
    timeSigBottom: Number(bottomRaw) || 4,
    quickText: String(formData.get("quickText") || ""),
    slug: String(formData.get("slug") || ""),
    legacySongId: String(formData.get("legacySongId") || ""),
  };
}
