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
            We collect only the data necessary to provide our services, including your name, email, and company details when you sign up for updates or use our platform.
          </p>
          
          <p className="text-gray-400 mb-6">
            Your data is never sold or shared with third parties without your consent. We use industry-standard security measures to protect your information.
          </p>
          
          <p className="text-gray-400 mb-6">
            You can contact us at{' '}
            <a 
              href="mailto:hello@constructa.co" 
              className="text-gray-300 hover:text-white transition-colors duration-200"
            >
              hello@constructa.co
            </a>
            {' '}to request access to, correction of, or deletion of your data.
          </p>
          
          <p className="text-sm text-gray-500 mt-8">
            This policy may be updated from time to time. Last updated: May 2025.
          </p>
        </div>
      </div>
    </main>
  );
} 