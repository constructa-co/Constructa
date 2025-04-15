'use client';

import Image from 'next/image';
import { useState } from 'react';
import Script from 'next/script';

export default function LandingPage() {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder for form submission
    console.log('Email submitted:', email);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-gray-900">
      <Script id="plausible-convertkit" strategy="afterInteractive">
        {`
          document.addEventListener("DOMContentLoaded", function () {
            const form = document.querySelector('form[action*="kit.com"]');
            if (form) {
              form.addEventListener("submit", function () {
                if (window.plausible) plausible("EmailSignup");
              });
            }
          });
        `}
      </Script>

      {/* Hero Section */}
      <section className="relative py-32 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            <div className="md:col-span-2 space-y-6">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
                Constructa: proposal, planning, and project tools for construction professionals.
              </h1>
              <p className="text-xl text-gray-400">
                Quote faster, plan smarter, and keep control of every job.
              </p>
              <a
                href="#early-access"
                className="inline-block px-8 py-3 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors duration-200"
              >
                Join the waitlist
              </a>
            </div>
            <div className="relative h-64 md:h-96">
              <Image
                src="/hero-image.png"
                alt="Constructa dashboard"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Problem → Solution Section */}
      <section className="py-24 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              No more spreadsheets. Just smart tools for your construction company.
            </h2>
            <p className="text-xl text-gray-400">
              Constructa brings together everything you need to run your construction business—from quoting and planning to project management and reporting. All in one place, designed specifically for construction professionals.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-16">
            Quote it. Plan it. Run it.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white">Build your quote</h3>
              <p className="text-gray-400">Create professional quotes in minutes with our intuitive builder.</p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white">Map out the job</h3>
              <p className="text-gray-400">Plan every detail with our visual project mapping tools.</p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white">Stay in control</h3>
              <p className="text-gray-400">Monitor progress and make adjustments in real-time.</p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white">Win the work</h3>
              <p className="text-gray-400">Close more deals with professional proposals and presentations.</p>
            </div>
          </div>
        </div>
      </section>

      {/* What Sets Us Apart Section */}
      <section className="py-24 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              What sets Constructa apart
            </h2>
            <p className="text-xl text-gray-400">
              Not just another piece of software—Constructa is built for how construction really works.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white">Built for Construction</h3>
              <p className="text-gray-400">
                Designed specifically for construction professionals, with features that match your workflow.
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white">Simple Yet Powerful</h3>
              <p className="text-gray-400">
                Intuitive interface that's easy to learn but powerful enough for complex projects.
              </p>
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white">All-in-One Solution</h3>
              <p className="text-gray-400">
                Everything you need in one place—no more juggling multiple tools and spreadsheets.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Early Access CTA Section */}
      <section id="early-access" className="py-24 px-4 md:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Be first to try Constructa
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            Early users get priority access and special launch pricing.
          </p>
          <script src="https://f.convertkit.com/ckjs/ck.5.js"></script>
          <form 
            action="https://app.kit.com/forms/7919715/subscriptions" 
            className="seva-form formkit-form" 
            method="post" 
            data-sv-form="7919715" 
            data-uid="0fbf2928bb" 
            data-format="inline" 
            data-version="5" 
            data-options='{"settings":{"after_subscribe":{"action":"message","success_message":"Success! Now check your email to confirm your subscription.","redirect_url":""},"analytics":{"google":null,"fathom":null,"facebook":null,"segment":null,"pinterest":null,"sparkloop":null,"googletagmanager":null},"modal":{"trigger":"timer","scroll_percentage":null,"timer":5,"devices":"all","show_once_every":15},"powered_by":{"show":true,"url":"https://kit.com/features/forms?utm_campaign=poweredby&utm_content=form&utm_medium=referral&utm_source=dynamic"},"recaptcha":{"enabled":false},"return_visitor":{"action":"show","custom_content":""},"slide_in":{"display_in":"bottom_right","trigger":"timer","scroll_percentage":null,"timer":5,"devices":"all","show_once_every":15},"sticky_bar":{"display_in":"top","trigger":"timer","scroll_percentage":null,"timer":5,"devices":"all","show_once_every":15}},"version":"5"}' 
            min-width="400 500 600 700 800"
            style={{ backgroundColor: 'rgb(255, 255, 255)', borderRadius: '6px' }}
          >
            <div data-style="full">
              <div 
                data-element="column" 
                className="formkit-column"
                style={{ backgroundColor: 'rgb(249, 250, 251)' }}
              >
                <div className="formkit-background" style={{ opacity: 0.3 }} />
                <div 
                  className="formkit-header" 
                  data-element="header"
                  style={{ color: 'rgb(77, 77, 77)', fontSize: '20px', fontWeight: 700 }}
                >
                  <h2>Join the Newsletter</h2>
                </div>
                <div 
                  className="formkit-subheader" 
                  data-element="subheader"
                  style={{ color: 'rgb(104, 104, 104)', fontSize: '15px' }}
                >
                  Subscribe to get our latest content by email.
                </div>
              </div>
              <div data-element="column" className="formkit-column">
                <ul className="formkit-alert formkit-alert-error" data-element="errors" data-group="alert" />
                <div data-element="fields" className="seva-fields formkit-fields">
                  <div className="formkit-field">
                    <input 
                      className="formkit-input" 
                      name="email_address" 
                      aria-label="Email Address" 
                      placeholder="Email Address" 
                      required 
                      type="email"
                      style={{ 
                        color: 'rgb(0, 0, 0)', 
                        borderColor: 'rgb(227, 227, 227)', 
                        borderRadius: '4px', 
                        fontWeight: 400 
                      }}
                    />
                  </div>
                  <button 
                    data-element="submit" 
                    className="formkit-submit formkit-submit"
                    style={{ 
                      color: 'rgb(255, 255, 255)', 
                      backgroundColor: 'rgb(22, 119, 190)', 
                      borderRadius: '24px', 
                      fontWeight: 700 
                    }}
                  >
                    <div className="formkit-spinner">
                      <div />
                      <div />
                      <div />
                    </div>
                    <span>Subscribe</span>
                  </button>
                </div>
                <div 
                  className="formkit-guarantee" 
                  data-element="guarantee"
                  style={{ 
                    color: 'rgb(77, 77, 77)', 
                    fontSize: '13px', 
                    fontWeight: 400 
                  }}
                >
                  We respect your privacy. Unsubscribe at any time.
                </div>
                <div className="formkit-powered-by-convertkit-container">
                  <a 
                    href="https://kit.com/features/forms?utm_campaign=poweredby&utm_content=form&utm_medium=referral&utm_source=dynamic" 
                    data-element="powered-by" 
                    className="formkit-powered-by-convertkit" 
                    data-variant="dark" 
                    target="_blank" 
                    rel="nofollow"
                  >
                    Built with Kit
                  </a>
                </div>
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* Contact Invite Section */}
      <section className="py-24 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Get in touch
            </h2>
            <div className="space-y-4">
              <p className="text-xl text-gray-400">
                Email: <a href="mailto:hello@constructa.co" className="text-white hover:text-gray-300">hello@constructa.co</a>
              </p>
              <p className="text-xl text-gray-400">
                LinkedIn: <a href="https://linkedin.com/company/constructa" target="_blank" rel="noopener noreferrer" className="text-white hover:text-gray-300">Constructa</a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
} 