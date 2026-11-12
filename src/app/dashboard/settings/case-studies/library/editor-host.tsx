"use client";

import { useRouter } from "next/navigation";
import type { StudyView } from "@/lib/case-library/service";
import type { StoredDiscipline } from "@/lib/case-library/store";
import { CASE_STUDIES_PATH } from "@/lib/first-session";
import CaseStudyEditor from "./case-study-editor";

/** The editor on its real routes. Once a new case study has been saved, the address becomes its own. */
export default function EditorHost({ initial, disciplines }: { initial: StudyView | null; disciplines: StoredDiscipline[] }) {
    const router = useRouter();
    return <CaseStudyEditor initial={initial} disciplines={disciplines} listHref={CASE_STUDIES_PATH} guidedBase={`${CASE_STUDIES_PATH}/library`} onCreated={(id) => router.replace(`${CASE_STUDIES_PATH}/library/${id}`)} />;
}
