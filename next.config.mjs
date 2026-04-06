/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep PDF/DOCX libs out of the webpack bundle — server actions only.
    serverComponentsExternalPackages: ["unpdf", "mammoth"],
    // Drawing AI Takeoff sends up to 10 base64 JPEG pages per request (~2–4 MB each)
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
