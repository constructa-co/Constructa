import { assertSupabaseTarget } from "./src/lib/deployment/supabase-target.mjs";

// A preview or E2E build, or a server started from one, stops here if it is
// pointed at the production database or has no disposable project of its
// own. This file is loaded by every `next build` and `next start`, so the
// check cannot be skipped by changing the build command. Production is never
// checked. See DEVELOPMENT.md, "Preview and E2E database isolation".
assertSupabaseTarget(process.env);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep PDF/DOCX libs out of the server bundle.
  serverExternalPackages: ["unpdf", "mammoth"],
  experimental: {
    // Drawing AI Takeoff: up to 10 base64 JPEG pages (~2-4 MB each)
    // Video Walkthrough: 20 extracted JPEG frames (~0.5 MB each) — raw video never sent
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
};

export default nextConfig;
