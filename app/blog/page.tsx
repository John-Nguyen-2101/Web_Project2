import { getBlogPosts } from "@/lib/blog-data";

export default async function BlogIndexRoute() {
  const posts = await getBlogPosts();

  return (
    <main className="wrapper">
      <div className="container" style={{ padding: "16px" }}>
        <section className="card">
          <h1>Bai viet</h1>
          <div className="card-grid" id="postsGrid">
            {posts.map((post) => (
              <article key={post.slug} className="card">
                {post.cover ? (
                  <div className="card-media">
                    <img
                      src={post.cover}
                      alt={`${post.title} cover`}
                      loading="lazy"
                    />
                  </div>
                ) : null}

                <div className="card-top">
                  <p className="card-title">{post.title}</p>
                  <span className="chip">{post.tag || "Update"}</span>
                </div>
                <p className="card-desc">{post.desc}</p>
                <div className="meta">{post.date || ""}</div>
                <div className="card-actions">
                  <a className="link" href={`/blog/${encodeURIComponent(post.slug)}`}>
                    Doc bai <i className="fa-solid fa-arrow-right"></i>
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
