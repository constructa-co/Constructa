'use client';

import './globals.css';
import { Inter } from "next/font/google";
import { useState } from "react";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <html lang="en">
      <head />
      <body className={`${inter.className} bg-black text-white`}>
        {/* Fixed Header */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Left column - Logo */}
              <div className="flex-shrink-0">
                <a href="/" className="text-white text-xl font-bold">
                  CONSTRUCTA
                </a>
              </div>

              {/* Center column - Navigation (Desktop) */}
              <nav className="hidden md:flex justify-center">
                <div className="flex items-center space-x-8">
                  <a href="#features" className="text-gray-500 hover:text-gray-300 transition-colors duration-200">Features</a>
                  <a href="#pricing" className="text-gray-500 hover:text-gray-300 transition-colors duration-200">Pricing</a>
                  <a href="#about" className="text-gray-500 hover:text-gray-300 transition-colors duration-200">About</a>
                  <a href="#contact" className="text-gray-500 hover:text-gray-300 transition-colors duration-200">Contact</a>
                </div>
              </nav>

              {/* Right column - Auth buttons */}
              <div className="flex items-center space-x-4">
                {/* Mobile menu button */}
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none"
                >
                  <span className="sr-only">Open main menu</span>
                  <svg
                    className="h-6 w-6"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                    />
                  </svg>
                </button>

                {/* Desktop auth buttons */}
                <div className="hidden md:flex items-center space-x-4">
                  <a
                    href="#login"
                    className="text-gray-300 hover:text-white transition-colors duration-200"
                  >
                    Log in
                  </a>
                  <a
                    href="#signup"
                    className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-100 transition-colors duration-200"
                  >
                    Sign up
                  </a>
                </div>
              </div>
            </div>

            {/* Mobile menu */}
            <div className={`md:hidden ${isMenuOpen ? 'block' : 'hidden'}`}>
              <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                <a href="#features" className="block px-3 py-2 text-gray-300 hover:text-white">Features</a>
                <a href="#pricing" className="block px-3 py-2 text-gray-300 hover:text-white">Pricing</a>
                <a href="#about" className="block px-3 py-2 text-gray-300 hover:text-white">About</a>
                <a href="#contact" className="block px-3 py-2 text-gray-300 hover:text-white">Contact</a>
                <div className="pt-4 space-y-2">
                  <a href="#login" className="block px-3 py-2 text-gray-300 hover:text-white">Log in</a>
                  <a href="#signup" className="block px-3 py-2 bg-white text-black rounded-md hover:bg-gray-100">Sign up</a>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Section */}
        {children}

        {/* Footer Section */}
        <footer className="bg-black text-white p-10">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-center">
              <div className="text-center sm:text-left">
                <p>Constructa © 2025</p>
                <p>Made for construction professionals.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 mt-4 sm:mt-0">
                <a href="#product" className="hover:text-orange-500 transition-colors">Product</a>
                <a href="#features" className="hover:text-orange-500 transition-colors">Features</a>
                <a href="#pricing" className="hover:text-orange-500 transition-colors">Pricing</a>
                <a href="#contact" className="hover:text-orange-500 transition-colors">Contact</a>
              </div>
            </div>
            <div className="text-center mt-6">
              <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                LinkedIn
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}