const socialLinks = [
  {
    href: "https://www.facebook.com/guitaristVN/",
    icon: "fa fa1 fa-brands fa-facebook",
    label: "Facebook",
  },
  {
    href: "https://www.tiktok.com/@jblufe.studio",
    icon: "fa fa2 fa-brands fa-tiktok",
    label: "TikTok",
  },
  {
    href: "https://www.instagram.com/jb_lufe.audio/",
    icon: "fa fa3 fa-brands fa-instagram",
    label: "Instagram",
  },
  {
    href: "https://www.youtube.com/@lufeaudio1526",
    icon: "fa fa4 fa-brands fa-youtube",
    label: "YouTube",
  },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <p>© Copyright by Lufe Audio</p>
        <div className="footer-links">
          {socialLinks.map((item) => (
            <a key={item.href} href={item.href} aria-label={item.label}>
              <i className={item.icon}></i>
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
