import Image from 'next/image';
import Link from 'next/link';
import type { StaticImageData } from 'next/image';
import { aboutCaptures } from './about-image-provenance';

function AboutImage({
  src,
  alt,
  width,
  height,
  className = 'w-full h-auto rounded-xl shadow-md',
}: {
  src: string | StaticImageData;
  alt: string;
  width: number;
  height: number;
  className?: string;
}) {
  return <Image src={src} alt={alt} width={width} height={height} sizes="(max-width: 900px) 100vw, 42vw" className={className} />;
}

export function FullAboutPage() {
  return (
    <div className="bg-black text-white">
      <section className="max-w-6xl mx-auto px-4 pt-32 pb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-semibold mb-5">Why we built Constructa, and what comes next.</h1>
      </section>

      <section className="max-w-6xl mx-auto px-4 pt-32 pb-24 grid md:grid-cols-2 gap-12 items-center">
        <figure>
          <AboutImage
            src={aboutCaptures.programmeSavedStages.src}
            alt={aboutCaptures.programmeSavedStages.alt}
            width={aboutCaptures.programmeSavedStages.width}
            height={aboutCaptures.programmeSavedStages.height}
          />
          <figcaption className="mt-2 text-sm">{aboutCaptures.programmeSavedStages.caption}</figcaption>
        </figure>
        <div className="text-left">
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">Built around your own judgement</h2>
          <p className="text-gray-300 text-lg mb-4">
            Constructa is built for small UK contractors who price jobs from their own knowledge: scope, quantities, labour, plant, materials and subcontract rates.
          </p>
          <p className="text-gray-300 text-lg mb-4">
            It brings those details together while keeping the judgement with you.
          </p>
          <p className="text-gray-300 text-lg">
            Capture the brief and quantities, enter your own rates, and review the proposal before sharing it.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-24">
        <div className="text-left">
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">The problem we saw</h2>
          <p className="text-gray-300 text-lg mb-4">
            Running a small construction company means juggling everything—quoting fast, planning tight, and keeping things moving on site.
          </p>
          <ul className="list-disc list-inside text-gray-400 text-sm space-y-2">
            <li>Proposals get rushed</li>
            <li>Programmes get misaligned</li>
            <li>Project control slips</li>
            <li>And admin takes over</li>
          </ul>
          <p className="text-gray-300 text-lg mt-4">
            Check the scope and exclusions as carefully as the total.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-24 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <figure>
            <AboutImage
              src={aboutCaptures.estimatePriceAdjustments.src}
              alt={aboutCaptures.estimatePriceAdjustments.alt}
              width={aboutCaptures.estimatePriceAdjustments.width}
              height={aboutCaptures.estimatePriceAdjustments.height}
            />
            <figcaption className="mt-2 text-sm">{aboutCaptures.estimatePriceAdjustments.caption}</figcaption>
          </figure>
        </div>
        <div className="text-left">
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">The solution we&apos;re building</h2>
          <p className="text-gray-300 text-lg mb-4">
            Include preliminaries, overheads, risk and profit, lay out the work on working days, and review the proposal before sharing it.
          </p>
          <ul className="list-disc list-inside text-gray-400 text-sm space-y-2">
            <li>Review the estimate and draft proposal</li>
            <li>Review the working days and sequence</li>
            <li>Check scope, exclusions and quantities</li>
            <li>Use your own labour, plant, material and subcontract rates</li>
          </ul>
          <p className="text-gray-300 text-lg mt-4">Constructa does not measure quantities from drawings or decide your rates and margins. A programme needs your review against the real site, people and suppliers.</p>
        </div>
      </section>


      <section className="max-w-6xl mx-auto px-4 py-24">
        <h2 className="text-3xl font-semibold mb-10">Why now?</h2>
        <div className="grid md:grid-cols-3 gap-12 text-gray-300">
          <div className="text-left">
            <h3 className="text-2xl font-semibold mb-2">Small firms are the backbone of the sector</h3>
            <p>Enter the quantities and rates you intend to use.</p>
          </div>
          <div className="text-left">
            <h3 className="text-2xl font-semibold mb-2">Admin eats into every working week</h3>
            <p>Time spent chasing info and retyping quotes is time away from the job.</p>
          </div>
          <div className="text-left">
            <h3 className="text-2xl font-semibold mb-2">Spreadsheets are still the default</h3>
            <p>Keep scope, exclusions and totals consistent through your own review.</p>
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 pt-24 py-24">
        <div className="text-left">
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">What&apos;s next</h2>
          <p className="text-gray-300 text-lg mb-4">
            Constructa is in a phase-one review. We are checking the complete work-winning journey before release—it is not currently offered for live customer work.
          </p>
          <p className="text-gray-300 text-lg mb-4">
            The work-winning journey centres on company, brief, estimate, programme and proposal. Later delivery tools are not promised as ready.
          </p>
          <p className="text-gray-300 text-lg mb-4">
            Access is currently limited to existing review accounts. New signup, payment and enquiry collection remain off.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <Link href="/apply" className="bg-white text-black px-4 py-2 rounded font-semibold text-base hover:opacity-90 transition">Apply to the founding cohort →</Link>
            <Link href="/pricing" className="bg-white text-black px-4 py-2 rounded font-semibold text-base hover:opacity-90 transition">Preview access →</Link>
            <Link href="/guides" className="bg-white text-black px-4 py-2 rounded font-semibold text-base hover:opacity-90 transition">Read the guides →</Link>
            <a href="https://www.linkedin.com/company/constructa-co" className="bg-white text-black px-4 py-2 rounded font-semibold text-base hover:opacity-90 transition">Follow us on LinkedIn →</a>
          </div>
        </div>
      </section>

      <section className="bg-black text-white py-16 border-t border-gray-700">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-xl font-bold mb-6 text-left">Where to look next</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-y-4 gap-x-6 text-sm text-gray-300 mt-2">
            <div className="text-left font-medium">Review your company profile, brief and price</div>
            <div className="text-left">Phase-one checklists from the review guide</div>
            <div className="text-left text-blue-400 underline"><Link href="/guides">constructa.co/guides</Link></div>

            <div className="text-left font-medium">Behind the build: Constructa&apos;s approach</div>
            <div className="text-left">Updates from the team as the review progresses</div>
            <div className="text-left text-blue-400 underline"><a href="https://www.linkedin.com/company/constructa-co">linkedin.com/company/constructa-co</a></div>

            <div className="text-left font-medium">Preview access and phase-one scope</div>
            <div className="text-left">What is in the review and what still needs release verification</div>
            <div className="text-left text-blue-400 underline"><Link href="/pricing">constructa.co/pricing</Link></div>
          </div>
        </div>
      </section>
    </div>
  );
}