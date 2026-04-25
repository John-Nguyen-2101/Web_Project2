import { notFound } from "next/navigation";

import { getPostBySlug } from "@/lib/site-data";

type BlogPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function BlogPostRoute({ params }: BlogPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <main className="wrapper">
      <div className="container" style={{ padding: "16px" }}>
        <article className="card">
          <h1>{post.title}</h1>
          <div className="meta">{post.date || ""}</div>
          <div
            className="content"
            dangerouslySetInnerHTML={{ __html: post.content || "" }}
          />
        </article>
      </div>
    </main>
  );
}
