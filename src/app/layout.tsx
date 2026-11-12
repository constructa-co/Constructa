import './globals.css';
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import Script from 'next/script';
import PublicChrome from '@/components/public-chrome';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Constructa",
  description: "AI-powered construction management platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Constructa",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default async function RootLayout(
  {
    children,
  }: Readonly<{
    children: React.ReactNode;
  }>
) {
  const review = process.env.CONSTRUCTA_REVIEW_ONLY === '1';
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#2563eb" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
        {!review && <Script id="sw-register" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js'); }`}
        </Script>}
      </head>
      <body className={`${inter.className} bg-black text-white antialiased`}>
        {review && <aside className="bg-emerald-950 px-4 py-3 text-center text-sm text-emerald-100">{process.env.CONSTRUCTA_REVIEW_EDITABLE === '1' ? 'Protected backend test. Only the two existing QA jobs are editable. AI, uploads, deletion, publishing and sending are disabled. Do not enter real client data.' : 'Protected work-in-progress review. Test data only. Saving, AI, uploads and sending are disabled.'}</aside>}
        <PublicChrome>{children}</PublicChrome>
      </body>
    </html>
  );
}
