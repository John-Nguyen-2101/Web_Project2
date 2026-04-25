// ======================================================
// SHARED UI HELPERS
// ======================================================
if (location.pathname.endsWith('index.html')) {
  const newPath = location.pathname.replace('index.html', '');
  const newUrl = newPath + location.search; // giữ ?slug

  history.replaceState(null, '', newUrl);
}
document.addEventListener("DOMContentLoaded", () => {
  initMobileNav();
  initFooterYear();
  initScrollTop();
});

function initMobileNav() {
  const { $ } = window.LufeUtils;
  const navToggle = $("navToggle");
  const mobileNav = $("mobileNav");

  if (!navToggle || !mobileNav) return;

  navToggle.addEventListener("click", () => {
    mobileNav.classList.toggle("is-open");
    navToggle.setAttribute(
      "aria-label",
      mobileNav.classList.contains("is-open") ? "Đóng menu" : "Mở menu"
    );
  });
}

function initFooterYear() {
  const { $ } = window.LufeUtils;
  const yearEl = $("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

function initScrollTop() {
  const { $ } = window.LufeUtils;
  const scrollTopBtn = $("scrollTopBtn");
  if (!scrollTopBtn) return;

  window.addEventListener("scroll", () => {
    scrollTopBtn.classList.toggle("show", window.scrollY > 300);
  });

  scrollTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
