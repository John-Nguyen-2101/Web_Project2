const fs = require("fs");
const path = require("path");
const vm = require("vm");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SONG_SOURCE_DIR = path.join(PROJECT_ROOT, "Data", "songs");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "migration-output");

const FORMAT_VERSION = "lufe.song_content.v1";
const DEFAULT_TRUSTED_SONG_IDS = ["Ngayxuanlpxv"];
const TRUSTED_SONG_IDS = new Set(
  (process.env.TRUSTED_SONG_IDS || DEFAULT_TRUSTED_SONG_IDS.join(","))
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);
const TRUSTED_ONLY = process.argv.includes("--trusted-only");

function slugifySection(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

function readSongData(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const context = { window: {} };

  vm.runInNewContext(source, context, { filename: filePath });

  if (!context.window.SONG_DATA) {
    throw new Error("No window.SONG_DATA found");
  }

  return context.window.SONG_DATA;
}

function getMeterConfig(song) {
  const top = Number(song.timeSigTop || 4);
  const bottom = Number(song.timeSigBottom || 4);

  const preset = {
    "2/4": { cellsPerBar: 4, beatGroups: [2, 2], beatMap: [1, 1, 2, 2], countLabels: ["1", "&", "2", "&"] },
    "3/4": { cellsPerBar: 3, beatGroups: [1, 1, 1], beatMap: [1, 2, 3], countLabels: ["1", "2", "3"] },
    "4/4": { cellsPerBar: 4, beatGroups: [1, 1, 1, 1], beatMap: [1, 2, 3, 4], countLabels: ["1", "2", "3", "4"] },
    "5/8": { cellsPerBar: 5, beatGroups: [2, 3], beatMap: [1, 1, 2, 2, 2], countLabels: ["1", "&", "2", "&", "a"] },
    "6/8": { cellsPerBar: 6, beatGroups: [3, 3], beatMap: [1, 1, 1, 2, 2, 2], countLabels: ["1", "tri", "let", "2", "tri", "let"] },
    "7/8": { cellsPerBar: 7, beatGroups: [2, 2, 3], beatMap: [1, 1, 2, 2, 3, 3, 3], countLabels: ["1", "&", "2", "&", "3", "&", "a"] },
    "9/8": { cellsPerBar: 9, beatGroups: [3, 3, 3], beatMap: [1, 1, 1, 2, 2, 2, 3, 3, 3], countLabels: ["1", "tri", "let", "2", "tri", "let", "3", "tri", "let"] },
    "12/8": { cellsPerBar: 12, beatGroups: [3, 3, 3, 3], beatMap: [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4], countLabels: ["1", "tri", "let", "2", "tri", "let", "3", "tri", "let", "4", "tri", "let"] },
  }[`${top}/${bottom}`];

  const fallback = {
    cellsPerBar: top,
    beatGroups: Array.from({ length: top }, () => 1),
    beatMap: Array.from({ length: top }, (_, index) => index + 1),
    countLabels: Array.from({ length: top }, (_, index) => String(index + 1)),
  };

  const config = preset || fallback;
  const cellUnit = bottom === 8 ? "eighth" : bottom === 4 ? "quarter" : `1/${bottom}`;

  return {
    time_signature: { top, bottom },
    meter_mode: song.meterMode || null,
    cells_per_bar: config.cellsPerBar,
    cell_unit: cellUnit,
    beat_map: config.beatMap,
    beat_groups: config.beatGroups,
    count_labels: config.countLabels,
    used_fallback: !preset,
  };
}

function warning(code, message, lineNumber, sourceLine) {
  return { code, message, line_number: lineNumber, source_line: sourceLine };
}

function error(code, message, lineNumber, sourceLine) {
  return { code, message, line_number: lineNumber, source_line: sourceLine };
}

function normalizeChordName(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function isChordLookupKey(value) {
  if (!value) {
    return true;
  }

  return /^[A-G](?:#|b)?[A-Za-z0-9()/+#b°øΔ\-]*$/.test(value);
}

function parseChordMarker(markerSource, lineNumber, sourceLine, warnings) {
  const marker = String(markerSource || "");
  const inner = marker.replace(/^\[/, "").replace(/\]$/, "").trim();

  if (!inner) {
    warnings.push(warning("empty_chord_marker", "Empty chord marker parsed as no chord.", lineNumber, sourceLine));
    return null;
  }

  const pipeIndex = inner.indexOf("|");
  const basicRaw = pipeIndex === -1 ? inner : inner.slice(0, pipeIndex);
  const advancedRaw = pipeIndex === -1 ? "" : inner.slice(pipeIndex + 1);
  const basic = normalizeChordName(basicRaw);
  const advanced = normalizeChordName(advancedRaw);

  [basic, advanced].filter(Boolean).forEach((chordName) => {
    if (!isChordLookupKey(chordName)) {
      warnings.push(warning("suspicious_chord_lookup_key", `Chord "${chordName}" may need manual normalization for shape lookup.`, lineNumber, sourceLine));
    }
  });

  return {
    basic,
    advanced,
    lookup_key_basic: basic,
    lookup_key_advanced: advanced,
    source: marker,
  };
}

function parseLyric(rawLyric, lineNumber, sourceLine, warnings) {
  const trimmed = String(rawLyric || "").trim();

  if (!trimmed) {
    return { lyric: "", lyric_grouped: false };
  }

  const grouped = trimmed.match(/^\{([\s\S]*)\}$/);
  if (!grouped) {
    return { lyric: trimmed, lyric_grouped: false };
  }

  const lyric = grouped[1].trim();
  if (grouped[1] !== lyric) {
    warnings.push(warning("braced_lyric_trimmed", "Whitespace inside braced lyric was trimmed.", lineNumber, sourceLine));
  }

  return { lyric, lyric_grouped: true };
}

function parseCell(cellRaw, cellIndex, meter, lineNumber, sourceLine, warnings, errors) {
  const raw = String(cellRaw || "").trim();
  const match = raw.match(/^(\[[^\]]*\])\s*(.*)$/);

  if (raw.startsWith("[") && !match) {
    errors.push(error("unterminated_chord_marker", "Cell starts with a chord marker but has no closing bracket.", lineNumber, sourceLine));
  }

  const chord = match ? parseChordMarker(match[1], lineNumber, sourceLine, warnings) : null;
  const lyricRaw = match ? match[2] : raw;
  const lyric = parseLyric(lyricRaw, lineNumber, sourceLine, warnings);

  return {
    cell_index: cellIndex + 1,
    beat_index: meter.beat_map[cellIndex] || 1,
    lyric: lyric.lyric,
    lyric_grouped: lyric.lyric_grouped,
    chord,
  };
}

function extractLegacyColonChord(rawLine) {
  const match = String(rawLine).match(/^([A-G](?:#|b)?[^:\s/]*(?:\s*\|\s*[^:\s/]*)?)\s*:\s*(.*)$/);
  if (!match) {
    return null;
  }

  return {
    chordSpec: match[1].replace(/\s+/g, ""),
    lyricText: match[2],
  };
}

function parseBarLine(rawLine, lineNumber, meter, warnings, errors) {
  const legacyColon = extractLegacyColonChord(rawLine);
  let sourceForCells = rawLine;

  if (legacyColon) {
    warnings.push(warning("legacy_colon_syntax_detected", "Legacy chord colon syntax was converted.", lineNumber, rawLine));
    sourceForCells = `[${legacyColon.chordSpec}] ${legacyColon.lyricText}`;
  }

  const cellTexts = String(sourceForCells).split("/").map((part) => part.trim());

  if (cellTexts.length > meter.cells_per_bar) {
    errors.push(error("too_many_cells_for_meter", `Bar has ${cellTexts.length} cells but meter allows ${meter.cells_per_bar}.`, lineNumber, rawLine));
  }

  while (cellTexts.length < meter.cells_per_bar) {
    cellTexts.push("");
  }

  return {
    source_line: rawLine,
    cells: cellTexts.slice(0, meter.cells_per_bar).map((cell, index) => parseCell(cell, index, meter, lineNumber, rawLine, warnings, errors)),
  };
}

function parseQuickText(song, warnings, errors) {
  const meter = getMeterConfig(song);
  const sections = [];
  const sectionCounts = {};
  const rawLines = String(song.quickText || "").split(/\r?\n/);

  if (meter.used_fallback) {
    warnings.push(warning("meter_fallback_used", `No explicit preset for ${meter.time_signature.top}/${meter.time_signature.bottom}; fallback grid was used.`, null, null));
  }

  let currentSection = null;
  let barIndex = 0;

  rawLines.forEach((line, index) => {
    const lineNumber = index + 1;
    const rawLine = line.trim();

    if (!rawLine || rawLine.startsWith("//")) {
      return;
    }

    const sectionMatch = rawLine.match(/^\[(.+?)\]$/);
    if (sectionMatch) {
      const label = sectionMatch[1].trim();
      const baseId = slugifySection(label);
      sectionCounts[baseId] = (sectionCounts[baseId] || 0) + 1;
      const count = sectionCounts[baseId];

      if (count > 1) {
        warnings.push(warning("repeated_section_label", `Repeated section label "${label}" assigned unique id.`, lineNumber, rawLine));
      }

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
      warnings.push(warning("implicit_intro_section", "Bar appeared before any section header; created Intro section.", lineNumber, rawLine));
    }

    barIndex += 1;
    const parsedBar = parseBarLine(rawLine, lineNumber, meter, warnings, errors);
    currentSection.bars.push({
      bar_index: barIndex,
      ...parsedBar,
    });
  });

  if (!sections.length) {
    errors.push(error("no_sections_found", "No sections or bars were parsed from quickText.", null, null));
  }

  return {
    format: FORMAT_VERSION,
    source: {
      type: "quickText",
      raw: song.quickText || "",
    },
    meter: {
      time_signature: meter.time_signature,
      meter_mode: meter.meter_mode,
      cells_per_bar: meter.cells_per_bar,
      cell_unit: meter.cell_unit,
      beat_map: meter.beat_map,
      beat_groups: meter.beat_groups,
      count_labels: meter.count_labels,
    },
    sections,
  };
}

function mapSongRow(song) {
  return {
    legacy_id: song.id,
    title: song.title,
    artist_name: song.author,
    style: song.style || null,
    recommended_tempo: song.recommendedTempo || null,
    default_bpm: song.bpm || null,
    time_sig_top: song.timeSigTop || null,
    time_sig_bottom: song.timeSigBottom || null,
    meter_mode: song.meterMode || null,
    default_key: song.key || null,
    default_tone: song.tone || null,
    scale: song.scale || null,
    music_region: song.musicRegion || song.music_region || null,
  };
}

function countStats(contentJson) {
  let bars = 0;
  let cells = 0;
  let chords = 0;

  contentJson.sections.forEach((section) => {
    section.bars.forEach((bar) => {
      bars += 1;
      cells += bar.cells.length;
      chords += bar.cells.filter((cell) => cell.chord && (cell.chord.basic || cell.chord.advanced)).length;
    });
  });

  return {
    sections: contentJson.sections.length,
    bars,
    cells,
    chords,
  };
}

function migrateSongFile(filePath) {
  const warnings = [];
  const errors = [];
  const song = readSongData(filePath);

  if (!song.id) errors.push(error("invalid_song_metadata", "Missing song id.", null, null));
  if (!song.title) errors.push(error("invalid_song_metadata", "Missing song title.", null, null));
  if (!song.quickText) errors.push(error("missing_quick_text", "Missing quickText content.", null, null));

  const songRow = mapSongRow(song);
  const contentJson = parseQuickText(song, warnings, errors);
  const versionRow = {
    legacy_song_id: song.id,
    version_name: "Original",
    is_primary: true,
    content_json: contentJson,
  };

  return {
    songRow,
    versionRow,
    report: {
      legacy_id: song.id || path.basename(filePath, ".js"),
      file: path.relative(PROJECT_ROOT, filePath),
      data_classification: TRUSTED_SONG_IDS.has(song.id) ? "trusted_fixture" : "non_production_sample",
      import_eligible: TRUSTED_SONG_IDS.has(song.id) && errors.length === 0,
      status: errors.length ? "failed" : warnings.length ? "warning" : "valid",
      warnings,
      errors,
      stats: countStats(contentJson),
    },
  };
}

function writeJson(fileName, data) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function main() {
  const files = fs.readdirSync(SONG_SOURCE_DIR)
    .filter((fileName) => /^song-.+\.js$/.test(fileName))
    .map((fileName) => path.join(SONG_SOURCE_DIR, fileName))
    .sort();

  const songs = [];
  const songVersions = [];
  const reports = [];

  files.forEach((filePath) => {
    try {
      const result = migrateSongFile(filePath);
      songs.push(result.songRow);
      songVersions.push(result.versionRow);
      reports.push(result.report);
    } catch (migrationError) {
      reports.push({
        legacy_id: path.basename(filePath, ".js").replace(/^song-/, ""),
        file: path.relative(PROJECT_ROOT, filePath),
        status: "failed",
        warnings: [],
        errors: [error("file_parse_failed", migrationError.message, null, null)],
        stats: { sections: 0, bars: 0, cells: 0, chords: 0 },
      });
    }
  });

  const includedReports = TRUSTED_ONLY
    ? reports.filter((report) => report.import_eligible)
    : reports;
  const includedLegacyIds = new Set(includedReports.map((report) => report.legacy_id));
  const outputSongs = TRUSTED_ONLY
    ? songs.filter((song) => includedLegacyIds.has(song.legacy_id))
    : songs;
  const outputSongVersions = TRUSTED_ONLY
    ? songVersions.filter((version) => includedLegacyIds.has(version.legacy_song_id))
    : songVersions;

  const validationReport = {
    summary: {
      mode: TRUSTED_ONLY ? "trusted_only" : "all_songs",
      songs_total: reports.length,
      output_songs_total: outputSongs.length,
      trusted_fixtures: reports.filter((item) => item.data_classification === "trusted_fixture").length,
      non_production_samples: reports.filter((item) => item.data_classification === "non_production_sample").length,
      songs_valid: reports.filter((item) => item.status === "valid").length,
      songs_with_warnings: reports.filter((item) => item.status === "warning").length,
      songs_failed: reports.filter((item) => item.status === "failed").length,
      trusted_blocking_errors: reports.filter((item) => item.data_classification === "trusted_fixture" && item.errors.length).length,
    },
    notes: [
      "Non-production sample songs are parsed for tolerance but are not trusted import data.",
      "Warnings on non-production samples do not block Step 4 refinement.",
      "Use npm run migrate:songs:trusted to write only trusted import candidates to songs.json and song_versions.json.",
    ],
    songs: reports.map((report) => ({
      ...report,
      output_included: includedLegacyIds.has(report.legacy_id),
    })),
  };

  writeJson("songs.json", outputSongs);
  writeJson("song_versions.json", outputSongVersions);
  writeJson("validation_report.json", validationReport);

  console.log(`Migrated ${reports.length} song files.`);
  console.log(`Output written to ${path.relative(PROJECT_ROOT, OUTPUT_DIR)}`);
  console.log(JSON.stringify(validationReport.summary, null, 2));
}

main();
