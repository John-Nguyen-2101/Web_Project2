// ======================================================
// CHORDS PAGE MODULE
// ======================================================
(function () {
  const { $, escapeHTML, safeLink, normalizeText } = window.LufeUtils;

  // ======================================================
  // STATIC DATA (MOCK)
  // ======================================================
  const data = {
    social: [
      { name: "Facebook", icon: "fa-brands fa-facebook", link: "https://www.facebook.com/guitaristVN/" },
      { name: "TikTok", icon: "fa-brands fa-tiktok", link: "https://www.tiktok.com/@jblufe.studio" },
      { name: "YouTube", icon: "fa-brands fa-youtube", link: "https://www.youtube.com/@lufeaudio1526" },
      { name: "Instagram", icon: "fa-brands fa-instagram", link: "https://www.instagram.com/jb_lufe.audio/" }
    ],
    donate: {
      bankName: "Vietcombank (Mock)",
      bankOwner: "JOHN THANH LỊCH",
      bankNumber: "0123 456 789"
    },
    tools: [
      {
        title: "Luyện nghe nôt nhạc",
        desc: "Bài tập nhận diện pitch của từng nôt trong scale.",
        status: "Đã có sẵn",
        link: "../Tools/index.html"
      },
      {
        title: "Luyện nghe hợp âm",
        desc: "Bài tập nhận diện quality: maj/min/dim/aug/7...",
        status: "Đã có sẵn",
        link: "../Tools/index.html"
      },
      {
        title: "Metronome",
        desc: "Máy đếm nhịp đơn giản, có thể tùy chỉnh BPM và time signature.",
        status: "Đã có sẵn",
        link: "../Tools/index.html"
      }
    ],
    albums: [
      {
        title: "Ước mơ tuổi 17",
        desc: "Release 09/2025. Jb-Lufe",
        chip: "Single",
        link: "https://youtu.be/FgIijOdivPk?si=pOOiFNZazCiZJPTw",
        cover: "../IMG/album2.jpg"
      },
      {
        title: "Đã đủ rồi",
        desc: "Release 03/2025. Jb-Lufe feat. Fei Nguyen",
        chip: "Single",
        link: "https://youtu.be/m95H8jcECBw?si=gx1znzB-0ylaavEC",
        cover: "../IMG/album1.jpg"
      },
      {
        title: "Tương tư",
        desc: "Release 03/2026. Jb-Lufe feat. Fei Nguyen, Quynh Trang",
        chip: "Single",
        link: "#",
        cover: "../IMG/album3.jpg"
      }
    ],
    posts: [
      { title: "Passing chord là gì?", desc: "Giải thích dễ hiểu + ví dụ thực tế.", chip: "Harmony", link: "#" },
      { title: "Cách đệm hát không bị lạc tone", desc: "Checklist tai nghe + hợp âm + nhịp.", chip: "Guitar", link: "#" },
      { title: "Attack/Decay/Sustain/Release", desc: "Hiểu ADSR để mix nhạc tốt hơn.", chip: "Mixing", link: "#" }
    ]
  };

  const songs = window.SONG_LIST || [];

  // ======================================================
  // RENDER FUNCTIONS
  // ======================================================
  function renderTools(list) {
    const el = $("toolsList");
    if (!el) return;

    el.innerHTML = (list || [])
      .map((t) => {
        const title = escapeHTML(t.title);
        const desc = escapeHTML(t.desc);
        const chip = escapeHTML(t.status || t.chip || "Update");
        const link = safeLink(t.link);
        const isEmpty = !t.link || !String(t.link).trim();
        const href = isEmpty ? "#" : link;
        const cls = "toolCard" + (isEmpty ? " is-disabled" : "");

        return `
          <a class="${cls}" href="${href}" ${isEmpty ? 'aria-disabled="true"' : ""}>
            <div class="toolTitle">${title}</div>
            <div class="toolDesc muted small">${desc}</div>
            <div class="toolChip">${chip}</div>
          </a>
        `;
      })
      .join("");
  }

  function renderAlbums(list) {
    const el = $("albumsGrid");
    if (!el) return;

    el.innerHTML = (list || [])
      .map((a) => {
        const title = escapeHTML(a.title);
        const desc = escapeHTML(a.desc);
        const chip = escapeHTML(a.chip || a.status || "Single");
        const link = safeLink(a.link);

        const cover = safeLink(a.cover || a.image || "");
        const isEmpty = !a.link || !String(a.link).trim();
        const href = isEmpty ? "#" : link;

        const coverHtml = cover && cover !== "#"
          ? `<div class="albumMedia">
               <img src="${cover}" alt="${title} cover" loading="lazy">
             </div>`
          : "";

        return `
          <a class="albumCardRow ${isEmpty ? "is-disabled" : ""}" href="${href}" ${isEmpty ? 'aria-disabled="true"' : ""}>
            <div class="albumLeft">
              <div class="albumTop">
                <div class="albumTitle">${title}</div>
                <div class="albumChip">${chip}</div>
              </div>
              <div class="albumDesc muted small">${desc}</div>
            </div>
            ${coverHtml}
          </a>
        `;
      })
      .join("");
  }

  function renderSongs(list, activeId = null) {
    const el = $("songsList");
    const elCount = $("songCount");
    if (!el) return;

    const safeList = list || [];
    if (elCount) elCount.textContent = `${safeList.length} bài`;

    el.innerHTML = safeList
      .map((s) => {
        const title = escapeHTML(s.title);
        const meta = escapeHTML(
          `${s.author || ""}${s.bpm ? " • " + s.bpm + " BPM" : ""}${s.timeSig ? " • " + s.timeSig : ""}`
        );

        const link = `../chords/chord.html?song=${encodeURIComponent(s.id)}`;
        const isActive = activeId && s.id === activeId;

        return `
          <a class="listItem ${isActive ? "is-active" : ""}" 
             href="${link}" 
             data-song-id="${escapeHTML(s.id)}">
            <div class="listItemTitle">${title}</div>
            <div class="listItemMeta muted small">${meta}</div>
          </a>
        `;
      })
      .join("");
  }

  // ======================================================
  // SEARCH
  // ======================================================
  function bindSearch() {
    const input = $("songSearch");
    const btn = $("btnSearch");
    if (!input && !btn) return;

    const doFilter = () => {
      const q = normalizeText(input?.value || "");
      const filtered = !q
        ? songs
        : songs.filter((s) => normalizeText(`${s.title} ${s.author}`).includes(q));

      renderSongs(filtered);
    };

    input?.addEventListener("input", doFilter);
    btn?.addEventListener("click", doFilter);
  }

  // ======================================================
  // INIT
  // ======================================================
  function init() {
    renderTools(data.tools);
    renderAlbums(data.albums);
    renderSongs(songs);
    bindSearch();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
