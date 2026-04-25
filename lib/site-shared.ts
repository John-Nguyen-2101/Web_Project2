export type SocialLink = {
  name: string;
  icon: string;
  link: string;
};

export type DonateInfo = {
  bankName: string;
  bankOwner: string;
  bankNumber: string;
};

export type ToolCard = {
  title: string;
  desc: string;
  status?: string;
  chip?: string;
  link: string;
};

export type Album = {
  type?: string;
  title: string;
  desc: string;
  chip?: string;
  link: string;
  cover?: string;
};

export type Product = {
  title: string;
  desc: string;
  chip?: string;
  link: string;
};

export type PostSummary = {
  title: string;
  desc: string;
  chip?: string;
  link: string;
};

export type SiteData = {
  social: SocialLink[];
  donate: DonateInfo;
  tools: ToolCard[];
  albums: Album[];
  products: Product[];
  posts: PostSummary[];
};

export type BlogPost = {
  id: number;
  slug: string;
  title: string;
  desc: string;
  date: string;
  tag: string;
  cover?: string;
  content: string;
};

export type SongListItem = {
  id: string;
  title: string;
  author: string;
  bpm: number;
  timeSig: string;
  views: number;
};

export function extractSlugFromLegacyLink(link?: string) {
  if (!link) {
    return "";
  }

  try {
    const url = new URL(link, "https://local.lufe");
    return url.searchParams.get("slug") || "";
  } catch {
    return "";
  }
}

export function normalizeText(text: string) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function formatViews(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

export function getSocialClassName(name: string) {
  const normalized = name.toLowerCase();

  if (normalized.includes("facebook") || normalized.includes("fb")) {
    return "facebook";
  }

  if (normalized.includes("tiktok") || normalized.includes("tt")) {
    return "tiktok";
  }

  if (normalized.includes("youtube") || normalized.includes("yt")) {
    return "youtube";
  }

  if (
    normalized.includes("instagram") ||
    normalized.includes("insta") ||
    normalized.includes("ig")
  ) {
    return "instagram";
  }

  return "other";
}
