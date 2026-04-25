// ======================================================
// MAIN PAGE SCRIPT
// ======================================================
document.addEventListener("DOMContentLoaded", () => {
  const { escapeHTML, safeLink, injectStyleOnce, fetchJson } = window.LufeUtils;

  // ======================================================
  // CARD RENDERING
  // ======================================================
  function renderCards(list, targetId, options = {}) {
    const el = document.getElementById(targetId);
    if (!el) return;

    if (!Array.isArray(list) || list.length === 0) {
      el.innerHTML = `
        <div class="card">
          <div class="card-top">
            <p class="card-title">Đang cập nhật</p>
            <span class="chip">Soon</span>
          </div>
          <p class="card-desc">Anh sẽ thêm nội dung sau.</p>
          <div class="card-actions">
            <a class="link" href="#">Xem</a>
          </div>
        </div>
      `;
      return;
    }

    el.innerHTML = list
      .map((item) => {
        const title = escapeHTML(item.title);
        const desc = escapeHTML(item.desc);
        const chip = escapeHTML(item.chip || item.status || "Update");
        const link = safeLink(item.link);
        const primaryText = options.primaryText || "Xem";

        const isEmpty = !item.link || !item.link.trim();
        const linkAttr = isEmpty ? `href="#" aria-disabled="true"` : `href="${link}"`;
        const linkClass = isEmpty ? "link is-disabled" : "link";

        const cover = safeLink(item.cover || item.image || "");
        const coverHtml = cover && cover !== "#"
          ? `<div class="card-media"><img src="${cover}" alt="${title} cover" loading="lazy"></div>`
          : "";

        if (item.type === "album") {
          return `
            <div class="card">
              ${coverHtml}
              <div class="card-top">
                <p class="card-title">${title}</p>
                <span class="chip">${chip}</span>
              </div>
              <p class="card-desc">${desc}</p>
              <div class="card-actions">
                <a class="${linkClass}" ${linkAttr}>
                  ${primaryText} <i class="fa-solid fa-arrow-right"></i>
                </a>
              </div>
            </div>
          `;
        }

        return `
          <div class="card">
            <div class="card-top">
              <p class="card-title">${title}</p>
              <span class="chip">${chip}</span>
            </div>
            <p class="card-desc">${desc}</p>
            <div class="card-actions">
              <a class="${linkClass}" ${linkAttr}>
                ${primaryText} <i class="fa-solid fa-arrow-right"></i>
              </a>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // ======================================================
  // SOCIAL LINKS
  // ======================================================
  function renderSocial(socialList) {
    const wrap = document.getElementById("socialIcons");
    if (!wrap) return;

    const toSocialClass = (name = "") => {
      const n = String(name).toLowerCase();
      if (n.includes("facebook") || n.includes("fb")) return "facebook";
      if (n.includes("tiktok") || n.includes("tt")) return "tiktok";
      if (n.includes("youtube") || n.includes("yt")) return "youtube";
      if (n.includes("instagram") || n.includes("insta") || n.includes("ig")) return "instagram";
      return "other";
    };

    if (!Array.isArray(socialList) || socialList.length === 0) {
      wrap.innerHTML = `
        <a class="icon-btn other" href="#" aria-label="Social">
          <i class="fa-solid fa-link"></i>
        </a>
      `;
      return;
    }

    wrap.innerHTML = socialList
      .map((s) => {
        const name = escapeHTML(s.name || "Social");
        const icon = escapeHTML(s.icon || "fa-solid fa-link");
        const link = safeLink(s.link);
        const isEmpty = !s.link || !s.link.trim();
        const href = isEmpty ? "#" : link;
        const socialClass = toSocialClass(s.name);

        return `
          <a class="icon-btn ${socialClass} ${isEmpty ? "is-disabled" : ""}"
             href="${href}"
             target="_blank"
             rel="noopener"
             aria-label="${name}">
            <i class="${icon}"></i>
          </a>
        `;
      })
      .join("");
  }

  // ======================================================
  // DONATE INFO
  // ======================================================
  function fillDonate(donate) {
    const bankName = document.getElementById("bankName");
    const bankOwner = document.getElementById("bankOwner");
    const bankNumber = document.getElementById("bankNumber");

    if (bankName) bankName.textContent = donate?.bankName || "—";
    if (bankOwner) bankOwner.textContent = donate?.bankOwner || "—";
    if (bankNumber) bankNumber.textContent = donate?.bankNumber || "—";

    const copyBtn = document.getElementById("copyBank");
    const hint = document.getElementById("copyHint");

    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        const text = `Ngân hàng: ${donate?.bankName || ""}\nChủ TK: ${donate?.bankOwner || ""}\nSố TK: ${donate?.bankNumber || ""}`.trim();

        try {
          await navigator.clipboard.writeText(text);
          if (hint) hint.textContent = "✅ Đã copy thông tin donate!";
        } catch (e) {
          if (hint) hint.textContent = "⚠️ Không copy được (trình duyệt chặn). Anh copy thủ công nhé.";
        }

        setTimeout(() => {
          if (hint) hint.textContent = "";
        }, 2500);
      });
    }
  }

  // ======================================================
  // SHARED DISABLED STATE STYLE
  // ======================================================
  injectStyleOnce(
    "lufe-shared-disabled-style",
    `
      .is-disabled,
      .link.is-disabled {
        opacity: .6;
        cursor: not-allowed;
        pointer-events: none;
      }
    `
  );

  // ======================================================
  // DATA FETCHING
  // ======================================================
  const DATA_PATH = "../Data/data.json";

  fetchJson(DATA_PATH)
    .then((data) => {
      renderSocial(data.social);
      renderCards(data.tools, "toolsGrid", { primaryText: "Mở tool" });
      renderCards(data.albums, "albumsGrid", { primaryText: "Nghe" });
      renderCards(data.products, "productsGrid", { primaryText: "Xem sản phẩm" });
      renderCards(data.posts, "postsGrid", { primaryText: "Đọc bài" });
      fillDonate(data.donate);
    })
    .catch((err) => {
      console.error(err);
      renderSocial([]);
      renderCards([], "toolsGrid");
      renderCards([], "albumsGrid");
      renderCards([], "productsGrid");
      renderCards([], "postsGrid");
      fillDonate(null);
    });
});
