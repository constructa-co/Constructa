export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen pt-16 bg-black">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-white mb-8">Privacy Policy</h1>
        
        <div className="prose prose-invert max-w-none">
          <p className="text-gray-400 mb-6">
            At Constructa, we respect your privacy and are committed to protecting your personal information.
          </p>
          
          <p className="text-gray-400 mb-6">
            When you sign up for updates or use our platform, we hold the details you give us, such as your name, email address and company details.
          </p>
          
          <p className="text-gray-400 mb-6" data-privacy-review-note>
            This notice is incomplete. It does not yet explain who is responsible for your information, the legal basis for using it, who it is shared with, where it is stored, how long it is kept or how it is protected. It needs to be completed and reviewed before it can be relied on as a full account of how information is handled. Until then, please ask us using the address below.
          </p>
          
          <p className="text-gray-400 mb-6">
            You can contact us at{' '}
            <a 
              href="mailto:hello@constructa.co" 
              className="text-gray-300 hover:text-white transition-colors duration-200"
            >
              hello@constructa.co
            </a>
            {' '}to request access to, correction of, or deletion of your data, or to ask how personal, company, tax, pricing or salary information is handled.
          </p>
          
          <p className="text-sm text-gray-500 mt-8">
            This policy may be updated from time to time. Previous version dated March 2026.
          </p>
        </div>
      </div>
    </main>
  );
} 
