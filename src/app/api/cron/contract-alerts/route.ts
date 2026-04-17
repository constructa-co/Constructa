/**
 * Constructa — Daily contract alert digest cron.
 *
 * Sprint 59 Phase 2. Sweeps every user's contract events + obligations
 * and emails a digest of imminent time bars and overdue/due-soon items.
 * The in-app banner from `e149cfa` only fires when the contractor is
 * actively looking; this closes the loop for the contractor who isn't.
 *
 * Schedule: daily at 07:00 UTC (08:00 BST). Configured in vercel.json.
 *
 * Auth: Vercel cron requests carry a header `Authorization: Bearer
 * ${CRON_SECRET}`. We validate that header before doing any work, so a
 * curious internet user can't trigger contractor emails by hitting the
 * URL. CRON_SECRET must be set in Vercel project env vars.
 *
 * Idempotency: every email send is recorded in
 * `contract_alert_notifications` (event_id OR obligation_id, alert_type,
 * stage, days_remaining, sent_at). The cadence rule:
 *
 *   - First alert when an item enters the warning window — always sent
 *   - Second alert 7 days later if still in the window
 *   - Daily alerts in the final 3 days for time bars <= 3 days out
 *   - Once status becomes 'complete' or the time bar passes by more
 *     than 7 days, we stop notifying
 *
 * Failure semantics: per-user processing. If one user's email send
 * fails, we log it and continue. The endpoint never returns 500 unless
 * something has corrupted the cron itself.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendContractAlertEmail, type ContractAlertDigestItem } from "@/lib/email";
import { calendarDayDiff } from "@/lib/dates";

// Vercel cron expects this route to be a Node runtime, not edge — Resend
// SDK pulls in node:crypto.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Auth ────────────────────────────────────────────────────────────────────

function isAuthorisedCron(req: NextRequest): boolean {
    const auth = req.headers.get("authorization") ?? "";
    const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
    if (!process.env.CRON_SECRET) return false;
    // Constant-time comparison would be ideal but the secret is high-entropy
    // and the failure mode here is "the wrong person triggers a no-op", so
    // a plain equality check is fine.
    return auth === expected;
}

// ── Cadence helpers ─────────────────────────────────────────────────────────

// P1-8 — All day-diff math goes through calendarDayDiff so DST
// transitions (BST ↔ GMT on the last Sunday of March/October) can
// never cause a time-bar alert to fire a day early or miss the
// final-stretch warning entirely.
function daysBetween(fromIso: string, toMs: number): number {
    return calendarDayDiff(fromIso, new Date(toMs));
}

/**
 * Decide whether we should send a notification for this item now,
 * given prior notifications. Returns null if we should skip, or the
 * stage number to record if we should send.
 */
function decideStage(
    daysRemaining: number,
    priorStages: { stage: number; sent_at: string }[],
): number | null {
    // Stop entirely if the time bar is more than 7 days past — the boat
    // has sailed and the contractor knows it.
    if (daysRemaining < -7) return null;

    // First time we've ever notified this item — always send.
    if (priorStages.length === 0) return 1;

    const last = priorStages[0]; // assumed sorted desc by sent_at
    const daysSinceLast = calendarDayDiff(new Date(), last.sent_at);

    // Final stretch — daily alerts for time bars in the last 3 days.
    if (daysRemaining >= 0 && daysRemaining <= 3) {
        if (daysSinceLast >= 1) return last.stage + 1;
        return null;
    }

    // Mid range — re-warn weekly until we hit the final stretch.
    if (daysSinceLast >= 7) return last.stage + 1;

    return null;
}

// ── Main handler ────────────────────────────────────────────────────────────

interface UserBucket {
    userId: string;
    items: ContractAlertDigestItem[];
    /** New notification rows to insert if the email send succeeds. */
    pendingInserts: {
        event_id?: string;
        obligation_id?: string;
        alert_type: ContractAlertDigestItem["type"];
        stage: number;
        days_remaining: number;
    }[];
}

export async function GET(request: NextRequest) {
    if (!isAuthorisedCron(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const startedAt = Date.now();
    const todayIso = new Date().toISOString().slice(0, 10);

    // Fetch the universe of items in one go. The result set is small —
    // even 100 active SME contractors with 5 jobs each tops out around
    // a few thousand rows. RLS is intentionally bypassed by the service
    // role; we group by user_id in JS.
    const [{ data: events, error: eventsErr }, { data: obligations, error: oblErr }] = await Promise.all([
        supabase
            .from("contract_events")
            .select("id, user_id, project_id, reference, title, time_bar_date, event_type")
            .eq("status", "open")
            .not("time_bar_date", "is", null),
        supabase
            .from("contract_obligations")
            .select("id, user_id, project_id, label, clause_ref, due_date")
            .neq("status", "complete")
            .not("due_date", "is", null),
    ]);

    if (eventsErr || oblErr) {
        console.error("[contract-alerts] fetch error", { eventsErr, oblErr });
        return NextResponse.json(
            { error: "Failed to load events/obligations", details: eventsErr || oblErr },
            { status: 500 },
        );
    }

    // Resolve project names in one query
    const projectIds = Array.from(new Set([
        ...(events ?? []).map(e => e.project_id),
        ...(obligations ?? []).map(o => o.project_id),
    ]));
    const { data: projects } = projectIds.length
        ? await supabase.from("projects").select("id, name").in("id", projectIds)
        : { data: [] as { id: string; name: string }[] };
    const projectName = (id: string) =>
        (projects ?? []).find(p => p.id === id)?.name ?? "Unknown project";

    // Pull every prior notification in one go so we can decide cadence
    // without N+1 queries. Cap at 30 days back — older rows aren't relevant.
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data: priorNotifs } = await supabase
        .from("contract_alert_notifications")
        .select("user_id, event_id, obligation_id, alert_type, stage, sent_at")
        .gte("sent_at", since);

    const priorByEvent = new Map<string, { stage: number; sent_at: string }[]>();
    const priorByObligation = new Map<string, { stage: number; sent_at: string }[]>();
    (priorNotifs ?? []).forEach(n => {
        if (n.event_id) {
            const list = priorByEvent.get(n.event_id) ?? [];
            list.push({ stage: n.stage, sent_at: n.sent_at });
            priorByEvent.set(n.event_id, list);
        } else if (n.obligation_id) {
            const list = priorByObligation.get(n.obligation_id) ?? [];
            list.push({ stage: n.stage, sent_at: n.sent_at });
            priorByObligation.set(n.obligation_id, list);
        }
    });
    // Sort each list desc by sent_at
    priorByEvent.forEach(list => list.sort((a, b) => b.sent_at.localeCompare(a.sent_at)));
    priorByObligation.forEach(list => list.sort((a, b) => b.sent_at.localeCompare(a.sent_at)));

    // Bucket items by user
    const buckets = new Map<string, UserBucket>();
    const bucket = (userId: string): UserBucket => {
        let b = buckets.get(userId);
        if (!b) {
            b = { userId, items: [], pendingInserts: [] };
            buckets.set(userId, b);
        }
        return b;
    };

    // UTC midnight — matches calendarDayDiff's normalisation so the
    // daysBetween() call below is DST-safe.
    const now = new Date();
    const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    // ── Time bars ──────────────────────────────────────────────────────────
    (events ?? []).forEach(e => {
        if (!e.time_bar_date) return;
        const days = daysBetween(e.time_bar_date, todayMs);
        // Window: −7 (overdue grace) to +14 days
        if (days < -7 || days > 14) return;

        const prior = priorByEvent.get(e.id) ?? [];
        const stage = decideStage(days, prior);
        if (stage === null) return;

        const b = bucket(e.user_id);
        b.items.push({
            type: "time_bar_warning",
            title: `${e.reference ?? "Event"} — ${e.title ?? "Untitled"}`,
            detail: `Time bar expires ${new Date(e.time_bar_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. Notify before this date or risk losing entitlement.`,
            projectName: projectName(e.project_id),
            projectId: e.project_id,
            daysRemaining: days,
        });
        b.pendingInserts.push({
            event_id: e.id,
            alert_type: "time_bar_warning",
            stage,
            days_remaining: days,
        });
    });

    // ── Obligations ────────────────────────────────────────────────────────
    (obligations ?? []).forEach(o => {
        if (!o.due_date) return;
        const days = daysBetween(o.due_date, todayMs);
        // Window: any overdue (we cap stop at -7 in cadence) to +7 days ahead
        if (days < -30 || days > 7) return;

        const prior = priorByObligation.get(o.id) ?? [];
        const stage = decideStage(days, prior);
        if (stage === null) return;

        const isOverdue = days < 0;
        const b = bucket(o.user_id);
        b.items.push({
            type: isOverdue ? "obligation_overdue" : "obligation_due_soon",
            title: o.label,
            detail: isOverdue
                ? `This obligation was due on ${new Date(o.due_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`
                : `Due ${new Date(o.due_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`,
            projectName: projectName(o.project_id),
            projectId: o.project_id,
            daysRemaining: days,
            clauseRef: o.clause_ref ?? undefined,
        });
        b.pendingInserts.push({
            obligation_id: o.id,
            alert_type: isOverdue ? "obligation_overdue" : "obligation_due_soon",
            stage,
            days_remaining: days,
        });
    });

    // ── Send digest emails ─────────────────────────────────────────────────
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const failures: { userId: string; error: string }[] = [];

    for (const b of Array.from(buckets.values())) {
        if (b.items.length === 0) {
            skipped += 1;
            continue;
        }

        // Look up the user's email + profile
        const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(b.userId);
        if (authErr || !authUser?.user?.email) {
            failed += 1;
            failures.push({ userId: b.userId, error: authErr?.message ?? "no email" });
            continue;
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("company_name, full_name")
            .eq("id", b.userId)
            .single();

        // P0-1 — Reserve BEFORE sending. The unique indexes on
        // (user_id, event_id|obligation_id, alert_type, stage) make
        // this insert the lock: if a concurrent cron run has already
        // reserved the same row, the insert fails. We handle three
        // states: if existing row is 'sent' or 'pending' → skip (no
        // double-send); if 'failed' → reclaim by flipping back to
        // 'pending' and proceed (retry path).
        const reservedIds: string[] = [];
        let reservationBlocked = false;

        for (const p of b.pendingInserts) {
            const row = {
                user_id: b.userId,
                event_id: p.event_id ?? null,
                obligation_id: p.obligation_id ?? null,
                alert_type: p.alert_type,
                stage: p.stage,
                days_remaining: p.days_remaining,
                status: "pending" as const,
            };

            const { data: inserted, error: insertErr } = await supabase
                .from("contract_alert_notifications")
                .insert(row)
                .select("id")
                .single();

            if (!insertErr && inserted) {
                reservedIds.push(inserted.id);
                continue;
            }

            // Insert blocked by unique constraint — look up the existing row
            let existingQuery = supabase
                .from("contract_alert_notifications")
                .select("id, status")
                .eq("user_id", row.user_id)
                .eq("alert_type", row.alert_type)
                .eq("stage", row.stage);
            if (row.event_id) existingQuery = existingQuery.eq("event_id", row.event_id);
            if (row.obligation_id) existingQuery = existingQuery.eq("obligation_id", row.obligation_id);
            const { data: existing } = await existingQuery.maybeSingle();

            if (!existing) {
                // Insert failed for a non-uniqueness reason. Log and skip.
                console.error("[contract-alerts] reservation failed unexpectedly", {
                    userId: b.userId,
                    error: insertErr?.message,
                });
                reservationBlocked = true;
                break;
            }

            if (existing.status === "sent" || existing.status === "pending") {
                // Already sent or a concurrent run is handling it — skip the whole bucket.
                reservationBlocked = true;
                break;
            }

            // existing.status === "failed" — reclaim the slot for a retry
            const { error: reclaimErr } = await supabase
                .from("contract_alert_notifications")
                .update({ status: "pending", days_remaining: row.days_remaining })
                .eq("id", existing.id);
            if (reclaimErr) {
                console.error("[contract-alerts] failed-row reclaim failed", reclaimErr);
                reservationBlocked = true;
                break;
            }
            reservedIds.push(existing.id);
        }

        if (reservationBlocked) {
            skipped += 1;
            continue;
        }

        try {
            const result = await sendContractAlertEmail({
                contractorEmail: authUser.user.email,
                contractorName: (profile as { full_name?: string } | null)?.full_name,
                companyName: profile?.company_name ?? "Your Company",
                items: b.items,
                dashboardUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://constructa-nu.vercel.app",
            });

            // Send succeeded — flip reservation rows from 'pending' → 'sent'
            // and record the Resend message id for delivery correlation.
            if (reservedIds.length > 0) {
                const { error: markErr } = await supabase
                    .from("contract_alert_notifications")
                    .update({ status: "sent", resend_id: result?.data?.id ?? null })
                    .in("id", reservedIds);
                if (markErr) {
                    console.error("[contract-alerts] mark-sent failed (email went out)", markErr);
                }
            }

            sent += 1;
        } catch (err) {
            // Send failed — flip reservation rows to 'failed' so a later
            // cron run can retry. (The unique index is on status-agnostic
            // keys so the retry inserts a fresh row.)
            if (reservedIds.length > 0) {
                await supabase
                    .from("contract_alert_notifications")
                    .update({ status: "failed" })
                    .in("id", reservedIds);
            }
            failed += 1;
            failures.push({
                userId: b.userId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    const durationMs = Date.now() - startedAt;
    return NextResponse.json({
        ok: true,
        date: todayIso,
        durationMs,
        users: buckets.size,
        sent,
        skipped,
        failed,
        failures: failures.length > 0 ? failures : undefined,
    });
}
