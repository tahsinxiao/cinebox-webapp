/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The preview/dev server is proxied through *.e2b.app; allow it explicitly.
  allowedDevOrigins: ["*.e2b.app", "*.vercel.app", "localhost"],
  images: {
    // Artwork is served straight from the MovieBox CDN.
    remotePatterns: [
      { protocol: "https", hostname: "**.aoneroom.com" },
      { protocol: "https", hostname: "**.inmoviebox.com" },
      { protocol: "https", hostname: "**.moviebox.ng" },
      { protocol: "https", hostname: "**.cloudfront.net" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
