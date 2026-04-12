"use client";

import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { Download } from "lucide-react";
// Sprint 58 P3.3 — migrated to the shared pdf-money helper.
import { formatGbp as gbp } from "@/lib/pdf/pdf-money";
import { BRAND } from "@/lib/pdf/pdf-utils";

// Subset prop shapes — covers both the local Variation interface in
// variations-client.tsx and the canonical @/types/domain one.
interface VariationLike {
    title?: string | null;
    description?: string | null;
    amount: number | string;
    variation_number?: string | null;
    instruction_type?: string | null;
    trade_section?: string | null;
    instructed_by?: string | null;
    date_instructed?: string | null;
    status?: string | null;
    approval_reference?: string | null;
    approval_date?: string | null;
    rejection_reason?: string | null;
}

interface ProjectLike {
    name: string;
    client_name?: string | null;
    site_address?: string | null;
}

interface Props {
    variation: VariationLike;
    project: ProjectLike;
}

export default function VariationPdfButton({ variation, project }: Props) {
    const generatePdf = () => {
        const doc = new jsPDF() as any;
        const margin = 20;
        const pageW = 210;
        let y = 20;

        // ── HEADER ──
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageW, 38, "F");

        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("VARIATION INSTRUCTION", margin, 16);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184);
        doc.text(variation.variation_number ?? "VARIATION", margin, 24);
        doc.text(`Issued: ${new Date().toLocaleDateString("en-GB")}`, margin, 30);

        // Status badge area
        const statusColours: Record<string, [number, number, number]> = {
            Approved:           [16, 185, 129],
            "Pending Approval": [245, 158, 11],
            Draft:              [100, 116, 139],
            Rejected:           [239, 68, 68],
        };
        const status = variation.status ?? "Draft";
        const sc = statusColours[status] ?? statusColours.Draft;
        doc.setFillColor(...sc);
        doc.roundedRect(pageW - margin - 36, 12, 36, 10, 2, 2, "F");
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(status.toUpperCase(), pageW - margin - 18, 19, { align: "center" });

        y = 50;

        // ── PROJECT / CLIENT BLOCK ──
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(71, 85, 105);
        doc.text("PROJECT", margin, y);
        doc.text("CLIENT", 110, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(10);
        doc.text(project?.name ?? "—", margin, y);
        doc.text(project?.client_name ?? "—", 110, y);
        y += 6;
        if (project?.site_address) {
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(project.site_address, margin, y);
            y += 5;
        }

        y += 8;
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, y, pageW - margin, y);
        y += 10;

        // ── INSTRUCTION DETAILS ──
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(71, 85, 105);
        doc.text("INSTRUCTION DETAILS", margin, y);
        y += 7;

        const details: [string, string][] = [
            ["Variation Number",  variation.variation_number ?? "—"],
            ["Title",             variation.title ?? "—"],
            ["Instruction Type",  variation.instruction_type ?? "Client Instruction"],
            ["Trade / Section",   variation.trade_section ?? "—"],
            ["Instructed By",     variation.instructed_by ?? "—"],
            ["Date Instructed",   variation.date_instructed ? new Date(variation.date_instructed).toLocaleDateString("en-GB") : "—"],
        ];

        details.forEach(([label, value]) => {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(71, 85, 105);
            doc.setFontSize(8);
            doc.text(label + ":", margin, y);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(9);
            doc.text(value, margin + 42, y);
            y += 6;
        });

        y += 4;
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, y, pageW - margin, y);
        y += 10;

        // ── DESCRIPTION ──
        if (variation.description) {
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(71, 85, 105);
            doc.text("DESCRIPTION OF WORKS", margin, y);
            y += 6;
            doc.setFont("helvetica", "normal");
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(9);
            const lines = doc.splitTextToSize(variation.description, pageW - margin * 2);
            doc.text(lines, margin, y);
            y += lines.length * 5 + 8;
            doc.setDrawColor(226, 232, 240);
            doc.line(margin, y, pageW - margin, y);
            y += 10;
        }

        // ── VALUATION ──
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(71, 85, 105);
        doc.text("FINANCIAL EFFECT", margin, y);
        y += 7;

        doc.autoTable({
            startY: y,
            margin: { left: margin, right: margin },
            head: [["Description", "Amount"]],
            body: [
                ["Variation to Original Contract Sum", gbp(Number(variation.amount))],
            ],
            theme: "striped",
            headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 9 },
            columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
        });

        y = doc.lastAutoTable.finalY + 10;

        // Value box
        doc.setFillColor(239, 246, 255);
        doc.setDrawColor(147, 197, 253);
        doc.roundedRect(pageW - margin - 70, y, 70, 18, 2, 2, "FD");
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(71, 85, 105);
        doc.text("NET VARIATION VALUE", pageW - margin - 35, y + 6, { align: "center" });
        doc.setFontSize(13);
        doc.setTextColor(37, 99, 235);
        doc.text(gbp(Number(variation.amount)), pageW - margin - 35, y + 14, { align: "center" });
        y += 28;

        // ── APPROVAL ──
        if (variation.status === "Approved" && (variation.approval_reference || variation.approval_date)) {
            doc.setDrawColor(16, 185, 129);
            doc.setFillColor(240, 253, 244);
            doc.roundedRect(margin, y, pageW - margin * 2, 20, 2, 2, "FD");
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(5, 150, 105);
            doc.text("APPROVED", margin + 5, y + 8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(15, 23, 42);
            if (variation.approval_reference) doc.text(`Ref: ${variation.approval_reference}`, margin + 5, y + 14);
            if (variation.approval_date) doc.text(`Date: ${new Date(variation.approval_date).toLocaleDateString("en-GB")}`, 120, y + 14);
            y += 28;
        }

        if (variation.status === "Rejected" && variation.rejection_reason) {
            doc.setDrawColor(239, 68, 68);
            doc.setFillColor(254, 242, 242);
            doc.roundedRect(margin, y, pageW - margin * 2, 20, 2, 2, "FD");
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(185, 28, 28);
            doc.text("REJECTED", margin + 5, y + 8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(15, 23, 42);
            const rLines = doc.splitTextToSize(`Reason: ${variation.rejection_reason}`, pageW - margin * 2 - 10);
            doc.text(rLines, margin + 5, y + 14);
            y += 28;
        }

        // ── SIGNATURE BLOCK ──
        y = Math.max(y + 10, 240);
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, y, margin + 60, y);
        doc.line(110, y, 110 + 60, y);
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text("Contractor Signature / Date", margin, y + 5);
        doc.text("Client Acknowledgement / Date", 110, y + 5);

        // ── FOOTER ──
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text("This document forms part of the contract. Retain for your records.", margin, 288);
        doc.text(`Generated by Constructa · ${new Date().toLocaleDateString("en-GB")}`, pageW - margin, 288, { align: "right" });

        doc.save(`${variation.variation_number ?? "Variation"}_${project?.name ?? "Project"}.pdf`);
    };

    return (
        <button
            onClick={generatePdf}
            className="h-7 px-2 flex items-center gap-1 rounded-md text-blue-400 hover:bg-blue-500/10 text-[11px] font-semibold transition-colors"
            title="Download variation PDF"
        >
            <Download className="w-3.5 h-3.5" />
            PDF
        </button>
    );
}
