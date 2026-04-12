/**
 * Proposal PDF — Fee Proposal + Timeline section (page 5+).
 *
 * Full or summary pricing mode, grand total box, payment schedule,
 * validity statement, and Gantt timeline chart.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
    type ProposalContext,
    PAGE_W, ML, MR, CW,
    addPageHeader, renderSectionHeading, ensureSpace,
    formatGbp, formatDate, GANTT_COLORS,
} from "./helpers";

export function renderFeeProposal(ctx: ProposalContext): number {
    const {
        doc, T, companyName, docTitle, displayTotal, totalPagesRef,
        project, pdfEstimates, computeContractSum, today, validUntil, validityDays,
    } = ctx;

    doc.addPage();
    totalPagesRef.n++;
    let y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef, T);
    y = renderSectionHeading(doc, y, "Fee Proposal", T);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...T.textMid);
    doc.text("All prices exclusive of VAT unless stated.", ML, y);
    y += 10;

    // Original logic: "full" mode renders line items when estimate lines exist
    if (ctx.pricingMode === "full" && pdfEstimates.some((est: any) => (est.estimate_lines || []).length > 0)) {
        y = renderFullMode(ctx, y);
    } else {
        y = renderSummaryMode(ctx, y);
    }

    // Grand total box
    y = renderGrandTotal(ctx, y);

    // Payment schedule
    y = renderPaymentSchedule(ctx, y);

    // Validity statement
    y = ensureSpace(doc, y, 15, companyName, docTitle, totalPagesRef, T);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...T.textMid);
    const validityText = `This Proposal is valid for ${validityDays} days from the date of issue (${formatDate(today)}). After this period, rates may be subject to review.`;
    const validityLines = doc.splitTextToSize(validityText, CW);
    doc.text(validityLines, ML, y);
    y += validityLines.length * 5 + 6;

    // Timeline
    y = renderTimeline(ctx, y);

    return y;
}

// ── Full pricing mode ──────────────────────────────────────────────────────

function renderFullMode(ctx: ProposalContext, startY: number): number {
    const { doc, T, companyName, docTitle, totalPagesRef, pdfEstimates, computeContractSum } = ctx;
    let y = startY;

    if (!pdfEstimates.some((est: any) => (est.estimate_lines || []).length > 0)) {
        return y;
    }

    pdfEstimates.forEach((est: any) => {
        const { directCost, prelimsTotal, contractSum: estContractSum, ohRiskProfitMultiplier } = computeContractSum(est);
        const allLines = (est.estimate_lines || []).filter((l: any) => l.description && l.description !== "\u2014" && (l.line_total || 0) > 0);

        // Group by trade section — separate out Preliminaries
        const sectionMap: Record<string, any[]> = {};
        allLines.forEach((line: any) => {
            const sec = line.trade_section || "General";
            if (sec === "Preliminaries") return;
            if (!sectionMap[sec]) sectionMap[sec] = [];
            sectionMap[sec].push(line);
        });

        Object.entries(sectionMap).forEach(([sectionName, sectionLines]) => {
            const bodyRows = sectionLines.map((line: any) => {
                const desc = line.mom_item_code ? `[${line.mom_item_code}] ${line.description}` : line.description;
                const allInRate = (line.unit_rate || 0) * ohRiskProfitMultiplier;
                const allInTotal = (line.line_total || 0) * ohRiskProfitMultiplier;
                return [desc || "", String(line.quantity ?? ""), line.unit || "", formatGbp(allInRate), formatGbp(allInTotal)];
            });

            const sectionAllInTotal = sectionLines.reduce((s: number, l: any) => s + ((l.line_total || 0) * ohRiskProfitMultiplier), 0);

            autoTable(doc, {
                startY: y,
                head: [
                    [{ content: sectionName, colSpan: 5, styles: { halign: "left" as const, fillColor: T.primary as any, textColor: T.accent as any, fontSize: 10, fontStyle: "bold" as const } }],
                    ["Description", "Qty", "Unit", "Rate", "Total"],
                ],
                body: bodyRows,
                foot: [[sectionName + " Subtotal", "", "", "", formatGbp(sectionAllInTotal)]],
                theme: "grid",
                margin: { left: ML, right: PAGE_W - MR },
                headStyles: { fillColor: T.primaryMid as any, textColor: T.white as any, fontStyle: "bold", fontSize: 8.5 },
                bodyStyles: { fontSize: 9, textColor: T.textDark as any, cellPadding: 3 },
                footStyles: { fillColor: T.surface as any, textColor: T.textDark as any, fontStyle: "bold", fontSize: 9 },
                columnStyles: {
                    0: { cellWidth: "auto" },
                    1: { cellWidth: 18, halign: "center" as const },
                    2: { cellWidth: 20, halign: "center" as const },
                    3: { cellWidth: 30, halign: "right" as const },
                    4: { cellWidth: 30, halign: "right" as const },
                },
                alternateRowStyles: { fillColor: T.surface as any },
                tableLineColor: T.borderLight as any,
                tableLineWidth: 0.2,
                didDrawPage: () => { totalPagesRef.n = doc.getNumberOfPages(); },
            });

            y = (doc as any).lastAutoTable.finalY + 5;
        });

        // Prelims
        const prelimLines = allLines.filter((l: any) => (l.trade_section || "General") === "Preliminaries");
        if (prelimsTotal > 0) {
            const prelimsAllIn = prelimsTotal * ohRiskProfitMultiplier;
            const prelimBodyRows = prelimLines.length > 0
                ? prelimLines.map((line: any) => {
                    const desc = line.mom_item_code ? `[${line.mom_item_code}] ${line.description}` : line.description;
                    const allInRate = (line.unit_rate || 0) * ohRiskProfitMultiplier;
                    const allInTotal = (line.line_total || 0) * ohRiskProfitMultiplier;
                    return [desc || "", String(line.quantity ?? ""), line.unit || "", formatGbp(allInRate), formatGbp(allInTotal)];
                })
                : [["Preliminaries", "1", "item", formatGbp(prelimsAllIn), formatGbp(prelimsAllIn)]];
            autoTable(doc, {
                startY: y,
                head: [
                    [{ content: "Preliminaries", colSpan: 5, styles: { halign: "left" as const, fillColor: T.primary as any, textColor: T.accent as any, fontSize: 10, fontStyle: "bold" as const } }],
                    ["Description", "Qty", "Unit", "Rate", "Total"],
                ],
                body: prelimBodyRows,
                foot: [["Preliminaries Subtotal", "", "", "", formatGbp(prelimsAllIn)]],
                theme: "grid",
                margin: { left: ML, right: PAGE_W - MR },
                headStyles: { fillColor: T.primaryMid as any, textColor: T.white as any, fontStyle: "bold", fontSize: 8.5 },
                bodyStyles: { fontSize: 9, textColor: T.textDark as any, cellPadding: 3 },
                footStyles: { fillColor: T.surface as any, textColor: T.textDark as any, fontStyle: "bold", fontSize: 9 },
                columnStyles: {
                    0: { cellWidth: "auto" },
                    1: { cellWidth: 18, halign: "center" as const },
                    2: { cellWidth: 20, halign: "center" as const },
                    3: { cellWidth: 30, halign: "right" as const },
                    4: { cellWidth: 30, halign: "right" as const },
                },
                alternateRowStyles: { fillColor: T.surface as any },
                tableLineColor: T.borderLight as any,
                tableLineWidth: 0.2,
                didDrawPage: () => { totalPagesRef.n = doc.getNumberOfPages(); },
            });
            y = (doc as any).lastAutoTable.finalY + 5;
        }
    });

    return y;
}

// ── Summary pricing mode ───────────────────────────────────────────────────

function renderSummaryMode(ctx: ProposalContext, startY: number): number {
    const { doc, T, totalPagesRef, pdfEstimates, computeContractSum } = ctx;
    let y = startY;

    const summaryRows: string[][] = [];

    pdfEstimates.forEach((est: any) => {
        const { directCost, prelimsTotal, totalConstructionCost, contractSum: estContractSum } = computeContractSum(est);
        const allLines = (est.estimate_lines || []).filter((l: any) => l.description && l.description !== "\u2014" && (l.line_total || 0) > 0);
        const totalDirectCost = directCost;

        const sectionTotals: Record<string, number> = {};
        allLines.forEach((line: any) => {
            const sec = line.trade_section || "General";
            if (sec === "Preliminaries") return;
            sectionTotals[sec] = (sectionTotals[sec] || 0) + (line.line_total || 0);
        });

        Object.entries(sectionTotals).forEach(([sectionName, sectionDirectCost]) => {
            const sectionAllIn = totalDirectCost > 0 ? (sectionDirectCost / totalDirectCost) * estContractSum : sectionDirectCost;
            summaryRows.push([sectionName, formatGbp(sectionAllIn)]);
        });

        if (prelimsTotal > 0) {
            const prelimsAllIn = totalDirectCost > 0 ? (prelimsTotal / totalConstructionCost) * estContractSum : prelimsTotal;
            summaryRows.push(["Preliminaries", formatGbp(prelimsAllIn)]);
        }
    });

    if (summaryRows.length > 0) {
        autoTable(doc, {
            startY: y,
            head: [["Section", "Amount (\u00A3)"]],
            body: summaryRows,
            theme: "grid",
            margin: { left: ML, right: PAGE_W - MR },
            headStyles: { fillColor: T.primary as any, textColor: T.accent as any, fontStyle: "bold", fontSize: 9 },
            bodyStyles: { fontSize: 10, textColor: T.textDark as any, cellPadding: 4 },
            columnStyles: { 1: { halign: "right" as const, cellWidth: 45 } },
            alternateRowStyles: { fillColor: T.surface as any },
            tableLineColor: T.borderLight as any,
            tableLineWidth: 0.2,
            didDrawPage: () => { totalPagesRef.n = doc.getNumberOfPages(); },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
    }

    return y;
}

// ── Grand total box ────────────────────────────────────────────────────────

function renderGrandTotal(ctx: ProposalContext, startY: number): number {
    const { doc, T, companyName, docTitle, displayTotal, totalPagesRef } = ctx;
    let y = ensureSpace(doc, startY, 50, companyName, docTitle, totalPagesRef, T);
    y += 4;

    // CONTRACT SUM (exc. VAT)
    doc.setFillColor(...T.surface);
    doc.rect(ML, y, MR - ML, 10, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...T.textMid);
    doc.text("CONTRACT SUM (exc. VAT)", ML + 4, y + 6.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...T.textDark);
    doc.text(formatGbp(displayTotal), MR - 4, y + 6.5, { align: "right" });
    y += 12;

    // VAT line
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...T.textMid);
    doc.text("VAT @ 20%", ML + 4, y);
    doc.text(formatGbp(displayTotal * 0.2), MR - 4, y, { align: "right" });
    y += 4;

    // Separator
    doc.setDrawColor(...T.primary);
    doc.setLineWidth(0.8);
    doc.line(ML, y, MR, y);
    y += 4;

    // TOTAL PAYABLE INC. VAT
    doc.setFillColor(...T.primary);
    doc.rect(ML, y, MR - ML, 18, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...T.muted);
    doc.text("TOTAL PAYABLE INC. VAT", ML + 4, y + 7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...T.accent);
    doc.text(formatGbp(displayTotal * 1.2), MR - 4, y + 13, { align: "right" });
    y += 22;

    return y;
}

// ── Payment schedule ───────────────────────────────────────────────────────

function renderPaymentSchedule(ctx: ProposalContext, startY: number): number {
    const { doc, T, companyName, docTitle, displayTotal, totalPagesRef, project } = ctx;
    let y = startY;

    const paymentSchedule = project?.payment_schedule;
    const paymentScheduleType = project?.payment_schedule_type || "percentage";
    if (!paymentSchedule || paymentSchedule.length === 0) return y;

    y = ensureSpace(doc, y, 30, companyName, docTitle, totalPagesRef, T);
    y += 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...T.textDark);
    doc.text("Payment Schedule", ML, y);
    y += 8;

    if (paymentScheduleType === "milestone") {
        const payRows = paymentSchedule.map((row: any) => [
            row.stage || "",
            row.description || "",
            row.amount ? formatGbp(row.amount) : "\u2014",
        ]);

        autoTable(doc, {
            startY: y,
            head: [["Stage", "Trigger", "\u00A3 Amount"]],
            body: payRows,
            theme: "grid",
            margin: { left: ML, right: PAGE_W - MR },
            headStyles: { fillColor: T.primary as any, textColor: T.accent as any, fontStyle: "bold", fontSize: 9 },
            bodyStyles: { fontSize: 9.5, textColor: T.textDark as any, cellPadding: 3.5 },
            columnStyles: {
                0: { cellWidth: 45, fontStyle: "bold" },
                2: { cellWidth: 35, halign: "right" as const, fontStyle: "bold" },
            },
            alternateRowStyles: { fillColor: T.surface as any },
            tableLineColor: T.borderLight as any,
            tableLineWidth: 0.2,
            didDrawPage: () => { totalPagesRef.n = doc.getNumberOfPages(); },
        });
    } else {
        const payRows = paymentSchedule.map((row: any) => {
            const amount = displayTotal ? (displayTotal * row.percentage) / 100 : 0;
            return [
                row.stage || "",
                row.description || "",
                `${row.percentage}%`,
                amount > 0 ? formatGbp(amount) : "\u2014",
            ];
        });

        autoTable(doc, {
            startY: y,
            head: [["Stage", "Description", "%", "\u00A3 Amount"]],
            body: payRows,
            theme: "grid",
            margin: { left: ML, right: PAGE_W - MR },
            headStyles: { fillColor: T.primary as any, textColor: T.accent as any, fontStyle: "bold", fontSize: 9 },
            bodyStyles: { fontSize: 9.5, textColor: T.textDark as any, cellPadding: 3.5 },
            columnStyles: {
                0: { cellWidth: 45, fontStyle: "bold" },
                2: { cellWidth: 18, halign: "center" as const },
                3: { cellWidth: 35, halign: "right" as const, fontStyle: "bold" },
            },
            alternateRowStyles: { fillColor: T.surface as any },
            tableLineColor: T.borderLight as any,
            tableLineWidth: 0.2,
            didDrawPage: () => { totalPagesRef.n = doc.getNumberOfPages(); },
        });
    }
    y = (doc as any).lastAutoTable.finalY + 8;
    return y;
}

// ── Project timeline (Gantt) ───────────────────────────────────────────────

function renderTimeline(ctx: ProposalContext, startY: number): number {
    const { doc, T, companyName, docTitle, totalPagesRef, project } = ctx;
    let y = startY;

    const programmePhasesRaw = project?.programme_phases || project?.gantt_phases || project?.timeline_phases || [];
    const rawPhases: any[] = Array.isArray(programmePhasesRaw) ? programmePhasesRaw : [];
    const phases: any[] = rawPhases.length > 0
        ? rawPhases
        : (project?.brief_trade_sections || []).map((trade: string, i: number) => ({
            name: trade, duration_days: 14, color: Object.keys(GANTT_COLORS)[i % Object.keys(GANTT_COLORS).length],
        }));
    if (phases.length === 0) return y;

    doc.addPage();
    totalPagesRef.n++;
    y = addPageHeader(doc, companyName, docTitle, totalPagesRef.n, totalPagesRef, T);
    y = renderSectionHeading(doc, y, "Project Timeline", T);

    const projectStartDate = new Date(project?.start_date || Date.now());
    let cumulativeWeeks = 0;
    const phasesWithOffsets = phases.map((phase: any) => {
        const durationDays = phase.duration_days ?? phase.manualDays ?? phase.calculatedDays ?? 7;
        const durationWeeks = Math.ceil(durationDays / 7);
        let startWeek: number;

        if (phase.startOffset !== undefined) {
            startWeek = Math.round(phase.startOffset / 7);
        } else if (phase.start_date) {
            const pStart = new Date(phase.start_date).getTime();
            const projStart = projectStartDate.getTime();
            startWeek = Math.max(0, Math.round((pStart - projStart) / (7 * 86400000)));
        } else {
            startWeek = cumulativeWeeks;
        }

        const p = { ...phase, startWeek, durationWeeks };
        cumulativeWeeks = startWeek + durationWeeks;
        return p;
    });

    const totalWeeks = Math.max(
        phasesWithOffsets.reduce((max: number, p: any) => Math.max(max, p.startWeek + p.durationWeeks), 0),
        4,
    );

    const labelColW = 60;
    const durationColW = 22;
    const chartX = ML + labelColW + durationColW;
    const chartW = CW - labelColW - durationColW;
    const rowH = 13;
    const headerH = 16;
    const visibleWeeks = Math.min(totalWeeks, 26);
    const weekW = chartW / Math.max(1, visibleWeeks);
    const ganttColorKeys = Object.keys(GANTT_COLORS);

    // Header row
    doc.setFillColor(...T.primary);
    doc.rect(ML, y, CW, headerH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...T.accent);
    doc.text("Phase", ML + 3, y + 6.5);
    doc.text("Duration", ML + labelColW + 2, y + 6.5);

    for (let w = 0; w < visibleWeeks; w++) {
        const weekDate = new Date(projectStartDate);
        weekDate.setDate(weekDate.getDate() + w * 7);
        const weekLabel = `W${w + 1}`;
        const xPos = chartX + w * weekW + weekW / 2;

        if (weekW >= 6 || w % 2 === 0) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
            doc.setTextColor(...T.accent);
            doc.text(weekLabel, xPos, y + 5, { align: "center" });

            doc.setFontSize(5.5);
            doc.setTextColor(...T.muted);
            const dateLabel = `${weekDate.getDate()} ${weekDate.toLocaleString("en-GB", { month: "short" })}`;
            doc.text(dateLabel, xPos, y + 10, { align: "center" });
        }
    }
    y += headerH;

    // Phase rows
    phasesWithOffsets.forEach((phase: any, idx: number) => {
        const isEven = idx % 2 === 0;
        doc.setFillColor(...(isEven ? T.surface : T.white));
        doc.rect(ML, y, CW, rowH, "F");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...T.textDark);
        const phaseName = doc.splitTextToSize(phase.name || `Phase ${idx + 1}`, labelColW - 4);
        doc.text(phaseName[0], ML + 3, y + 6.5);

        doc.setFontSize(7.5);
        doc.setTextColor(...T.textMid);
        const durLabel = `${phase.durationWeeks} ${phase.durationWeeks === 1 ? "wk" : "wks"}`;
        doc.text(durLabel, ML + labelColW + 2, y + 6.5);

        const barX = chartX + phase.startWeek * weekW;
        const barW = Math.max(phase.durationWeeks * weekW - 2, weekW * 0.8);
        const clampedBarW = Math.min(barW, chartX + chartW - barX - 2);
        const barColor = GANTT_COLORS[phase.color] || GANTT_COLORS[ganttColorKeys[idx % ganttColorKeys.length]];

        if (clampedBarW > 0) {
            doc.setFillColor(...barColor);
            doc.roundedRect(barX, y + 2, clampedBarW, rowH - 4, 1.5, 1.5, "F");

            if (clampedBarW > 18) {
                const barStartDate = new Date(projectStartDate);
                barStartDate.setDate(barStartDate.getDate() + phase.startWeek * 7);
                const barLabel = `${barStartDate.getDate()} ${barStartDate.toLocaleString("en-GB", { month: "short" })}`;
                doc.setFont("helvetica", "bold");
                doc.setFontSize(6.5);
                doc.setTextColor(...T.white);
                doc.text(barLabel, barX + 3, y + 6.5);
            }
        }

        for (let w = 0; w <= visibleWeeks; w++) {
            doc.setDrawColor(...T.borderLight);
            doc.setLineWidth(0.15);
            doc.line(chartX + w * weekW, y, chartX + w * weekW, y + rowH);
        }

        y += rowH;
    });

    // Border
    doc.setDrawColor(...T.borderLight);
    doc.setLineWidth(0.3);
    doc.rect(ML, y - phases.length * rowH - headerH, CW, phases.length * rowH + headerH, "S");

    y += 5;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...T.textMid);
    doc.text("Note: Timeline is indicative. Final programme subject to agreement on acceptance.", ML, y);
    y += 8;

    return y;
}
