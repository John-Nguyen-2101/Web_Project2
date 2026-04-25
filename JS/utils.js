// ======================================================
// SHARED UTILITIES
// ======================================================
(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function escapeHTML(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeLink(url) {
    const s = String(url ?? "").trim();
    if (!s) return "#";

    const ok =
      s.startsWith("http://") ||
      s.startsWith("https://") ||
      s.startsWith("mailto:") ||
      s.startsWith("tel:") ||
      s.startsWith("/") ||
      s.startsWith("./") ||
      s.startsWith("../") ||
      s.startsWith("#");

    return ok ? s : "#";
  }

  function normalizeText(text) {
    return String(text ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text ?? "";
  }

  function injectStyleOnce(id, cssText) {
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;
    style.textContent = cssText;
    document.head.appendChild(style);
  }

  async function fetchJson(path, options = {}) {
    const res = await fetch(path, options);
    if (!res.ok) throw new Error(`Cannot load JSON: ${path}`);
    return res.json();
  }

  window.LufeUtils = {
    $,
    escapeHTML,
    safeLink,
    normalizeText,
    setText,
    injectStyleOnce,
    fetchJson,
  };
})();
