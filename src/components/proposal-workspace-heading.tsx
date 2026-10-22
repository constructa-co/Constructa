import type { ReactNode } from "react";

type HeadingClasses = Record<"header" | "eyebrow" | "title" | "project" | "guide", string>;

export default function ProposalWorkspaceHeading({ projectName, clientName, locked, isDark, classes, children }: {
    projectName: string;
    clientName?: string | null;
    locked: boolean;
    isDark: boolean;
    classes: HeadingClasses;
    children?: ReactNode;
}) {
    return (
        <header className={classes.header} data-dark={isDark ? "true" : "false"}>
            <div>
                <p className={classes.eyebrow}>From your draft to your client</p>
                <h1 className={classes.title}>Your proposal</h1>
                <p className={classes.project}>{projectName}{clientName ? ` for ${clientName}` : ""}</p>
                <p className={classes.guide}>
                    {locked
                        ? "This proposal is read-only. Review the details and any previously sent versions below."
                        : "Saving a draft and sending it are separate actions. Check the preview before you send."}
                </p>
            </div>
            {children}
        </header>
    );
}
