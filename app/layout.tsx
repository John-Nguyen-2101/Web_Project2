import type { Metadata } from "next";

import "../CSS/Main.css";
import "../CSS/community.css";
import "../CSS/Home.css";
import "../CSS/post.css";
import "../CSS/contact.css";
import "../CSS/metronome.css";
import "../CSS/chord.css";
import "./globals.css";

import { ScrollTopButton } from "@/components/scroll-top-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Lufe Audio",
  description: "Music learning platform by Lufe Audio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        />
      </head>
      <body>
        <div className="page-shell">
          <SiteHeader />
          {children}
          <SiteFooter />
          <ScrollTopButton />
        </div>
      </body>
    </html>
  );
}
