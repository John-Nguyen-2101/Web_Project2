import { getPosts } from "@/lib/site-data";
import { getProfileById } from "@/lib/profile-data";
import type { BlogPost, ContentOwnerProfile } from "@/lib/site-shared";
import { supabaseRead } from "@/lib/supabase-server";

type SupabaseBlogPost = {
  id: string;
  legacy_post_id: number | null;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  content_html: string;
  author_id: string | null;
  published_at: string | null;
};

type SupabaseBlogTagJoin = {
  blog_tags: {
    name: string | null;
  } | null;
};

function formatBlogDate(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function toBlogPost(
  row: SupabaseBlogPost,
  tagJoins: SupabaseBlogTagJoin[] = [],
  authorProfile?: ContentOwnerProfile,
): BlogPost {
  const tagNames = tagJoins
    .map((join) => join.blog_tags?.name || "")
    .filter(Boolean);

  return {
    id: row.legacy_post_id ?? 0,
    slug: row.slug,
    title: row.title,
    desc: row.excerpt || "",
    date: formatBlogDate(row.published_at),
    tag: tagNames.join(", "),
    cover: row.cover_image_url || undefined,
    content: row.content_html || "",
    authorProfile,
  };
}

async function getSupabaseBlogPosts() {
  const rows = await supabaseRead<SupabaseBlogPost[]>("blog_posts", {
    query: {
      select:
        "id,legacy_post_id,slug,title,excerpt,cover_image_url,content_html,author_id,published_at",
      status: "eq.published",
      order: "published_at.desc.nullslast,created_at.desc",
    },
  });

  if (!rows.length) {
    return [];
  }

  const postIds = rows.map((row) => row.id);
  const tagRows = await supabaseRead<
    Array<SupabaseBlogTagJoin & { post_id: string }>
  >("blog_post_tags", {
    query: {
      select: "post_id,blog_tags(name)",
      post_id: `in.(${postIds.join(",")})`,
    },
  });

  const tagsByPostId = new Map<string, SupabaseBlogTagJoin[]>();

  for (const tagRow of tagRows) {
    const existing = tagsByPostId.get(tagRow.post_id) || [];
    existing.push(tagRow);
    tagsByPostId.set(tagRow.post_id, existing);
  }

  return rows.map((row) => toBlogPost(row, tagsByPostId.get(row.id)));
}

async function getSupabaseBlogPostBySlug(slug: string) {
  const rows = await supabaseRead<SupabaseBlogPost[]>("blog_posts", {
    query: {
      select:
        "id,legacy_post_id,slug,title,excerpt,cover_image_url,content_html,author_id,published_at",
      slug: `eq.${slug}`,
      status: "eq.published",
      limit: "1",
    },
  });

  const row = rows[0];

  if (!row) {
    return null;
  }

  const tagRows = await supabaseRead<SupabaseBlogTagJoin[]>("blog_post_tags", {
    query: {
      select: "blog_tags(name)",
      post_id: `eq.${row.id}`,
    },
  });

  const authorProfile = row.author_id
    ? await getProfileById(row.author_id)
    : null;

  return toBlogPost(row, tagRows, authorProfile || undefined);
}

export async function getBlogPosts() {
  try {
    const posts = await getSupabaseBlogPosts();

    if (posts.length) {
      return posts;
    }
  } catch (error) {
    console.warn(
      "Supabase blog read failed; falling back to local posts.json.",
      error,
    );
  }

  return getPosts();
}

export async function getBlogPostBySlug(slug: string) {
  try {
    const post = await getSupabaseBlogPostBySlug(slug);

    if (post) {
      return post;
    }
  } catch (error) {
    console.warn(
      "Supabase blog post read failed; falling back to local posts.json.",
      error,
    );
  }

  const posts = await getPosts();
  return posts.find((post) => post.slug === slug) ?? null;
}
