'use client';

import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "Who is Constructa for?",
    answer: "Constructa is built for small construction teams, tradespeople, and contractors who need simple, reliable tools to quote, plan, and stay on top of jobs—without the admin overload."
  },
  {
    question: "Is Constructa just for builders?",
    answer: "Not at all. Whether you're a joiner, electrician, general contractor, or multi-trade business, Constructa helps you quote accurately and plan clearly. If you work in construction—we've got you."
  },
  {
    question: "What can I actually do with Constructa?",
    answer: "You can build professional proposals, create clear project timelines, manage your job schedule, and track costs—all in one place. No more juggling spreadsheets, message threads, and documents."
  },
  {
    question: "Do I need training to use Constructa?",
    answer: "No. Constructa is designed to be simple and intuitive from day one. If you can use email and spreadsheets, you'll be up and running in minutes."
  },
  {
    question: "Is there a free trial?",
    answer: "Yes—when we launch, you'll be able to try Constructa for free. Early users will also get access to special launch pricing."
  },
  {
    question: "Will this work on site or on my phone?",
    answer: "Absolutely. Constructa is fully cloud-based and mobile-friendly, so you can use it in the office, on site, or on the go."
  },
  {
    question: "Can I customise proposals and timelines to suit my jobs?",
    answer: "Yes. Constructa is flexible—you can set your own line items, phases, and terms, so your proposals and programmes reflect how you actually work."
  },
  {
    question: "Do you support UK construction standards and terminology?",
    answer: "We do. Constructa is built in the UK, for UK-based teams—so everything from project phases to proposal formats is made to fit your world."
  },
  {
    question: "What if I need help?",
    answer: "We've got you. Our support team is small, friendly, and actually understands construction. If you need help, you'll talk to someone who gets it."
  }
];

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="relative py-32 md:py-40 px-4 md:px-8">
      <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900/50 to-black"></div>
      <div className="relative max-w-[1400px] mx-auto px-8">
        <div className="max-w-[600px] mx-auto text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">FAQ</h2>
          <p className="text-gray-400 text-lg">
            Common questions about Constructa
          </p>
        </div>
        <div className="max-w-[800px] mx-auto">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border-b border-gray-800/50 last:border-b-0"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full py-6 flex items-center justify-between text-left focus:outline-none group"
              >
                <span className="text-lg font-medium pr-8">{faq.question}</span>
                <svg
                  className={`w-6 h-6 transform transition-transform duration-200 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  openIndex === index ? 'max-h-96 pb-6' : 'max-h-0'
                }`}
              >
                <p className="text-gray-400">{faq.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ; 