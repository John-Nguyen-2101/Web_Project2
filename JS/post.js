// ======================================================
// BLOG POST PAGE
// ======================================================
document.addEventListener("DOMContentLoaded", () => {
  const { fetchJson, escapeHTML } = window.LufeUtils;

  (async function () {
    const app = document.getElementById("app");
    if (!app) return;

    const slug = new URL(location.href).searchParams.get("slug");

    if (!slug) {
      app.innerHTML = `
        <h1>Thiếu slug</h1>
        <p>Mở đúng dạng: <code>index.html?slug=passing-chord-la-gi</code></p>
      `;
      return;
    }

    try {
      const posts = await fetchJson("/Data/posts.json", { cache: "no-store" });
      const post = posts.find((p) => p.slug === slug);

      if (!post) {
        app.innerHTML = `<h1>Không tìm thấy bài</h1><p>Slug: <code>${escapeHTML(slug)}</code></p>`;
        return;
      }

      app.innerHTML = `
        <article class="card">
          <h1>${post.title}</h1>
          <div class="meta">${post.date || ""}</div>
          <div class="content">${post.content || ""}</div>
        </article>
      `;
    } catch (err) {
      console.error(err);
      app.innerHTML = `
        <h1>Lỗi render</h1>
        <p>Mở Console (F12) để xem lỗi.</p>
        <pre>${escapeHTML(String(err?.message || err))}</pre>
      `;
    }
  })();
});
