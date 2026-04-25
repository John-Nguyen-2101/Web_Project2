"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const homeActive = isActive(pathname, "/");
  const toolsActive = isActive(pathname, "/tools");
  const aboutActive = isActive(pathname, "/about");

  const closeMenu = () => setIsOpen(false);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="logo" href="/" onClick={closeMenu}>
          Lufe Audio
        </Link>

        <nav className="nav">
          <Link className={homeActive ? "btn btn-small" : ""} href="/">
            Trang chủ
          </Link>
          <Link className={toolsActive ? "btn btn-small" : ""} href="/tools">
            Tools
          </Link>
          <Link className={aboutActive ? "btn btn-small" : ""} href="/about">
            About creator
          </Link>
        </nav>

        <button
          className="nav-toggle"
          aria-label={isOpen ? "Đóng menu" : "Mở menu"}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      <div className={`mobile-nav${isOpen ? " is-open" : ""}`}>
        <Link href="/" onClick={closeMenu}>
          Trang chủ
        </Link>
        <Link href="/tools" onClick={closeMenu}>
          Tools
        </Link>
        <Link href="/about" onClick={closeMenu}>
          About creator
        </Link>
      </div>
    </header>
  );
}
