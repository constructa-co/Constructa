import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body className="bg-black text-white">
        {/* Header Section */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-gray-800/50">
          <div className="max-w-7xl mx-auto px-8">
            <div className="flex items-center justify-between h-16">
              {/* Left block - Logo */}
              <a href="/" className="text-2xl font-semibold text-white hover:opacity-90 transition-opacity">
                CONSTRUCTA
              </a>

              {/* Center block - Navigation */}
              <nav className="hidden md:flex items-center absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="flex items-center space-x-8">
                  <a href="#features" className="text-gray-500 hover:text-gray-300 transition-colors duration-200">Features</a>
                  <a href="#pricing" className="text-gray-500 hover:text-gray-300 transition-colors duration-200">Pricing</a>
                  <a href="#about" className="text-gray-500 hover:text-gray-300 transition-colors duration-200">About</a>
                  <a href="#contact" className="text-gray-500 hover:text-gray-300 transition-colors duration-200">Contact</a>
                </div>
              </nav>

              {/* Right block - Auth Buttons */}
              <div className="flex items-center space-x-6">
                <button className="text-gray-500 hover:text-gray-300 transition-colors duration-200">
                  Log in
                </button>
                <button className="px-4 py-1.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors duration-200">
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