// ======================================================
// CHORD PAGE MODULE
// ======================================================
(function () {
  const { $, setText, escapeHTML, fetchJson } = window.LufeUtils;

  // ======================================================
  // URL HELPERS
  // ======================================================
  function getSongIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return (params.get("song") || "").trim();
  }

  // ======================================================
  // VIDEO
  // ======================================================
  function setVideo(url) {
    const iframe = $("mainVideo");
    if (!iframe) return;
    iframe.src = url || "";
  }

  // ======================================================
  // FALLBACK / ERROR UI
  // ======================================================
  function renderNotFound(songId) {
    setText("songTitle", "Không tìm thấy bài hát");

    const root = $("songRoot");
    if (root) {
      root.innerHTML = `<div class="muted">Không có dữ liệu cho ID: <b>${escapeHTML(songId || "(trống)")}</b></div>`;
    }
  }

  // ======================================================
  // SONG META RENDER
  // ======================================================
  function renderSongMeta(song) {
    setText("songTitle", song.title || "");
    setText("songAuthor", song.author ? `👤 ${song.author}` : "");
    setText("songStyle", song.style ? `🎵 ${song.style}` : "");
    setText(
      "songTimeSig",
      song.timeSigTop && song.timeSigBottom ? `🕒 ${song.timeSigTop}/${song.timeSigBottom}` : ""
    );
    setText("songTempoHint", song.recommendedTempo ? `⚡ ${song.recommendedTempo}` : "");
    setText("songBpmNow", song.bpm ? `BPM: ${song.bpm}` : "");

    const bpmRange = $("bpmRange");
    const bpmLabel = $("bpmLabel");

    if (bpmRange && song.bpm) {
      bpmRange.value = String(song.bpm);
      if (bpmLabel) bpmLabel.textContent = String(song.bpm);
    }
  }

  // ======================================================
  // SONG BODY RENDER
  // ======================================================
  function renderTokensLine(line) {
    const tokens = Array.isArray(line.tokens) ? line.tokens : [];

    const chordRow = tokens
      .map((t) => `<span class="tokChord">${escapeHTML((t.chord ?? "").trim())}</span>`)
      .join("");

    const lyricRow = tokens
      .map((t) => `<span class="tokLyric">${escapeHTML(t.lyric ?? "")}</span>`)
      .join("");

    return `
      <div class="songLine">
        <div class="rowChords">${chordRow}</div>
        <div class="rowLyrics">${lyricRow}</div>
      </div>
    `;
  }

  function renderSectionLine(sectionName) {
    return `<div class="songSection">${escapeHTML(sectionName || "")}</div>`;
  }

  function renderSongBody(song) {
    const root = $("songRoot");
    if (!root) return;

    const lines = Array.isArray(song.lines) ? song.lines : [];

    root.innerHTML = lines
      .map((line) => {
        if (line.section) return renderSectionLine(line.section);
        if (line.tokens) return renderTokensLine(line);
        return "";
      })
      .join("");
  }

  // ======================================================
  // DATA LOADING
  // ======================================================
  function loadSongsJson() {
    return fetchJson("/Data/songs.json", { cache: "no-store" });
  }

  // ======================================================
  // PAGE INIT
  // ======================================================
  document.addEventListener("DOMContentLoaded", async () => {
    const songId = getSongIdFromUrl();
    if (!songId) return renderNotFound("");

    try {
      const allSongs = await loadSongsJson();
      const song = Array.isArray(allSongs) ? allSongs.find((s) => s.id === songId) : null;

      if (!song) return renderNotFound(songId);

      renderSongMeta(song);
      renderSongBody(song);

      // Example:
      // setVideo(song.videoUrl);
    } catch (e) {
      console.error(e);
      renderNotFound(songId);
    }
  });
})();
