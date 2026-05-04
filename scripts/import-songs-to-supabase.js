const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "migration-output");
const DRY_RUN = process.argv.includes("--dry-run");

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_IMPORT_USER_ID",
];

function loadLocalEnv() {
  const envPath = path.join(PROJECT_ROOT, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);

    if (!match) {
      continue;
    }

    const key = match[1];
    let value = match[2].trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function requireEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(
      [
        "Missing required Supabase environment variables:",
        ...missing.map((key) => `- ${key}`),
        "",
        "Create a local .env file with:",
        "NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY=your-service-role-key",
        "SUPABASE_IMPORT_USER_ID=your-user-or-profile-id",
        "",
        "The service role key must stay server-only and must never be used in client code.",
        "SUPABASE_IMPORT_USER_ID is required because migration-output JSON does not include uploaded_by/created_by.",
      ].join("\n"),
    );
  }
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "song";
}

function readJson(fileName) {
  const filePath = path.join(OUTPUT_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing migration output file: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be a JSON array.`);
  }
}

function validateTrustedOutput(songs, versions, report) {
  assertArray(songs, "songs.json");
  assertArray(versions, "song_versions.json");

  if (!report || !Array.isArray(report.songs)) {
    throw new Error("validation_report.json must include a songs array.");
  }

  const trustedByLegacyId = new Map(
    report.songs
      .filter((song) => song.output_included)
      .map((song) => [song.legacy_id, song]),
  );

  for (const song of songs) {
    if (!song.legacy_id) {
      throw new Error("Each song must include legacy_id.");
    }

    const reportSong = trustedByLegacyId.get(song.legacy_id);

    if (!reportSong) {
      throw new Error(`Song ${song.legacy_id} is not marked output_included in validation_report.json.`);
    }

    if (reportSong.import_eligible !== true || reportSong.status !== "valid") {
      throw new Error(`Song ${song.legacy_id} is not a valid trusted import candidate.`);
    }
  }

  const songIds = new Set(songs.map((song) => song.legacy_id));

  for (const version of versions) {
    if (!version.legacy_song_id) {
      throw new Error("Each song version must include legacy_song_id.");
    }

    if (!songIds.has(version.legacy_song_id)) {
      throw new Error(`Version references non-imported legacy_song_id: ${version.legacy_song_id}`);
    }

    if (!version.content_json || version.content_json.format !== "lufe.song_content.v1") {
      throw new Error(`Version for ${version.legacy_song_id} has missing or invalid content_json format.`);
    }
  }
}

function getRequiredValue(source, key, label) {
  if (source[key] === undefined || source[key] === null || source[key] === "") {
    throw new Error(`Missing required migration field for ${label}: ${key}`);
  }

  return source[key];
}

function toSongRow(song) {
  const now = new Date().toISOString();

  return {
    legacy_song_id: getRequiredValue(song, "legacy_id", "songs.legacy_song_id"),
    slug: slugify(song.legacy_id || song.title),
    title: getRequiredValue(song, "title", "songs.title"),
    author_name: getRequiredValue(song, "artist_name", "songs.author_name"),
    style: song.style || null,
    recommended_tempo_text: song.recommended_tempo || null,
    bpm: song.default_bpm || null,
    time_sig_top: getRequiredValue(song, "time_sig_top", "songs.time_sig_top"),
    time_sig_bottom: getRequiredValue(song, "time_sig_bottom", "songs.time_sig_bottom"),
    meter_mode: song.meter_mode || null,
    song_key: song.default_key || null,
    scale: song.scale,
    music_region: song.music_region,
    uploaded_by: process.env.SUPABASE_IMPORT_USER_ID,
    status: "draft",
    visibility: "private",
    current_version_id: null,
    view_count: 0,
    like_count: 0,
    comment_count: 0,
    rating_avg: 0,
    rating_count: 0,
    created_at: now,
    published_at: null,
    updated_at: now,
  };
}

function toVersionRow(version, songId, versionNumber) {
  const now = new Date().toISOString();

  return {
    song_id: songId,
    version_number: versionNumber,
    content_json: getRequiredValue(version, "content_json", "song_versions.content_json"),
    quick_text_legacy: version.content_json && version.content_json.source
      ? version.content_json.source.raw || null
      : null,
    change_summary: version.version_name
      ? `Imported from trusted migration output: ${version.version_name}`
      : "Imported from trusted migration output",
    created_by: process.env.SUPABASE_IMPORT_USER_ID,
    is_current: Boolean(version.is_primary),
    created_at: now,
  };
}

function getVersionNumber(version, index) {
  return Number.isInteger(version.version_number) && version.version_number > 0
    ? version.version_number
    : index + 1;
}

async function supabaseRequest(pathname, options = {}) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "");
  const url = new URL(`${baseUrl}/rest/v1/${pathname}`);

  for (const [key, value] of Object.entries(options.query || {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data && data.message ? data.message : text || response.statusText;
    throw new Error(`Supabase ${options.method || "GET"} ${pathname} failed: ${message}`);
  }

  return data;
}

async function upsertSongs(songs) {
  const rows = songs.map(toSongRow);

  return supabaseRequest("songs", {
    method: "POST",
    query: { on_conflict: "legacy_song_id" },
    prefer: "resolution=merge-duplicates,return=representation",
    body: rows,
  });
}

async function upsertVersions(versions, songsByLegacyId) {
  const counters = new Map();
  const rows = versions.map((version) => {
    const song = songsByLegacyId.get(version.legacy_song_id);

    if (!song || !song.id) {
      throw new Error(`Could not resolve imported song id for ${version.legacy_song_id}.`);
    }

    const index = counters.get(version.legacy_song_id) || 0;
    counters.set(version.legacy_song_id, index + 1);

    return {
      legacy_song_id: version.legacy_song_id,
      row: toVersionRow(version, song.id, getVersionNumber(version, index)),
    };
  });

  const imported = await supabaseRequest("song_versions", {
    method: "POST",
    query: { on_conflict: "song_id,version_number" },
    prefer: "resolution=merge-duplicates,return=representation",
    body: rows.map((item) => item.row),
  });

  return imported.map((row) => {
    const source = rows.find((item) => item.row.song_id === row.song_id && item.row.version_number === row.version_number);
    return {
      ...row,
      legacy_song_id: source ? source.legacy_song_id : null,
    };
  });
}

async function updateCurrentVersions(importedVersions) {
  const primaryVersions = importedVersions.filter((version) => version.is_current);
  const updates = [];

  for (const version of primaryVersions) {
    const result = await supabaseRequest(`songs?id=eq.${encodeURIComponent(version.song_id)}`, {
      method: "PATCH",
      prefer: "return=representation",
      body: { current_version_id: version.id },
    });

    updates.push(...result);
  }

  return updates;
}

function buildDryRunPayload(songs, versions) {
  const songRows = songs.map(toSongRow);
  const mockSongsByLegacyId = new Map(
    songRows.map((song) => [
      song.legacy_song_id,
      {
        ...song,
        id: `dry-run-song-id-${song.legacy_song_id}`,
      },
    ]),
  );
  const counters = new Map();
  const versionRows = versions.map((version) => {
    const song = mockSongsByLegacyId.get(version.legacy_song_id);
    const index = counters.get(version.legacy_song_id) || 0;
    counters.set(version.legacy_song_id, index + 1);

    return toVersionRow(version, song.id, getVersionNumber(version, index));
  });

  return {
    songs: songRows,
    song_versions: versionRows,
  };
}

async function main() {
  loadLocalEnv();
  requireEnv();

  const songs = readJson("songs.json");
  const versions = readJson("song_versions.json");
  const report = readJson("validation_report.json");

  validateTrustedOutput(songs, versions, report);

  if (!songs.length) {
    throw new Error("No trusted songs found in migration-output/songs.json.");
  }

  if (DRY_RUN) {
    const payload = buildDryRunPayload(songs, versions);

    console.log("Supabase song import dry run complete. No network request was made.");
    console.log(
      JSON.stringify(
        {
          songs_read: songs.length,
          song_versions_read: versions.length,
          payload,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`Preparing to import ${songs.length} song(s) and ${versions.length} version(s).`);

  const importedSongs = await upsertSongs(songs);
  const songsByLegacyId = new Map(importedSongs.map((song) => [song.legacy_song_id, song]));
  const importedVersions = await upsertVersions(versions, songsByLegacyId);
  const updatedSongs = await updateCurrentVersions(importedVersions);

  console.log("Supabase song import complete.");
  console.log(
    JSON.stringify(
      {
        songs_read: songs.length,
        song_versions_read: versions.length,
        songs_upserted: importedSongs.length,
        song_versions_upserted: importedVersions.length,
        current_versions_updated: updatedSongs.length,
        imported_legacy_song_ids: importedSongs.map((song) => song.legacy_song_id),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Supabase song import failed safely.");
  console.error(error.message);
  process.exitCode = 1;
});
