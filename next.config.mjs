/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep PDF/DOCX libs out of the webpack bundle — server actions only.
    serverComponentsExternalPackages: ["unpdf", "mammoth"],
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
