'use client';

import { useState } from 'react';
import FeatureDropdown from './FeatureDropdown';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 grid grid-cols-3 items-center">
          {/* Left column - Logo */}
          <div className="flex items-center">
            <a href="/" className="text-2xl font-semibold text-white hover:opacity-90 transition-opacity">
              CONSTRUCTA
            </a>
          </div>

          {/* Center column - Navigation (Desktop) */}
          <nav className="hidden md:flex justify-center">
            <div className="flex items-center space-x-8">
              <FeatureDropdown />
              <a href="#pricing" className="text-gray-500 hover:text-gray-300 transition-colors duration-200">Pricing</a>
              <a href="#about" className="text-gray-500 hover:text-gray-300 transition-colors duration-200">About</a>
              <a href="#contact" className="text-gray-500 hover:text-gray-300 transition-colors duration-200">Contact</a>
            </div>
          </nav>

          {/* Right column - Auth buttons and mobile menu */}
          <div className="flex items-center justify-end space-x-6">
            {/* Desktop auth buttons */}
            <div className="hidden md:flex items-center space-x-6">
              <a href="#login" className="text-gray-500 hover:text-gray-300 transition-colors duration-200">
                Log in
              </a>
              <a href="#signup" className="px-4 py-1.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors duration-200">
                Sign up
              </a>
            </div>

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
  );
};

export default Header; 