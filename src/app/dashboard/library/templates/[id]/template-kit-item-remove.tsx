"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { removeTemplateItemAction } from "../../templates-actions";

export function TemplateKitItemRemove({ itemId, templateId }: { itemId: string; templateId: string }) {
    const router = useRouter();
    const [pending, setPending] = useState(false);
    const [removeError, setRemoveError] = useState<string | null>(null);

    const handleRemove = async () => {
        if (pending) return;
        setRemoveError(null);
        setPending(true);
        try {
            await removeTemplateItemAction(itemId, templateId);
            try {
                router.refresh();
            } catch {
                setRemoveError("The kit list may be stale. Refresh this page to see the latest items.");
            }
        } catch (error) {
            const detail = error instanceof Error ? error.message : "Unknown error";
            setRemoveError(
                `Could not confirm this item was removed. It may already be gone — check the kit list before trying again. (${detail})`
            );
        } finally {
            setPending(false);
        }
    };

    return (
        <div className="flex flex-col items-end gap-1">
            {removeError ? (
                <p role="alert" className="text-[10px] text-red-600 max-w-[10rem] text-right leading-tight">{removeError}</p>
            ) : null}
            <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pending}
                aria-label="Remove kit item"
                onClick={handleRemove}
                className="text-slate-300 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
            >
                <Trash2 className="w-4 h-4" />
            </Button>
        </div>
    );
}
