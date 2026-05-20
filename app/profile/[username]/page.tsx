import {
  getProfileSongs,
  getProfileSocialLinks,
  getPublicProfileByUsername,
} from "@/lib/profile-data";
import type { ProfileSong } from "@/lib/profile-data";

type ProfilePageProps = {
  params: Promise<{
    username: string;
  }>;
};

function getFallbackInitial(displayName: string, username: string | null) {
  return (displayName || username || "P").trim().charAt(0).toUpperCase();
}

function getSocialLabel(platform: string, label?: string | null) {
  if (label) {
    return label;
  }

  return (
    platform
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || "Link"
  );
}

function ProfileNotFound() {
  return (
    <main className="wrapper profile-page">
      <div className="container profile-container">
        <article className="card profile-card profile-card-empty">
          <div className="profile-kicker">Public Creator Profile</div>
          <h1>Profile not available</h1>
          <p className="card-desc">
            This profile could not be found, or it is not public yet.
          </p>
        </article>
      </div>
    </main>
  );
}

function ProfileSongsSection({
  displayName,
  songs,
}: {
  displayName: string;
  songs: ProfileSong[];
}) {
  return (
    <section className="card profile-songs-card">
      <div className="profile-songs-head">
        <div>
          <p className="profile-section-kicker">Songs</p>
          <h2>Songs by {displayName}</h2>
        </div>
        <span className="chip">
          {songs.length} {songs.length === 1 ? "song" : "songs"}
        </span>
      </div>

      {songs.length ? (
        <div className="profile-song-list">
          {songs.map((song) => (
            <a
              key={song.id}
              className="profile-song-item"
              href={`/chords/${encodeURIComponent(song.linkId)}`}
            >
              <div>
                <h3>{song.title}</h3>
                <p>
                  {[song.authorName, song.style, song.rhythm, song.timeSignature]
                    .filter(Boolean)
                    .join(" | ")}
                </p>
              </div>
              <span>Open chords</span>
            </a>
          ))}
        </div>
      ) : (
        <p className="profile-empty">
          Public songs from this creator will appear here soon.
        </p>
      )}
    </section>
  );
}

export default async function PublicProfileRoute({
  params,
}: ProfilePageProps) {
  const { username } = await params;
  const profile = await getPublicProfileByUsername(username);
  const [socialLinks, songs] = profile
    ? await Promise.all([
        getProfileSocialLinks(profile.id),
        getProfileSongs(profile.id),
      ])
    : [[], []];

  if (!profile) {
    return <ProfileNotFound />;
  }

  return (
    <main className="wrapper profile-page">
      <div className="container profile-container">
        <article className="card profile-card">
          <div className="profile-banner" aria-hidden="true" />

          <div className="profile-body">
            <div className="profile-avatar" aria-hidden="true">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" loading="lazy" />
              ) : (
                <span>
                  {getFallbackInitial(profile.displayName, profile.username)}
                </span>
              )}
            </div>

            <div className="profile-kicker">Public Creator Profile</div>

            <h1>{profile.displayName}</h1>

            {profile.username ? (
              <div className="meta profile-username">@{profile.username}</div>
            ) : null}

            {profile.bio ? <p className="profile-bio">{profile.bio}</p> : null}

            <div className="card-actions profile-links">
              {profile.websiteUrl ? (
                <a
                  className="link profile-link"
                  href={profile.websiteUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Website
                </a>
              ) : null}

              {socialLinks.map((link) => (
                <a
                  key={link.id}
                  className="link profile-link"
                  href={link.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {getSocialLabel(link.platform, link.label)}
                </a>
              ))}
            </div>
          </div>

        </article>

        <ProfileSongsSection displayName={profile.displayName} songs={songs} />
      </div>
    </main>
  );
}
