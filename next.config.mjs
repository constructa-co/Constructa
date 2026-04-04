/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep PDF/DOCX libs out of the webpack bundle — server actions only.
    serverComponentsExternalPackages: ["unpdf", "mammoth"],
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
