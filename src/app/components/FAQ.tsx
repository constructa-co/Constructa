'use client';

import { useState } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

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

export default function FAQ() {
  return (
    <section className="relative py-32 md:py-40 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16">
          {/* Left column with header */}
          <div className="text-left">
            <h2 className="text-4xl md:text-5xl font-bold">Have questions?</h2>
          </div>

          {/* Right column with accordion */}
          <div className="space-y-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1" className="border-b border-gray-800">
                <AccordionTrigger className="text-left">What is Constructa?</AccordionTrigger>
                <AccordionContent className="text-left text-gray-400">
                  Constructa is an AI-powered construction management platform that streamlines project planning, execution, and monitoring.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="border-b border-gray-800">
                <AccordionTrigger className="text-left">What features are included?</AccordionTrigger>
                <AccordionContent className="text-left text-gray-400">
                  Our platform includes project management tools, AI-assisted scheduling, resource allocation, real-time progress tracking, and automated reporting features.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="border-b border-gray-800">
                <AccordionTrigger className="text-left">How does pricing work?</AccordionTrigger>
                <AccordionContent className="text-left text-gray-400">
                  We offer flexible pricing plans based on project size and feature requirements. Contact us for a customized quote.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="border-b border-gray-800">
                <AccordionTrigger className="text-left">Is there a free trial?</AccordionTrigger>
                <AccordionContent className="text-left text-gray-400">
                  Yes, we offer a 14-day free trial with full access to all features to help you evaluate our platform.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="border-b border-gray-800">
                <AccordionTrigger className="text-left">Can I cancel my subscription?</AccordionTrigger>
                <AccordionContent className="text-left text-gray-400">
                  Yes, you can cancel your subscription at any time. No long-term commitments required.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
} 