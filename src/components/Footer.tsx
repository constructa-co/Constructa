'use client';

const Footer = () => {
  return (
    <footer className="border-t border-gray-800/40 bg-black">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 mb-12 md:mb-16">
          {/* Product Column */}
          <div className="space-y-6">
            <h3 className="text-sm font-medium text-gray-200">Product</h3>
            <ul className="space-y-4">
              <li>
                <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                  How it Works
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Use Cases
                </a>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div className="space-y-6">
            <h3 className="text-sm font-medium text-gray-200">Company</h3>
            <ul className="space-y-4">
              <li>
                <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Customers
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Careers
                </a>
              </li>
            </ul>
          </div>

          {/* Resources Column */}
          <div className="space-y-6">
            <h3 className="text-sm font-medium text-gray-200">Resources</h3>
            <ul className="space-y-4">
              <li>
                <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                  FAQs
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Privacy
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Terms
                </a>
              </li>
            </ul>
          </div>

          {/* Connect Column */}
          <div className="space-y-6">
            <h3 className="text-sm font-medium text-gray-200">Connect</h3>
            <ul className="space-y-4">
              <li>
                <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Contact us
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                  LinkedIn
                </a>
              </li>
              <li>
                <a href="mailto:hello@constructa.co" className="text-sm text-gray-400 hover:text-white transition-colors">
                  hello@constructa.co
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col items-center pt-8 border-t border-gray-800/40">
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-400">Constructa © 2025</p>
            <p className="text-sm text-gray-500">Made for construction professionals.</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 