const assert = require("assert");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "migration-output");

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(outputDir, fileName), "utf8"));
}

function allBars(contentJson) {
  return contentJson.sections.flatMap((section) =>
    section.bars.map((bar) => ({
      section: section.label,
      ...bar,
    })),
  );
}

execFileSync(process.execPath, [path.join(projectRoot, "scripts", "migrate-song-data.js"), "--trusted-only"], {
  cwd: projectRoot,
  stdio: "inherit",
});

const songs = readJson("songs.json");
const versions = readJson("song_versions.json");
const report = readJson("validation_report.json");

assert.strictEqual(songs.length, 1, "trusted migration should output one song");
assert.strictEqual(songs[0].legacy_id, "Ngayxuanlpxv", "Ngayxuanlpxv should be the trusted song");

const trustedReport = report.songs.find((song) => song.legacy_id === "Ngayxuanlpxv");
assert.ok(trustedReport, "validation report should include Ngayxuanlpxv");
assert.strictEqual(trustedReport.data_classification, "trusted_fixture");
assert.strictEqual(trustedReport.import_eligible, true);
assert.strictEqual(trustedReport.status, "valid");
assert.deepStrictEqual(trustedReport.warnings, []);
assert.deepStrictEqual(trustedReport.errors, []);

const version = versions.find((item) => item.legacy_song_id === "Ngayxuanlpxv");
assert.ok(version, "song_versions should include Ngayxuanlpxv");

const content = version.content_json;
const bars = allBars(content);

assert.strictEqual(content.sections.length, 3, "should preserve 3 sections");
assert.strictEqual(bars.length, 32, "should preserve 32 bars");

for (const bar of bars) {
  assert.strictEqual(bar.cells.length, 4, `bar ${bar.bar_index} should have 4 cells`);
}

const bar31 = bars.find((bar) => bar.bar_index === 31);
assert.ok(bar31, "bar 31 should exist");
assert.strictEqual(bar31.source_line, "[F ] mới/ an/ [G]khang / bình");
assert.strictEqual(bar31.cells[2].chord.basic, "G", "inline [G] chord should be preserved in bar 31 cell 3");
assert.strictEqual(bar31.cells[2].chord.lookup_key_basic, "G", "inline [G] lookup key should be preserved");
assert.strictEqual(bar31.cells[2].lyric, "khang", "inline chord lyric should be preserved");

const emptyCells = bars.flatMap((bar) =>
  bar.cells
    .filter((cell) => !cell.lyric && !cell.chord)
    .map((cell) => ({ bar_index: bar.bar_index, cell_index: cell.cell_index })),
);
assert.ok(emptyCells.length > 0, "empty timing cells should be preserved");
assert.ok(
  emptyCells.some((cell) => cell.bar_index === 4 && cell.cell_index === 2),
  "bar 4 cell 2 should be an empty preserved cell",
);

const groupedCells = bars.flatMap((bar) =>
  bar.cells
    .filter((cell) => cell.lyric_grouped)
    .map((cell) => ({ bar, cell })),
);
assert.ok(groupedCells.length > 0, "grouped lyric cells should be preserved");

const groupedVanLoc = groupedCells.find(({ cell }) => cell.lyric === "vạn lộc");
assert.ok(groupedVanLoc, "grouped lyric vạn lộc should be preserved");
assert.strictEqual(groupedVanLoc.cell.lyric_grouped, true);
assert.ok(groupedVanLoc.bar.source_line.includes("{vạn lộc}"), "original braced lyric source should be preserved");
assert.ok(content.source.raw.includes("{vạn lộc}"), "raw quickText should preserve braced lyric source");

console.log("Song migration tests passed.");

