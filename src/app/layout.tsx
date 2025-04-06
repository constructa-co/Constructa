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
        <footer className="bg-black text-white p-5 mt-10 text-center">
          <div>© 2025 Constructa. All rights reserved.</div>
        </footer>
      </body>
    </html>
  );
}