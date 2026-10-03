import { redirect } from "next/navigation";
import { NEW_PROJECT_PATH } from "@/lib/first-session";

/**
 * Quick Quote used to be a second, template-first way to create a project.
 * There is now one way in, so old links and bookmarks land on New Project.
 * No template choice or query string is carried across.
 */
export default function QuickQuotePage() {
    redirect(NEW_PROJECT_PATH);
}
