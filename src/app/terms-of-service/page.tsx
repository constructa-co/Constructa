export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen pt-16 bg-black">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-white mb-8">Terms of Service</h1>
        
        <div className="prose prose-invert max-w-none">
          <p className="text-gray-400 mb-6">
            By using Constructa, you agree to these Terms of Service. Please read them carefully.
          </p>
          
          <p className="text-gray-400 mb-6">
            Constructa is a software platform built to help construction professionals plan, quote, and manage projects. Use of the platform must comply with all applicable laws.
          </p>
          
          <p className="text-gray-400 mb-6">
            We reserve the right to update or change these terms at any time. Continued use of the service after changes means you accept the new terms.
          </p>
          
          <p className="text-gray-400 mb-6">
            All content and features of the platform are owned by Constructa and may not be copied or redistributed without permission.
          </p>
          
          <p className="text-sm text-gray-500 mt-8">
            For questions, contact us at{' '}
            <a 
              href="mailto:hello@constructa.co" 
              className="text-gray-300 hover:text-white transition-colors duration-200"
            >
              hello@constructa.co
            </a>
            . Last updated: May 2025.
          </p>
        </div>
      </div>
    </main>
  );
} 