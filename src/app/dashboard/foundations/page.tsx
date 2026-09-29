import { redirect } from "next/navigation";

export default async function FoundationsPage(props: { searchParams: Promise<{ projectId?: string }> }) {
    const searchParams = await props.searchParams;
    if (searchParams.projectId) {
        redirect(`/dashboard/projects/brief?projectId=${searchParams.projectId}`);
    }
    redirect("/dashboard");
}
