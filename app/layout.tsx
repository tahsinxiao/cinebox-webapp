import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://well-cinebox.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "well-cinebox — Free Movie & Series Streaming",
    template: "%s · well-cinebox",
  },
  description:
    "well-cinebox is a free movie and series streaming webapp. Browse thousands of films and shows, in HD, with a cinematic HBO Max-style experience.",
  applicationName: "well-cinebox",
  keywords: ["free movies", "free series", "streaming", "watch online", "well-cinebox", "moviebox"],
  openGraph: {
    type: "website",
    siteName: "well-cinebox",
    title: "well-cinebox — Free Movie & Series Streaming",
    description: "Thousands of movies and series. Free. No sign-up.",
    url: siteUrl,
  },
  twitter: { card: "summary_large_image", title: "well-cinebox", description: "Free Movie & Series Streaming Webapp" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#05050a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh font-sans">
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
