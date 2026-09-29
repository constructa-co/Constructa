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
