"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { companyStartingPaths, proposalDefaultPaths, welcomeSteps } from "@/lib/first-session-welcome";
import ui from "./first-session.module.css";

export default function WelcomeNextSteps({ hasProjects, companyReadiness }: { hasProjects: boolean; companyReadiness?: ReactNode }) {
    return (
        <section aria-labelledby="welcome-next-heading" className={ui.welcomePaths}>
            <h2 id="welcome-next-heading" className="text-xl font-semibold">Make this workspace yours.</h2>
            <p className={ui.optionalLabel}>Choose a path. Company details are optional; you can start a job at any time.</p>
            <div className={ui.tiles}>
                {welcomeSteps(hasProjects).map((step) => {
                    const chooser = step.id === "company" || step.id === "defaults";
                    const content = (
                        <>
                            <div className={ui.tileMeta}><span>{step.category}</span><span aria-hidden="true">{step.number}</span></div>
                            <h3>{step.title}</h3>
                            <p>{step.detail}</p>
                            <div className={ui.tileFooter}>
                                <span>{step.action}</span>
                                {chooser ? <ChevronDown size={20} className={ui.choiceChevron} aria-hidden="true" /> : <ArrowUpRight size={20} aria-hidden="true" />}
                            </div>
                        </>
                    );
                    if (!chooser) return <Link key={step.id} href={step.href} className={ui.tile} data-welcome-step={step.id}>{content}</Link>;
                    const paths = step.id === "company" ? companyStartingPaths : proposalDefaultPaths;
                    return (
                        <details key={step.id} className={`${ui.tile} ${ui.chooser}`} name="welcome-paths" data-welcome-step={step.id}>
                            <summary>{content}</summary>
                            <div className={ui.choiceBody}>
                                <ul className={ui.companyPaths} aria-label={step.id === "company" ? "Ways to build your company profile" : "Available proposal preferences"}>
                                    {paths.map((path) => (
                                        <li key={path.href}>
                                            <Link href={path.href} className={ui.companyPath}>
                                                <span className={ui.companyPathTitle}>{path.title}<ArrowUpRight size={20} aria-hidden="true" /></span>
                                                <span className={ui.companyPathDetail}>{path.detail}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                                {step.id === "company" ? companyReadiness : (
                                    <p className={ui.defaultsNote} role="note">
                                        Company-wide programme, payment and terms defaults are not available here yet. Those choices remain in each job.
                                        Style and message changes use the existing whole-profile Save, not a separate save on this page.
                                    </p>
                                )}
                            </div>
                        </details>
                    );
                })}
            </div>
            <details className={ui.tour}>
                <summary>How Constructa fits together</summary>
                <p>Your company profile and past work introduce your business. Each job has a brief, estimate and programme. Those come together in its proposal, which you review before sending.</p>
                <p>You can begin a job without finishing your full company profile. Additional company details are optional; each proposal still has its own checks before it can be sent.</p>
            </details>
        </section>
    );
}
