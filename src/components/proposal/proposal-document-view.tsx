/* eslint-disable @next/next/no-img-element */
import type { CSSProperties, ReactNode } from "react";
import ProgrammeTimeline from "@/components/programme-timeline";
import { DOCUMENT_THEMES, type DocBlock, type DocFact, type ProposalDocument } from "@/lib/proposal-document";

/**
 * The proposal as the client reads it on screen.
 *
 * Renders a `ProposalDocument` and nothing else, so it shows exactly what
 * the PDF shows. Always light, whatever the app theme. One column that
 * reflows down to a phone: tables are laid out as rows, not grids, so
 * nothing scrolls sideways. `children` is the response area.
 */
export default function ProposalDocumentView({ doc, children }: { doc: ProposalDocument; children?: ReactNode }) {
    const theme = DOCUMENT_THEMES[doc.theme];
    const style = {
        "--doc-accent": theme.accent,
        "--doc-accent-soft": theme.accentSoft,
        "--doc-highlight": theme.highlight,
    } as CSSProperties;

    return (
        <article
            style={style}
            data-proposal-document
            className="mx-auto w-full max-w-3xl bg-white text-stone-800 shadow-sm ring-1 ring-stone-200 sm:rounded-sm [overflow-wrap:anywhere]"
        >
            {doc.isDraft && (
                <p className="bg-amber-100 px-5 py-2.5 text-center text-sm font-semibold text-amber-900 sm:px-12" data-draft-banner>
                    Draft preview. This has not been sent to the client.
                </p>
            )}

            {/* Cover */}
            <header className="px-5 pb-10 pt-8 sm:px-12 sm:pb-14 sm:pt-12">
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-stone-200 pb-6">
                    {doc.company.logoUrl
                        ? <img src={doc.company.logoUrl} alt={doc.company.name} className="max-h-14 max-w-[60%] object-contain" />
                        : <p className="text-lg font-bold tracking-tight text-stone-900">{doc.company.name}</p>}
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--doc-highlight)]">Proposal</p>
                </div>

                <h1 className="mt-10 font-serif text-4xl leading-tight text-stone-900 sm:mt-14 sm:text-5xl">{doc.title}</h1>
                {doc.clientName && (
                    <p className="mt-4 text-lg text-stone-600">
                        Prepared for <span className="font-semibold text-stone-900">{doc.clientName}</span>
                    </p>
                )}
                {doc.siteAddress && <p className="mt-1 text-base text-stone-600">{doc.siteAddress}</p>}

                <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-stone-600">
                    {[
                        doc.projectType && { label: "Type of work", value: doc.projectType },
                        { label: doc.isDraft ? "Previewed" : "Issued", value: doc.issued },
                        { label: "Valid until", value: doc.validUntil },
                        { label: "Reference", value: doc.reference },
                    ].filter((fact): fact is DocFact => Boolean(fact)).map((fact) => (
                        <div key={fact.label}>
                            <dt className="inline">{fact.label}: </dt>
                            <dd className="inline font-semibold text-stone-900">{fact.value}</dd>
                        </div>
                    ))}
                </dl>

                {doc.keyFacts.length > 0 && (
                    <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 bg-[var(--doc-accent-soft)] px-5 py-5 sm:grid-cols-4 sm:px-6" data-key-facts>
                        {doc.keyFacts.map((fact) => (
                            <div key={fact.label} className="min-w-0 border-t-2 border-[var(--doc-accent)] pt-2">
                                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-600">{fact.label}</dt>
                                <dd className="mt-1 text-lg font-semibold text-stone-900 sm:text-xl">{fact.value}</dd>
                            </div>
                        ))}
                    </dl>
                )}

                {doc.introduction.length > 0 && (
                    <div className="mt-8 space-y-4 text-lg leading-relaxed text-stone-700">
                        {doc.introduction.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                    </div>
                )}
            </header>

            {doc.sections.map((section, index) => (
                <section
                    key={section.id}
                    aria-labelledby={`doc-${section.id}`}
                    data-doc-section={section.id}
                    className="border-t border-stone-200 px-5 py-10 sm:px-12 sm:py-12"
                >
                    <p className="text-xs font-semibold tracking-[0.2em] text-[var(--doc-highlight)]" aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                    </p>
                    <h2 id={`doc-${section.id}`} className="mt-1 font-serif text-3xl leading-tight text-stone-900">{section.title}</h2>
                    <div className="mt-6 space-y-5">
                        {section.blocks.map((block, blockIndex) => <Block key={blockIndex} block={block} />)}
                    </div>
                </section>
            ))}

            {children && (
                <section aria-labelledby="doc-response" data-doc-section="response" className="border-t border-stone-200 px-5 py-10 sm:px-12 sm:py-12">
                    {children}
                </section>
            )}

            <footer className="border-t border-stone-200 px-5 py-6 text-xs text-stone-500 sm:px-12">
                <p>
                    {doc.company.name}
                    {doc.company.phone ? ` · ${doc.company.phone}` : ""}
                    {doc.company.website ? ` · ${doc.company.website}` : ""}
                </p>
                <p className="mt-1">
                    Reference {doc.reference}
                    {doc.snapshotRef ? ` · Snapshot ${doc.snapshotRef}` : ""}
                </p>
            </footer>
        </article>
    );
}

function Facts({ items }: { items: DocFact[] }) {
    return (
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            {items.map((fact) => (
                <div key={fact.label} className="min-w-0 border-t border-stone-200 pt-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">{fact.label}</dt>
                    <dd className="mt-0.5 text-base text-stone-900">{fact.value}</dd>
                </div>
            ))}
        </dl>
    );
}

function Bullets({ items }: { items: string[] }) {
    return (
        <ul className="space-y-2 text-base leading-relaxed text-stone-700">
            {items.map((item, index) => (
                <li key={index} className="flex gap-3">
                    <span className="mt-[0.7em] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--doc-accent)]" aria-hidden="true" />
                    <span className="min-w-0">{item}</span>
                </li>
            ))}
        </ul>
    );
}

function Paragraphs({ paragraphs }: { paragraphs: string[] }) {
    return (
        <div className="space-y-3 text-base leading-relaxed text-stone-700">
            {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
    );
}

function Block({ block }: { block: DocBlock }) {
    switch (block.type) {
        case "paragraphs":
            return <Paragraphs paragraphs={block.paragraphs} />;

        case "subheading":
            return <h3 className="pt-3 text-sm font-semibold uppercase tracking-wide text-stone-900">{block.text}</h3>;

        case "bullets":
            return <Bullets items={block.items} />;

        case "facts":
            return <Facts items={block.items} />;

        case "quote":
            return (
                <figure className="border-l-2 border-[var(--doc-accent)] bg-[var(--doc-accent-soft)] px-5 py-4">
                    <blockquote className="space-y-3 font-serif text-lg italic leading-relaxed text-stone-800">
                        {block.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                    </blockquote>
                    {block.attribution && <figcaption className="mt-3 text-sm font-semibold text-stone-900">{block.attribution}</figcaption>}
                </figure>
            );

        case "photos":
            return (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2" data-doc-photos>
                    {block.photos.map((photo, index) => (
                        <figure key={`${photo.url}-${index}`} className="min-w-0">
                            <img
                                src={photo.url}
                                alt={photo.caption ?? "Site photograph"}
                                loading="lazy"
                                className="aspect-[4/3] w-full bg-stone-100 object-cover"
                            />
                            {photo.caption && <figcaption className="mt-2 text-sm text-stone-600">{photo.caption}</figcaption>}
                        </figure>
                    ))}
                </div>
            );

        case "price":
            return (
                <div data-doc-price>
                    {block.groups.map((group, groupIndex) => (
                        <div key={groupIndex} className={groupIndex > 0 ? "mt-6" : ""}>
                            {group.title && <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-900">{group.title}</h3>}
                            <ul className="mt-1 divide-y divide-stone-200 border-y border-stone-200">
                                {group.items.map((item, index) => (
                                    <li key={index} className="flex items-baseline justify-between gap-4 py-3">
                                        <span className="min-w-0">
                                            <span className="block text-base text-stone-800">{item.description}</span>
                                            {item.quantity && <span className="block text-sm text-stone-500">{item.quantity}</span>}
                                        </span>
                                        <span className="whitespace-nowrap text-base tabular-nums text-stone-900">{item.amount}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                    <dl className="mt-6 ml-auto w-full space-y-2 sm:w-2/3" data-doc-totals>
                        {block.totals.map((total) => (
                            <div
                                key={total.label}
                                className={`flex items-baseline justify-between gap-4 ${total.strong ? "border-t-2 border-[var(--doc-accent)] pt-3" : ""}`}
                            >
                                <dt className={total.strong ? "text-base font-semibold text-stone-900" : "text-base text-stone-600"}>{total.label}</dt>
                                <dd className={`whitespace-nowrap tabular-nums ${total.strong ? "font-serif text-3xl text-stone-900" : "text-base text-stone-900"}`}>
                                    {total.value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    {block.note && <p className="mt-4 text-sm text-stone-600">{block.note}</p>}
                </div>
            );

        case "payments":
            return (
                <div data-doc-payments>
                    <ul className="divide-y divide-stone-200 border-y border-stone-200">
                        {block.rows.map((row, index) => (
                            <li key={index} className="flex items-baseline justify-between gap-4 py-3">
                                <span className="min-w-0">
                                    <span className="block text-base font-semibold text-stone-900">{row.stage}</span>
                                    {row.when && <span className="block text-sm text-stone-600">{row.when}</span>}
                                </span>
                                <span className="whitespace-nowrap text-right text-base tabular-nums text-stone-900">
                                    {row.share && <span className="mr-3 text-stone-500">{row.share}</span>}
                                    {row.amount}
                                </span>
                            </li>
                        ))}
                    </ul>
                    {block.note && <p className="mt-3 text-sm text-stone-600">{block.note}</p>}
                </div>
            );

        case "timeline":
            return <ProgrammeTimeline plan={block.plan} tone="document" />;

        case "stageList":
            return (
                <div>
                    {block.start && <p className="text-base text-stone-700">Start on site: <strong className="text-stone-900">{block.start}</strong></p>}
                    <ul className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
                        {block.rows.map((row, index) => (
                            <li key={index} className="flex items-baseline justify-between gap-4 py-3 text-base">
                                <span className="min-w-0 font-semibold text-stone-900">{row.name}</span>
                                <span className="whitespace-nowrap text-stone-600">{row.duration}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            );

        case "terms":
            return (
                <ol className="sm:columns-2 sm:gap-8" data-doc-terms>
                    {block.clauses.map((clause) => (
                        <li key={clause.number} className="mb-4 break-inside-avoid text-sm leading-relaxed text-stone-700">
                            <h3 className="font-semibold text-stone-900">{clause.number}. {clause.title}</h3>
                            <p className="mt-0.5">{clause.body}</p>
                        </li>
                    ))}
                </ol>
            );

        case "caseStudy":
            return (
                <div className="border-t-2 border-[var(--doc-accent)] pt-4" data-doc-case-study>
                    <h3 className="font-serif text-2xl text-stone-900">{block.title}</h3>
                    {block.facts.length > 0 && <div className="mt-4"><Facts items={block.facts} /></div>}
                    {block.photos.length > 0 && (
                        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                            {block.photos.map((url, index) => (
                                <img key={`${url}-${index}`} src={url} alt={`${block.title}, photograph ${index + 1}`} loading="lazy" className="aspect-[4/3] w-full bg-stone-100 object-cover" />
                            ))}
                        </div>
                    )}
                    {block.delivered.length > 0 && (
                        <div className="mt-5">
                            <h4 className="text-sm font-semibold uppercase tracking-wide text-stone-900">What we delivered</h4>
                            <div className="mt-2"><Paragraphs paragraphs={block.delivered} /></div>
                        </div>
                    )}
                    {block.valueAdded.length > 0 && (
                        <div className="mt-5">
                            <h4 className="text-sm font-semibold uppercase tracking-wide text-stone-900">Value added</h4>
                            <div className="mt-2"><Paragraphs paragraphs={block.valueAdded} /></div>
                        </div>
                    )}
                </div>
            );
    }
}
