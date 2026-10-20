import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import ui from "./first-session.module.css";

const overview = [
    ["Your company", "Who you are. What you do."],
    ["Your work", "The experience behind your business."],
    ["Your price", "A job, a brief and a clear estimate."],
    ["Your proposal", "Bring it together. Review it first."],
] as const;

const setupOverview = [
    ["Your business", "Describe the work you do in your own words."],
    ["Your identity", "Put your trading name on your proposals."],
    ["Your pace", "Add your story and examples when you're ready."],
    ["Your first job", "Move into a brief and a clear price."],
] as const;

export function FirstSessionFrame({ children, signOut = false }: { children: ReactNode; signOut?: boolean }) {
    const brand = <><span className={ui.brandMark} aria-hidden="true">C</span>constructa</>;
    return (
        <div className={ui.root}>
            <header className={ui.header}>
                {signOut ? <span className={ui.brand}>{brand}</span> : <Link href="/" className={ui.brand}>{brand}</Link>}
                <span className={ui.headerNote}>A better way to build business.</span>
                {signOut ? (
                    <form action="/auth/signout" method="post">
                        <button className={ui.textButton}><LogOut size={16} aria-hidden="true" /> Sign out</button>
                    </form>
                ) : <span className={ui.headerNote}>From first hello to first proposal.</span>}
            </header>
            <div className={ui.content}>{children}</div>
            <footer className={ui.footer}>Built around your business. Not the other way around.</footer>
        </div>
    );
}

export function FirstSessionPanel({ children, step }: { children: ReactNode; step?: 0 | 1 }) {
    const isSetup = step === 1;
    return (
        <div className={ui.panel}>
            <section className={ui.formSide}>
                {step !== undefined && (
                <ol className={ui.steps} aria-label="Getting started">
                    {["Account", "The essentials", "Your workspace"].map((label, index) => (
                        <li key={label} aria-current={step === index ? "step" : undefined}>
                            <span aria-hidden="true">{index + 1}</span>{label}
                        </li>
                    ))}
                </ol>
                )}
                {children}
            </section>
            <aside className={ui.storySide} aria-label={isSetup ? "Getting your business ready" : "A quick introduction to Constructa"}>
                <div>
                    <p className={ui.eyebrow}>{isSetup ? "Your business, your way" : "From first hello to first proposal"}</p>
                    <h2 className={ui.storyHeading}>{isSetup ? <>Built around<br />the work you do.</> : <>Your work deserves<br />a better introduction.</>}</h2>
                    <p className={ui.lede}>{isSetup ? "Start with the essentials. Add the detail when you're ready." : "Less admin. A clearer price. A proposal that feels like your business."}</p>
                </div>
                <ol className={ui.overview}>
                    {(isSetup ? setupOverview : overview).map(([title, detail], index) => (
                        <li key={title}>
                            <strong>{title}</strong>
                            <span aria-hidden="true">0{index + 1}</span>
                            <p>{detail}</p>
                        </li>
                    ))}
                </ol>
                <p className={ui.footnote}>{isSetup ? "Your own words. No fixed category required." : "Start small. Add the detail when you're ready."}<br />Your full company profile can come later.</p>
            </aside>
        </div>
    );
}
