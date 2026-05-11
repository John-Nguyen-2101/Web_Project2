import {
  getProfileBySlug,
  getProfileSocialLinks,
} from "@/lib/profile-data";

type ProfilePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function getSocialLabel(platform: string, label?: string | null) {
  if (label) {
    return label;
  }

  return platform
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Link";
}

export default async function ProfileRoute({ params }: ProfilePageProps) {
  const { slug } = await params;
  const profile = await getProfileBySlug(slug);
  const socialLinks = profile ? await getProfileSocialLinks(profile.id) : [];

  if (!profile) {
    return (
      <main className="wrapper">
        <div className="container" style={{ padding: "16px" }}>
          <article className="card">
            <h1>Profile not available</h1>
            <p className="card-desc">
              This profile is missing or is not public yet.
            </p>
          </article>
        </div>
      </main>
    );
  }

  return (
    <main className="wrapper">
      <div className="container" style={{ padding: "16px" }}>
        <article className="card">
          {profile.avatarUrl ? (
            <div className="card-media">
              <img
                src={profile.avatarUrl}
                alt={`${profile.displayName} avatar`}
                loading="lazy"
              />
            </div>
          ) : null}

          <h1>{profile.displayName}</h1>
          {profile.username ? (
            <div className="meta">@{profile.username}</div>
          ) : null}

          {profile.bio ? <p className="card-desc">{profile.bio}</p> : null}

          {socialLinks.length ? (
            <div className="card-actions">
              {socialLinks.map((link) => (
                <a
                  key={link.id}
                  className="link"
                  href={link.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {getSocialLabel(link.platform, link.label)}
                </a>
              ))}
            </div>
          ) : null}
        </article>
      </div>
    </main>
  );
}
