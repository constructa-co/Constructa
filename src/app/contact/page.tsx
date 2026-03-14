export default function ContactPage() {
  return (
    <main className="min-h-screen pt-16 bg-black">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-white mb-8">Got a question? Want to stay in the loop?</h1>
        
        <div className="prose prose-invert max-w-none mb-12">
          <p className="text-gray-400">
            We're building Constructa to help construction professionals quote, plan, and win more work without the admin headache.
            If you've got a question, suggestion, or want early access—we'd love to hear from you.
          </p>
        </div>

        <form 
          action="https://formspree.io/f/xnnprlod" 
          method="POST" 
          className="space-y-6"
        >
          <div>
            <input 
              type="text" 
              name="name" 
              placeholder="Your Name" 
              required 
              className="w-full p-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent"
            />
          </div>
          
          <div>
            <input 
              type="email" 
              name="email" 
              placeholder="Your Email" 
              required 
              className="w-full p-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent"
            />
          </div>
          
          <div>
            <textarea 
              name="message" 
              rows={5}
              placeholder="Your Message" 
              required 
              className="w-full p-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent"
            />
          </div>
          
          <button 
            type="submit" 
            className="px-6 py-3 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors duration-200"
          >
            Send Message
          </button>
        </form>

        <p className="mt-8 text-sm text-gray-500">
          Or email us directly:{' '}
          <a 
            href="mailto:hello@constructa.co" 
            className="text-gray-300 hover:text-white transition-colors duration-200"
          >
            hello@constructa.co
          </a>
        </p>
      </div>
    </main>
  );
} 