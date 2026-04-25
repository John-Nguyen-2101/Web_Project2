"use client";

import { useState } from "react";

import {
  extractSlugFromLegacyLink,
  getSocialClassName,
} from "@/lib/site-shared";
import type { Album, SiteData } from "@/lib/site-shared";

type AboutPageProps = {
  siteData: SiteData;
};

function AlbumCard({ album }: { album: Album }) {
  return (
    <div className="card">
      {album.cover ? (
        <div className="card-media">
          <img src={album.cover} alt={`${album.title} cover`} loading="lazy" />
        </div>
      ) : null}

      <div className="card-top">
        <p className="card-title">{album.title}</p>
        <span className="chip">{album.chip || "Single"}</span>
      </div>
      <p className="card-desc">{album.desc}</p>
      <div className="card-actions">
        <a className="link" href={album.link || "#"}>
          Nghe <i className="fa-solid fa-arrow-right"></i>
        </a>
      </div>
    </div>
  );
}

export function AboutPage({ siteData }: AboutPageProps) {
  const [copyHint, setCopyHint] = useState("");

  const normalizeToolLink = (link: string) => {
    return link.includes("/Tools/index.html") ? "/tools" : link;
  };

  const handleCopy = async () => {
    const donate = siteData.donate;
    const text = [
      `Ngân hàng: ${donate?.bankName || ""}`,
      `Chủ TK: ${donate?.bankOwner || ""}`,
      `Số TK: ${donate?.bankNumber || ""}`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopyHint("✅ Đã copy thông tin donate!");
    } catch {
      setCopyHint("⚠️ Không copy được. Bạn có thể copy thủ công.");
    }

    window.setTimeout(() => setCopyHint(""), 2500);
  };

  return (
    <main>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-left">
            <p className="badge">Music • Guitar • Education</p>

            <h1 className="hero-title">
              Xin chào, mình là <span className="accent">John Thanh Lịch</span>{" "}
              (Jb Lufe)
            </h1>

            <p className="hero-subtitle">
              Mình làm nhạc và xây tool giúp mọi người học nhạc dễ hơn: tra cứu
              hợp âm + metronome, luyện tai nghe, mixing/master, piano... (đang
              update dần).
            </p>

            <div className="hero-cta">
              <a className="btn" href="/tools">
                Xem tools
              </a>
              <a className="btn btn-ghost" href="/Data/songs/Smart-link-page.html">
                Nghe bài nổi bật
              </a>
            </div>
          </div>

          <div className="hero-right">
            <article className="hero-card">
              <div className="hero-card-top">
                <div className="avatar" aria-hidden="true">
                  <img
                    className="profile-img"
                    src="/IMG/Picture1.jpg"
                    alt="John Thanh Lịch"
                  />
                  J
                </div>

                <div>
                  <div className="hero-card-name">John Thanh Lich • Lufe Audio</div>
                  <p className="hero-card-mini">
                    Creator / Music Producer / Software Engineer
                  </p>
                </div>
              </div>

              <div className="stat-grid">
                <span className="social-label">Kết nối:</span>
                <div className="social-icons" id="socialIcons">
                  {siteData.social.map((social) => (
                    <a
                      key={social.link}
                      className={`icon-btn ${getSocialClassName(social.name)}`}
                      href={social.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.name}
                    >
                      <i className={social.icon}></i>
                    </a>
                  ))}
                </div>
              </div>

              <div className="hero-note">
                <p>
                  Mục tiêu: biến học nhạc thành “Đơn giản hóa + có tool trực
                  quan + có bài tập” thay vì mò mẫm lý thuyết một cách khô khan.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="section" id="tools">
        <div className="container">
          <div className="section-head">
            <h2>Tools mình đang cung cấp</h2>
            <p className="muted">Các công cụ giúp học nhạc dễ hơn</p>
          </div>
          <div className="card-grid" id="toolsGrid">
            {siteData.tools.map((tool) => (
              <div key={tool.title} className="card">
                <div className="card-top">
                  <p className="card-title">{tool.title}</p>
                  <span className="chip">{tool.status || "Update"}</span>
                </div>
                <p className="card-desc">{tool.desc}</p>
                <div className="card-actions">
                  <a className="link" href={normalizeToolLink(tool.link || "#")}>
                    Mở tool <i className="fa-solid fa-arrow-right"></i>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt" id="albums">
        <div className="container">
          <div className="section-head">
            <h2>Âm nhạc của mình</h2>
          </div>
          <div className="card-grid" id="albumsGrid">
            {siteData.albums.map((album) => (
              <AlbumCard key={album.title} album={album} />
            ))}
          </div>
        </div>
      </section>

      <section className="section alt" id="posts">
        <div className="container">
          <div className="section-head">
            <h2>Bài viết (Blog)</h2>
          </div>
          <div className="card-grid" id="postsGrid">
            {siteData.posts.map((post) => {
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

      <section className="section" id="donate">
        <div className="container">
          <div className="donate">
            <div className="donate-left">
              <h2>Ủng hộ (Donate)</h2>
              <p className="muted">
                Nếu tool & bài viết hữu ích, anh em có thể ủng hộ để mình duy
                trì dự án.
              </p>

              <div className="donate-box">
                <div className="donate-row">
                  <span className="donate-label">Ngân hàng:</span>
                  <span className="donate-value">{siteData.donate?.bankName || "—"}</span>
                </div>
                <div className="donate-row">
                  <span className="donate-label">Chủ tài khoản:</span>
                  <span className="donate-value">
                    {siteData.donate?.bankOwner || "—"}
                  </span>
                </div>
                <div className="donate-row">
                  <span className="donate-label">Số tài khoản:</span>
                  <span className="donate-value">
                    {siteData.donate?.bankNumber || "—"}
                  </span>
                </div>

                <button className="btn btn-ghost" onClick={handleCopy} type="button">
                  Copy thông tin
                </button>
                <p className="hint">{copyHint}</p>
              </div>
            </div>

            <div className="donate-right">
              <div className="qr-mock">
                <p className="qr-title">QR ngân hàng</p>
                <img
                  className="qr-img"
                  src="/IMG/QR.png"
                  alt="QR chuyển khoản ngân hàng"
                  loading="lazy"
                />
                <p className="muted small">Quét QR để chuyển khoản nhanh.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
