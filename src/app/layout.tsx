import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body className="bg-black text-white">
        {/* Header Section */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-gray-800/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <div>
                <a href="/" className="text-2xl font-bold text-white whitespace-nowrap">
                  CONSTRUCTA
                </a>
              </div>

              {/* Navigation */}
              <nav className="hidden md:flex items-center space-x-12">
                <a href="#features" className="text-gray-300 hover:text-white transition-colors duration-200 whitespace-nowrap">Features</a>
                <a href="#pricing" className="text-gray-300 hover:text-white transition-colors duration-200 whitespace-nowrap">Pricing</a>
                <a href="#about" className="text-gray-300 hover:text-white transition-colors duration-200 whitespace-nowrap">About</a>
                <a href="#contact" className="text-gray-300 hover:text-white transition-colors duration-200 whitespace-nowrap">Contact</a>
              </nav>

              {/* Auth Buttons */}
              <div className="flex items-center space-x-4">
                <button className="px-4 py-2 text-gray-300 hover:text-white transition-colors duration-200 whitespace-nowrap">
                  Log in
                </button>
                <button className="px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors duration-300 whitespace-nowrap">
                  Sign up
                </button>
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
              <p>Email: <a href="mailto:hello@constructa.co" className="text-orange-500 hover:text-orange-400 transition-colors">hello@constructa.co</a></p>
              <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-400 transition-colors">
                LinkedIn
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}