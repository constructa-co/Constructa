"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createTemplateAction } from "../templates-actions";

export default function CreateKitForm() {
    const [name, setName] = useState("");
    const [isPending, setIsPending] = useState(false);
    const [outcome, setOutcome] = useState<{ ok: boolean; message: string } | null>(null);
    const inFlight = useRef(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (inFlight.current) return;
        inFlight.current = true;

        const submitted = name;
        const formData = new FormData();
        formData.set("name", submitted);

        setOutcome(null);
        setIsPending(true);
        try {
            const created = await createTemplateAction(formData);
            if (!created?.id) {
                setOutcome({ ok: false, message: "Couldn't confirm the kit was created. It may already have been saved; reload the page and check your kits before trying again." });
                return;
            }
            // Only clear the name if it wasn't edited while the request was in flight.
            setName(current => (current === submitted ? "" : current));
            try {
                router.refresh();
            } catch {
                // The kit is confirmed; only the page refresh failed.
                setOutcome({ ok: true, message: "Kit created. Reload the page to see it in the list." });
            }
        } catch (error) {
            // The insert may have succeeded before the error (e.g. during revalidation), so don't claim nothing was created.
            const detail = error instanceof Error ? error.message : "Unknown error";
            setOutcome({ ok: false, message: `Couldn't confirm the kit was created. It may already have been saved; reload the page and check your kits before trying again. (${detail})` });
        } finally {
            inFlight.current = false;
            setIsPending(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="mt-6 w-full space-y-3">
            <input name="name" placeholder="e.g. Groundworks" required value={name} onChange={e => setName(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {outcome ? (
                <p role={outcome.ok ? "status" : "alert"} className={`text-xs leading-snug ${outcome.ok ? "text-slate-600" : "text-red-600"}`}>{outcome.message}</p>
            ) : null}
            <Button type="submit" disabled={isPending} className="w-full bg-slate-900 hover:bg-black text-white rounded-lg">Initialize Kit</Button>
        </form>
    );
}
