'use client';

import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

interface FAQItem {
  question: string;
  answer: string;
}

export const faqs: FAQItem[] = [
  {
    question: "What is Constructa?",
    answer: "Constructa is a set of work-winning tools for small construction businesses. The current phase-one review covers your company profile, brief and estimating, programme, and proposal preparation."
  },
  {
    question: "What features are included?",
    answer: "In the phase-one review: a reusable company profile with your past work, job briefs and estimating with your own price lines, a visual programme, and proposal preparation with a draft PDF. Later-phase tools are not part of this preview."
  },
  {
    question: "How does pricing work?",
    answer: "The phase-one preview does not sell a subscription or take payment. Commercial plans will be set out before release; the preview-access page explains what is in scope now."
  },
  {
    question: "Is there a free trial?",
    answer: "There is no trial or payment in the phase-one preview. Access is by applying to the founding cohort or by signing in with an existing review account."
  },
  {
    question: "Can I cancel my subscription?",
    answer: "There is no subscription in the phase-one preview, so there is nothing to cancel. If paid plans launch later, their terms will be published before you commit to anything."
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
              {faqs.map((faq, index) => (
                <AccordionItem key={faq.question} value={`item-${index + 1}`} className="border-b border-gray-800">
                  <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-left text-gray-400">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
}
