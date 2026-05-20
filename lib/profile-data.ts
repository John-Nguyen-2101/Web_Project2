import { supabaseRead } from "@/lib/supabase-server";

export type PublicProfile = {
  id: string;
  username: string | null;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  websiteUrl: string | null;
  isPublic: boolean;
};

export type Profile = PublicProfile;

export type ProfileSocialLink = {
  id: string;
  profileId: string;
  platform: string;
  label: string | null;
  url: string;
  sortOrder: number;
  isVisible: boolean;
};

type SupabaseProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  website_url: string | null;
  is_public: boolean | null;
};

type SupabaseProfileSocialLinkRow = {
  id: string;
  profile_id: string;
  platform: string | null;
  label: string | null;
  url: string | null;
  sort_order: number | null;
  is_visible: boolean | null;
};

function toProfile(row: SupabaseProfileRow): PublicProfile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username || "Profile",
    bio: row.bio || null,
    avatarUrl: row.avatar_url || null,
    websiteUrl: row.website_url || null,
    isPublic: row.is_public === true,
  };
}

function toSocialLink(row: SupabaseProfileSocialLinkRow): ProfileSocialLink {
  return {
    id: row.id,
    profileId: row.profile_id,
    platform: row.platform || "other",
    label: row.label || null,
    url: row.url || "",
    sortOrder: row.sort_order || 0,
    isVisible: row.is_visible === true,
  };
}

async function readProfileByQuery(query: Record<string, string>) {
  const rows = await supabaseRead<SupabaseProfileRow[]>("profiles", {
    query: {
      select: "id,username,display_name,bio,avatar_url,website_url,is_public",
      is_public: "eq.true",
      limit: "1",
      ...query,
    },
  });

  return rows[0] ? toProfile(rows[0]) : null;
}

export async function getPublicProfileByUsername(username: string) {
  try {
    return await readProfileByQuery({ username: `eq.${username}` });
  } catch (error) {
    console.warn("Supabase public profile username read failed.", error);
    return null;
  }
}

export async function getProfileById(id: string) {
  try {
    return await readProfileByQuery({ id: `eq.${id}` });
  } catch (error) {
    console.warn("Supabase profile read failed.", error);
    return null;
  }
}

export async function getProfileBySlug(slug: string) {
  try {
    const byUsername = await getPublicProfileByUsername(slug);

    if (byUsername) {
      return byUsername;
    }

    return await readProfileByQuery({ id: `eq.${slug}` });
  } catch (error) {
    console.warn("Supabase profile slug read failed.", error);
    return null;
  }
}

export async function getProfileSocialLinks(profileId: string) {
  try {
    const rows = await supabaseRead<SupabaseProfileSocialLinkRow[]>(
      "profile_social_links",
      {
        query: {
          select: "id,profile_id,platform,label,url,sort_order,is_visible",
          profile_id: `eq.${profileId}`,
          is_visible: "eq.true",
          order: "sort_order.asc,created_at.asc",
        },
      },
    );

    return rows.filter((row) => row.url).map(toSocialLink);
  } catch (error) {
    console.warn("Supabase profile social links read failed.", error);
    return [];
  }
}
