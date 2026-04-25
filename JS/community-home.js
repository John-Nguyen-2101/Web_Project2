(function () {
  // Shared utils
  const { $, escapeHTML, safeLink, normalizeText } = window.LufeUtils;

  // Song data source
  const songs = Array.isArray(window.SONG_LIST) ? window.SONG_LIST : [];

  // Format number (views)
  function formatViews(n) {
    return new Intl.NumberFormat("vi-VN").format(Number(n || 0));
  }

  // Check if at least one song already has a valid view count
  function hasViewData(list) {
    return (list || []).some((song) => Number(song.views || 0) > 0);
  }

  // Return a new sorted list:
  // - sort by views desc if view data exists
  // - otherwise keep original order
  function getSortedSongs(list) {
    const safeList = Array.isArray(list) ? [...list] : [];
    if (!hasViewData(safeList)) return safeList;

    return safeList.sort((a, b) => Number(b.views || 0) - Number(a.views || 0));
  }

  // Build top 3 songs from the same source list
  function getRankSongs(list) {
    return getSortedSongs(list)
      .slice(0, 3)
      .map((song, index) => ({
        rank: index + 1,
        title: song.title,
        artist: song.author || "",
        views: Number(song.views || 0),
        link: `/Chords/chord.html?song=${encodeURIComponent(song.id)}`
      }));
  }

  // Render top ranked songs
  function renderRankSongs(list) {
    const el = $("rankGrid");
    if (!el) return;

    if (!Array.isArray(list) || !list.length) {
      el.innerHTML = `
        <article class="strip-card rank-card">
          <h3>Đang cập nhật</h3>
          <p class="muted">Dữ liệu xếp hạng sẽ được thêm sau.</p>
        </article>
      `;
      return;
    }

    el.innerHTML = list
      .map((item) => {
        const rank = Number(item.rank || 0);
        const title = escapeHTML(item.title);
        const artist = escapeHTML(item.artist);
        const views = formatViews(item.views);
        const link = safeLink(item.link);

        return `
          <article class="strip-card rank-card rank-${rank}">
            <div class="rank-top">
              <span class="rank-badge">#${rank}</span>
              <span class="rank-views">${views} lượt truy cập</span>
            </div>
            <h3>${title}</h3>
            <p>${artist}</p>
            <a class="link" href="${link}">Mở hợp âm</a>
          </article>
        `;
      })
      .join("");
  }

  // Render song list (right panel)
  function renderSongs(list) {
    const el = $("songsList");
    const elCount = $("songCount");
    if (!el) return;

    const safeList = Array.isArray(list) ? list : [];
    if (elCount) elCount.textContent = `${safeList.length} bài`;

    if (!safeList.length) {
      el.innerHTML = `
        <div class="list-empty muted">
          Không tìm thấy bài hát phù hợp.
        </div>
      `;
      return;
    }

    el.innerHTML = safeList
      .map((song) => {
        const title = escapeHTML(song.title);
        const link = `/Chords/chord.html?song=${encodeURIComponent(song.id)}`;

        return `
          <a class="listItem" href="${link}">
            <div class="listItemTitle">${title}</div>
          </a>
        `;
      })
      .join("");
  }

  // Bind search events
  function bindSongSearch() {
    const input = $("songSearchInput");
    const btn = $("btnSearch");
    if (!input && !btn) return;

    const doFilter = () => {
      const q = normalizeText(input?.value || "");

      const filteredBase = !q
        ? songs
        : songs.filter((song) =>
            normalizeText(`${song.title} ${song.author}`).includes(q)
          );

      renderSongs(getSortedSongs(filteredBase));
    };

    input?.addEventListener("input", doFilter);
    btn?.addEventListener("click", doFilter);

    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        doFilter();
      }
    });
  }

  // Init module
  function init() {
    renderRankSongs(getRankSongs(songs));
    renderSongs(getSortedSongs(songs));
    bindSongSearch();
  }

  document.addEventListener("DOMContentLoaded", init);
})();