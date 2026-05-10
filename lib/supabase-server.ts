type SupabaseServerConfig = {
  url: string;
  anonKey: string;
};

function getPublicAnonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ""
  );
}

export function getSupabaseServerReadConfig(): SupabaseServerConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = getPublicAnonKey();
  const missing = [];

  if (!url) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!anonKey) {
    missing.push(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLIC_KEY",
    );
  }

  if (missing.length) {
    throw new Error(
      `Missing Supabase read environment variable(s): ${missing.join(", ")}`,
    );
  }

  return {
    url: url.replace(/\/+$/, ""),
    anonKey,
  };
}

export async function supabaseRead<T>(
  pathname: string,
  options: {
    query?: Record<string, string>;
  } = {},
) {
  const config = getSupabaseServerReadConfig();
  const url = new URL(`${config.url}/rest/v1/${pathname}`);

  for (const [key, value] of Object.entries(options.query || {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? String(data.message)
        : text || response.statusText;

    throw new Error(`Supabase read failed: ${message}`);
  }

  return data as T;
}
