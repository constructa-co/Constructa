import { redirect } from "next/navigation";

export default function FoundationsPage({ searchParams }: { searchParams: { projectId?: string } }) {
    if (searchParams.projectId) {
        redirect(`/dashboard/projects/brief?projectId=${searchParams.projectId}`);
    }
    redirect("/dashboard");
}
