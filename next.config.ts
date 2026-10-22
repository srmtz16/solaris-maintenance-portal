import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // PDFKit loads standard font modules dynamically; include them in serverless bundles.
  outputFileTracingIncludes: {
    "/api/energy-reports": ["./node_modules/pdfkit/js/standard-fonts/**/*"],
    "/api/energy-reports/**": ["./node_modules/pdfkit/js/standard-fonts/**/*"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
      ] },
      ...["/admin/:path*", "/consulta", "/s/:path*", "/q/:path*", "/api/:path*"].map(source => ({ source, headers: [
        { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        { key: "Cache-Control", value: "private, no-store, max-age=0" },
      ] })),
    ];
  },
};

export default nextConfig;
