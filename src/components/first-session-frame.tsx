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

const companySetupOverview = [
    ["Your trading name", "What clients see on your proposals."],
    ["Your name", "Optional: the person behind the business."],
    ["Your work", "The description you already gave stays with your profile."],
    ["Your profile", "Refine logo, story and examples when you are ready."],
] as const;

export type SetupStage = "trade" | "company";

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

export function FirstSessionPanel({
    children,
    step,
    setupStage = "trade",
}: {
    children: ReactNode;
    step?: 0 | 1;
    /** When step is setup (1), distinguishes trade vs company detail right-panel copy. */
    setupStage?: SetupStage;
}) {
    const isSetup = step === 1;
    const isCompanySetup = isSetup && setupStage === "company";
    const storyEyebrow = !isSetup
        ? "From first hello to first proposal"
        : isCompanySetup
            ? "The essentials, in place"
            : "Your business, your way";
    const storyHeading = !isSetup
        ? <>Your work deserves<br />a better introduction.</>
        : isCompanySetup
            ? <>Make it feel like<br />your business.</>
            : <>Built around<br />the work you do.</>;
    const storyLede = !isSetup
        ? "Less admin. A clearer price. A proposal that feels like your business."
        : isCompanySetup
            ? "Add your trading name and, if you like, your own name. The work you described carries through; you can refine the full company profile later."
            : "Start with the essentials. Add the detail when you're ready.";
    const overviewRows = !isSetup ? overview : isCompanySetup ? companySetupOverview : setupOverview;
    const storyFootnote = !isSetup
        ? "Start small. Add the detail when you're ready."
        : isCompanySetup
            ? "Only what you need to get started."
            : "Your own words. No fixed category required.";
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
                    <p className={ui.eyebrow}>{storyEyebrow}</p>
                    <h2 className={ui.storyHeading}>{storyHeading}</h2>
                    <p className={ui.lede}>{storyLede}</p>
                </div>
                <ol className={ui.overview}>
                    {overviewRows.map(([title, detail], index) => (
                        <li key={title}>
                            <strong>{title}</strong>
                            <span aria-hidden="true">0{index + 1}</span>
                            <p>{detail}</p>
                        </li>
                    ))}
                </ol>
                <p className={ui.footnote}>{storyFootnote}<br />Your full company profile can come later.</p>
            </aside>
        </div>
    );
}
