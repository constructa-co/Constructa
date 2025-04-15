import './globals.css';
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import Script from 'next/script';
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Constructa",
  description: "AI-powered construction management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script
          defer
          data-domain="constructa.co"
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
        <Script id="plausible-events" strategy="afterInteractive">
          {`window.plausible = window.plausible || function() { (window.plausible.q = window.plausible.q || []).push(arguments) }`}
        </Script>
      </head>
      <body className={`${inter.className} bg-black text-white antialiased`}>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}