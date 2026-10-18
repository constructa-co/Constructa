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
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#2563eb" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
        <Script id="sw-register" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js'); }`}
        </Script>
        <Script
          defer
          data-domain="constructa.co"
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
        <Script id="plausible-events" strategy="afterInteractive">
          {`window.plausible = window.plausible || function() { (window.plausible.q = window.plausible.q || []).push(arguments) }`}
        </Script>
        <Script id="clarity-script" strategy="afterInteractive">
          {`
            (function() {
              const hostname = window.location.hostname;
              const projectId = hostname === 'constructa.co' ? 'r4mocnetxs' : 'r4msf8pw3w';
              
              (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", projectId);
            })();
          `}
        </Script>
      </head>
      <body className={`${inter.className} bg-black text-white antialiased`}>
        <PublicChrome>{children}</PublicChrome>
      </body>
    </html>
  );
}
