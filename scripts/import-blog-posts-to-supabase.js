const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");
const IMPORT = process.argv.includes("--import");

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_IMPORT_USER_ID",
];

function loadLocalEnv() {
  const envPath = path.join(PROJECT_ROOT, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);

    if (!match) {
      continue;
    }

    const key = match[1];
    let value = match[2].trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function requireEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(
      [
        "Missing required Supabase environment variables:",
        ...missing.map((key) => `- ${key}`),
        "",
        "The service role key must stay server-only and must never be used in client code.",
        "SUPABASE_IMPORT_USER_ID is used as blog_posts.author_id.",
      ].join("\n"),
    );
  }
}

function slugify(value) {
  return (
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "tag"
  );
}

function readPosts() {
  const filePath = path.join(PROJECT_ROOT, "Data", "posts.json");

  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing local blog data file: ${filePath}`);
  }

  const posts = JSON.parse(fs.readFileSync(filePath, "utf8"));

  if (!Array.isArray(posts)) {
    throw new Error("Data/posts.json must be a JSON array.");
  }

  return posts;
}

function parseLocalDate(value) {
  const match = String(value || "").match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);

  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00.000Z`;
}

function normalizeCover(value) {
  if (!value) {
    return null;
  }

  return String(value)
    .replace(/^\.\.\/\.\.\//, "/")
    .replace(/^\.\.\//, "/")
    .replace(/^IMG\//, "/IMG/");
}

function validatePost(post) {
  for (const key of ["id", "slug", "title", "content"]) {
    if (post[key] === undefined || post[key] === null || post[key] === "") {
      throw new Error(`Blog post is missing required field: ${key}`);
    }
  }
}

function toPostRow(post) {
  validatePost(post);

  const now = new Date().toISOString();

  return {
    legacy_post_id: Number(post.id),
    slug: String(post.slug),
    title: String(post.title),
    excerpt: post.desc || null,
    cover_image_url: normalizeCover(post.cover),
    content_html: String(post.content),
    content_json: null,
    author_id: process.env.SUPABASE_IMPORT_USER_ID,
    status: "published",
    published_at: parseLocalDate(post.date),
    created_at: now,
    updated_at: now,
  };
}

function toTagRows(posts) {
  const bySlug = new Map();

  for (const post of posts) {
    if (!post.tag) {
      continue;
    }

    const name = String(post.tag);
    bySlug.set(slugify(name), {
      slug: slugify(name),
      name,
    });
  }

  return [...bySlug.values()];
}

async function supabaseRequest(pathname, options = {}) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "");
  const url = new URL(`${baseUrl}/rest/v1/${pathname}`);

  for (const [key, value] of Object.entries(options.query || {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data && data.message ? data.message : text || response.statusText;
    throw new Error(`Supabase ${options.method || "GET"} ${pathname} failed: ${message}`);
  }

  return data;
}

async function importPosts(postRows) {
  return supabaseRequest("blog_posts", {
    method: "POST",
    query: { on_conflict: "legacy_post_id" },
    prefer: "resolution=merge-duplicates,return=representation",
    body: postRows,
  });
}

async function importTags(tagRows) {
  if (!tagRows.length) {
    return [];
  }

  return supabaseRequest("blog_tags", {
    method: "POST",
    query: { on_conflict: "slug" },
    prefer: "resolution=merge-duplicates,return=representation",
    body: tagRows,
  });
}

async function importPostTags(posts, importedPosts, importedTags) {
  const postsByLegacyId = new Map(
    importedPosts.map((post) => [Number(post.legacy_post_id), post]),
  );
  const tagsBySlug = new Map(importedTags.map((tag) => [tag.slug, tag]));
  const rows = [];

  for (const post of posts) {
    const importedPost = postsByLegacyId.get(Number(post.id));
    const importedTag = tagsBySlug.get(slugify(post.tag));

    if (importedPost && importedTag) {
      rows.push({
        post_id: importedPost.id,
        tag_id: importedTag.id,
      });
    }
  }

  if (!rows.length) {
    return [];
  }

  return supabaseRequest("blog_post_tags", {
    method: "POST",
    query: { on_conflict: "post_id,tag_id" },
    prefer: "resolution=ignore-duplicates,return=representation",
    body: rows,
  });
}

async function main() {
  loadLocalEnv();
  requireEnv();

  const posts = readPosts();
  const postRows = posts.map(toPostRow);
  const tagRows = toTagRows(posts);

  if (!IMPORT || DRY_RUN) {
    console.log("Supabase blog import dry run complete. No network request was made.");
    console.log(
      JSON.stringify(
        {
          posts_read: posts.length,
          tags_read: tagRows.length,
          payload: {
            blog_posts: postRows,
            blog_tags: tagRows,
            blog_post_tags: posts
              .filter((post) => post.tag)
              .map((post) => ({
                legacy_post_id: Number(post.id),
                tag_slug: slugify(post.tag),
              })),
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`Preparing to import ${postRows.length} blog post(s).`);

  const importedPosts = await importPosts(postRows);
  const importedTags = await importTags(tagRows);
  const importedPostTags = await importPostTags(posts, importedPosts, importedTags);

  console.log("Supabase blog import complete.");
  console.log(
    JSON.stringify(
      {
        posts_read: posts.length,
        tags_read: tagRows.length,
        blog_posts_upserted: importedPosts.length,
        blog_tags_upserted: importedTags.length,
        blog_post_tags_inserted: importedPostTags.length,
        imported_slugs: importedPosts.map((post) => post.slug),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Supabase blog import failed safely.");
  console.error(error.message);
  process.exitCode = 1;
});
