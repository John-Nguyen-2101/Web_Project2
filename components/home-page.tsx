"use client";

import { useMemo, useState } from "react";

import {
  extractSlugFromLegacyLink,
  formatViews,
  normalizeText,
} from "@/lib/site-shared";
import type { PostSummary, SongListItem } from "@/lib/site-shared";

type HomePageProps = {
  posts: PostSummary[];
  songs: SongListItem[];
};

function getRankSongs(songs: SongListItem[]) {
  const hasViews = songs.some((song) => Number(song.views || 0) > 0);
  const sorted = hasViews
    ? [...songs].sort((left, right) => Number(right.views || 0) - Number(left.views || 0))
    : [...songs];

  return sorted.slice(0, 3).map((song, index) => ({
    ...song,
    rank: index + 1,
  }));
}

export function HomePage({ posts, songs }: HomePageProps) {
  const [query, setQuery] = useState("");

  const filteredSongs = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    if (!normalizedQuery) {
      return songs;
    }

    return songs.filter((song) =>
      normalizeText(`${song.title} ${song.author}`).includes(normalizedQuery),
    );
  }, [query, songs]);

  const rankSongs = useMemo(() => getRankSongs(songs), [songs]);

  return (
    <main className="community-page">
      <section className="community-hero">
        <div className="container community-hero-grid">
          <div className="community-hero-left">
            <p className="community-kicker">Music learning platform</p>
            <h1>Tìm hợp âm, luyện nhịp, học nhạc dễ hơn</h1>
            <p className="community-lead">
              Một nơi để tra cứu hợp âm, mở bài hát nhanh, luyện tập với
              metronome và tiếp cận kiến thức âm nhạc theo hướng thực dụng.
            </p>

            <div className="community-search-wrap" id="songSearch">
              <div className="community-search">
                <input
                  id="songSearchInput"
                  type="text"
                  placeholder="Nhập tên bài hát hoặc ca sĩ..."
                  aria-label="Tìm bài hát"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <button id="btnSearch" type="button">
                  Tìm ngay
                </button>
              </div>
              <p className="search-note muted">
                Gõ tên bài hát, ca sĩ hoặc từ khóa để lọc danh sách ngay tại
                trang chủ.
              </p>
            </div>

            <div className="hero-links">
              <a className="hero-link" href="/tools">
                Mở metronome
              </a>
              <a className="hero-link" href="#short-lessons">
                Xem bài viết
              </a>
              <a className="hero-link" href="#song-rank">
                Xem top bài hát
              </a>
            </div>
          </div>

          <aside className="community-hero-right">
            <div className="community-panel">
              <div className="panel-head">
                <h2 style={{ color: "rgb(105, 103, 103)" }}>Danh sách bài hát</h2>
                <span className="muted small">{filteredSongs.length} bài</span>
              </div>

              <div id="songsList" className="songs-list">
                {filteredSongs.length ? (
                  filteredSongs.map((song) => (
                    <a
                      key={song.id}
                      className="listItem"
                      href={`/chords/${encodeURIComponent(song.id)}`}
                    >
                      <div className="listItemTitle">{song.title}</div>
                    </a>
                  ))
                ) : (
                  <div className="list-empty muted">
                    Không tìm thấy bài hát phù hợp.
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="community-strip" id="song-rank">
        <div className="container">
          <div className="section-head simple-head rank-head">
            <div>
              <p className="section-kicker">Song ranking</p>
              <h2>Bài hát được truy cập nhiều nhất</h2>
            </div>
          </div>

          <div className="strip-grid rank-grid" id="rankGrid">
            {rankSongs.map((song) => (
              <article
                key={song.id}
                className={`strip-card rank-card rank-${song.rank}`}
              >
                <div className="rank-top">
                  <span className="rank-badge">#{song.rank}</span>
                  <span className="rank-views">
                    {formatViews(song.views)} lượt truy cập
                  </span>
                </div>
                <h3>{song.title}</h3>
                <p>{song.author}</p>
                <a
                  className="link"
                  href={`/chords/${encodeURIComponent(song.id)}`}
                >
                  Mở hợp âm
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section community-section" id="guide">
        <div className="container">
          <div className="section-head simple-head">
            <div>
              <p className="section-kicker">How it works</p>
              <h2>Bắt đầu chỉ với 3 bước</h2>
            </div>
          </div>

          <div className="card-grid">
            <article className="card simple-card">
              <div className="card-top">
                <p className="card-title">1. Tìm bài hát</p>
                <span className="chip">Search</span>
              </div>
              <p className="card-desc">Nhập tên bài hát bạn quan tâm</p>
            </article>

            <article className="card simple-card">
              <div className="card-top">
                <p className="card-title">2. Mở chord page</p>
                <span className="chip">Practice</span>
              </div>
              <p className="card-desc">
                Bấm vào bài hát để mở trang hợp âm và bắt đầu luyện tập.
              </p>
            </article>

            <article className="card simple-card">
              <div className="card-top">
                <p className="card-title">3. Tập cùng metronome</p>
                <span className="chip">Routine</span>
              </div>
              <p className="card-desc">
                Chỉnh tempo phù hợp, tập chậm trước rồi nâng dần theo khả năng.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section community-section" id="posts">
        <div className="container">
          <div className="section-head simple-head">
            <div>
              <p className="section-kicker" id="short-lessons">
                Short lessons
              </p>
              <h2>Bài viết nổi bật</h2>
            </div>
          </div>

          <div className="card-grid" id="postsGrid">
            {posts.map((post) => {
              const slug = extractSlugFromLegacyLink(post.link);

              return (
                <div key={`${post.title}-${slug}`} className="card">
                  <div className="card-top">
                    <p className="card-title">{post.title}</p>
                    <span className="chip">{post.chip || "Update"}</span>
                  </div>
                  <p className="card-desc">{post.desc}</p>
                  <div className="card-actions">
                    <a className="link" href={slug ? `/blog/${slug}` : "#"}>
                      Đọc bài <i className="fa-solid fa-arrow-right"></i>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
