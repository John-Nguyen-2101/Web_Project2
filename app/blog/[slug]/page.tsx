import { notFound } from "next/navigation";

import { getBlogPostBySlug } from "@/lib/blog-data";

type BlogPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function BlogPostRoute({ params }: BlogPageProps) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <main className="wrapper">
      <div className="container" style={{ padding: "16px" }}>
        <article className="card">
          {post.cover ? (
            <div className="card-media">
              <img
                src={post.cover}
                alt={`${post.title} cover`}
                loading="lazy"
              />
            </div>
          ) : null}

          <h1>{post.title}</h1>
          <div className="meta">
            {[post.date, post.tag].filter(Boolean).join(" | ")}
          </div>
          {post.authorProfile ? (
            <div className="meta">
              Author:{" "}
              {post.authorProfile.username ? (
                <a href={`/profile/${encodeURIComponent(post.authorProfile.username)}`}>
                  {post.authorProfile.displayName}
                </a>
              ) : (
                post.authorProfile.displayName
              )}
            </div>
          ) : null}
          <div
            className="content"
            dangerouslySetInnerHTML={{ __html: post.content || "" }}
          />
        </article>
      </div>
    </main>
  );
}
