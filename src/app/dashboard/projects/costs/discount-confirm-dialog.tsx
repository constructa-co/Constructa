"use client";

import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    HIGH_DISCOUNT_CONFIRM_BODY,
    HIGH_DISCOUNT_CONFIRM_TITLE,
    HIGH_DISCOUNT_WARNING_BODY,
} from "@/lib/discount-confirm";
import type { WorkspaceStyles } from "@/lib/workspace-styles";

export function HighDiscountConfirmDialog({
    open,
    discountPct,
    showWarning,
    s,
    onConfirm,
    onCancel,
}: {
    open: boolean;
    discountPct: number;
    showWarning: boolean;
    s: WorkspaceStyles;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) onCancel();
            }}
        >
            <DialogContent className={`${s.card} border ${s.divider} text-left`}>
                <DialogHeader>
                    <DialogTitle className={s.heading}>{HIGH_DISCOUNT_CONFIRM_TITLE}</DialogTitle>
                </DialogHeader>
                <div className={`space-y-3 text-sm ${s.body}`}>
                    <p>{HIGH_DISCOUNT_CONFIRM_BODY}</p>
                    <p>
                        Discount: <strong>{discountPct}%</strong>
                    </p>
                    {showWarning && (
                        <p role="status" className={`${s.noticeBox} text-sm`}>
                            {HIGH_DISCOUNT_WARNING_BODY}
                        </p>
                    )}
                </div>
                <DialogFooter className="gap-2 sm:gap-2">
                    <button type="button" onClick={onCancel} className={s.secondaryButton}>
                        Cancel
                    </button>
                    <button type="button" onClick={onConfirm} className={s.primaryButton}>
                        Confirm and save
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}