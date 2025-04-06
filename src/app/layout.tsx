import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body className="bg-black text-white">
        {/* Header Section */}
        <header className="w-full bg-black text-white p-5 flex justify-between items-center">
          <div className="text-2xl font-bold tracking-wider">CONSTRUCTA</div>
          <nav className="space-x-6 flex">
            <a href="#product" className="hover:text-orange-500">Product</a>
            <a href="#features" className="hover:text-orange-500">Features</a>
            <a href="#pricing" className="hover:text-orange-500">Pricing</a>
            <a href="#contact" className="hover:text-orange-500">Contact</a>
          </nav>
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