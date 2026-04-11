"use server";

import { requireAuth } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";
import { CONTRACTS_CONFIG, ContractType, addDays } from "@/lib/contracts-config";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const REVALIDATE = () => revalidatePath("/dashboard/projects/contract-admin");

// ─── Contract Setup ───────────────────────────────────────────────────────────

export async function setupContractAction(data: {
  projectId: string;
  contractType: ContractType;
  contractOption?: string;
  awardDate: string;
  startDate?: string;
  completionDate?: string;
  contractValue?: number;
  parties: Record<string, string>;
  notes?: string;
}) {
  const { user, supabase } = await requireAuth();

  const config = CONTRACTS_CONFIG[data.contractType];

  // Upsert contract_settings
  const { error: settingsErr } = await supabase
    .from("contract_settings")
    .upsert({
      user_id:         user.id,
      project_id:      data.projectId,
      contract_type:   data.contractType,
      contract_option: data.contractOption ?? null,
      award_date:      data.awardDate,
      start_date:      data.startDate ?? null,
      completion_date: data.completionDate ?? null,
      contract_value:  data.contractValue ?? null,
      parties:         data.parties,
      notes:           data.notes ?? null,
      updated_at:      new Date().toISOString(),
    }, { onConflict: "project_id" });

  if (settingsErr) return { error: settingsErr.message };

  // Delete old onAward obligations for this project (re-seed if re-setup)
  await supabase
    .from("contract_obligations")
    .delete()
    .eq("project_id", data.projectId)
    .eq("user_id", user.id)
    .is("event_id", null);

  // Seed onAward obligations from config
  const awardObligations = config.onAward
    .filter(t => t.daysFromAward != null)
    .map(t => ({
      user_id:          user.id,
      project_id:       data.projectId,
      event_id:         null,
      obligation_type:  t.type,
      label:            t.label,
      clause_ref:       t.clauseRef,
      party:            t.party,
      due_date:         addDays(data.awardDate, t.daysFromAward!),
      status:           "pending",
    }));

  // Recurring obligations: seed first occurrence at awardDate + 28 days
  const recurringObligations = config.onAward
    .filter(t => t.recurring)
    .map(t => ({
      user_id:          user.id,
      project_id:       data.projectId,
      event_id:         null,
      obligation_type:  t.type,
      label:            `${t.label} (${new Date(addDays(data.awardDate, 28)).toLocaleDateString("en-GB")})`,
      clause_ref:       t.clauseRef,
      party:            t.party,
      due_date:         addDays(data.awardDate, 28),
      status:           "pending",
    }));

  if (awardObligations.length + recurringObligations.length > 0) {
    const { error: oblErr } = await supabase
      .from("contract_obligations")
      .insert([...awardObligations, ...recurringObligations]);
    if (oblErr) return { error: oblErr.message };
  }

  REVALIDATE();
  return { success: true };
}

// ─── Raise Contract Event ─────────────────────────────────────────────────────

export async function raiseEventAction(data: {
  projectId: string;
  contractType: ContractType;
  eventType: string;
  raisedBy: string;
  dateRaised: string;
  dateAware?: string;
  title: string;
  description?: string;
  reference?: string;
}) {
  const { user, supabase } = await requireAuth();

  const config = CONTRACTS_CONFIG[data.contractType];
  const eventConfig = config.events[data.eventType];
  if (!eventConfig) return { error: "Unknown event type" };

  // Compute time bar date
  const timeBarDate = (eventConfig.contractorTimeBarDays && data.dateAware)
    ? addDays(data.dateAware, eventConfig.contractorTimeBarDays)
    : null;

  // Insert the event
  const { data: event, error: evErr } = await supabase
    .from("contract_events")
    .insert({
      user_id:       user.id,
      project_id:    data.projectId,
      event_type:    data.eventType,
      reference:     data.reference ?? null,
      raised_by:     data.raisedBy,
      date_raised:   data.dateRaised,
      date_aware:    data.dateAware ?? null,
      time_bar_date: timeBarDate,
      status:        "open",
      title:         data.title,
      description:   data.description ?? null,
      updated_at:    new Date().toISOString(),
    })
    .select("id")
    .single();

  if (evErr) return { error: evErr.message };

  // Seed obligation chain from config
  const obligations = [];
  let prevDate = data.dateRaised;
  for (const step of eventConfig.chain) {
    if (step.daysFromPrevious === 0) {
      prevDate = data.dateRaised;
      continue; // first step is the raise itself
    }
    const dueDate = addDays(prevDate, step.daysFromPrevious);
    obligations.push({
      user_id:          user.id,
      project_id:       data.projectId,
      event_id:         event.id,
      obligation_type:  step.step,
      label:            `[${data.reference ?? eventConfig.shortLabel}] ${step.label}`,
      clause_ref:       step.clauseRef,
      party:            step.party,
      due_date:         dueDate,
      status:           "pending",
    });
    prevDate = dueDate;
  }

  if (obligations.length > 0) {
    const { error: oblErr } = await supabase
      .from("contract_obligations")
      .insert(obligations);
    if (oblErr) return { error: oblErr.message };
  }

  REVALIDATE();
  return { success: true, eventId: event.id };
}

// ─── Update Obligation Status ─────────────────────────────────────────────────

export async function updateObligationAction(id: string, status: string, notes?: string) {
  const { user, supabase } = await requireAuth();

  const { error } = await supabase
    .from("contract_obligations")
    .update({
      status,
      notes: notes ?? null,
      completed_at: status === "complete" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  REVALIDATE();
  return { success: true };
}

// ─── Update Event Status ──────────────────────────────────────────────────────

export async function updateEventAction(id: string, data: {
  status?: string;
  agreedTime?: number;
  agreedCost?: number;
  assessedTime?: number;
  assessedCost?: number;
}) {
  const { user, supabase } = await requireAuth();

  const { error } = await supabase
    .from("contract_events")
    .update({
      status:        data.status ?? undefined,
      agreed_time:   data.agreedTime ?? undefined,
      agreed_cost:   data.agreedCost ?? undefined,
      assessed_time: data.assessedTime ?? undefined,
      assessed_cost: data.assessedCost ?? undefined,
      updated_at:    new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  REVALIDATE();
  return { success: true };
}

// ─── Log Communication ────────────────────────────────────────────────────────

export async function logCommunicationAction(data: {
  projectId: string;
  eventId?: string;
  direction: string;
  commDate: string;
  reference?: string;
  subject: string;
  body?: string;
  fromParty?: string;
  toParty?: string;
}) {
  const { user, supabase } = await requireAuth();

  const { error } = await supabase.from("contract_communications").insert({
    user_id:    user.id,
    project_id: data.projectId,
    event_id:   data.eventId ?? null,
    direction:  data.direction,
    comm_date:  data.commDate,
    reference:  data.reference ?? null,
    subject:    data.subject,
    body:       data.body ?? null,
    from_party: data.fromParty ?? null,
    to_party:   data.toParty ?? null,
  });

  if (error) return { error: error.message };
  REVALIDATE();
  return { success: true };
}

export async function deleteCommunicationAction(id: string) {
  const { user, supabase } = await requireAuth();
  await supabase.from("contract_communications").delete().eq("id", id).eq("user_id", user.id);
  REVALIDATE();
  return { success: true };
}

// ─── AI Draft Notice ─────────────────────────────────────────────────────────

export async function draftNoticeAction(data: {
  projectId: string;
  contractType: ContractType;
  eventType: string;
  eventId: string;
  eventTitle: string;
  eventDescription?: string;
  dateRaised: string;
  dateAware?: string;
  timeBarDate?: string;
  reference?: string;
  // Project context
  projectName: string;
  clientName?: string;
  contractValue?: number;
  parties: Record<string, string>;
  // Supporting data
  relevantVariations?: { description: string; amount?: number }[];
  programmeDates?: { task: string; planned: string; actual?: string }[];
  recentCosts?: { category: string; amount: number }[];
}) {
  const { user, supabase } = await requireAuth();

  const config = CONTRACTS_CONFIG[data.contractType];
  const eventConfig = config.events[data.eventType];
  const term = config.terminology;

  // Sprint 59 P3 — inject the per-event clause-specific guidance from
  // contracts-config.ts into the system prompt. NEC, JCT and FIDIC each
  // have very different conventions for what a notice MUST contain
  // (NEC 61.3 needs "date aware" wording, JCT 2.27.1 needs "forthwith",
  // FIDIC 20.1 has a hard 28-day condition precedent). The generic
  // suite-agnostic prompt was producing competent-but-bland drafts;
  // the guidance turns them into clause-correct ones.
  const baseSystemPrompt = `You are an expert construction contracts consultant specialising in ${config.label}.
You draft formal contractual notices that are precise, clause-referenced, and comply with the contract requirements.
Always use the correct terminology for this contract: ${term.supervisor} (not "Engineer" or "Architect" unless correct), ${term.employer} (not "Client" unless correct).
Be concise, professional, and reference specific clause numbers. Do not add pleasantries.`;

  const systemPrompt = eventConfig.aiGuidance
    ? `${baseSystemPrompt}\n\n=== CLAUSE-SPECIFIC GUIDANCE FOR THIS EVENT ===\n${eventConfig.aiGuidance}\n=== END GUIDANCE ===`
    : baseSystemPrompt;

  const userPrompt = `Draft a formal ${eventConfig.label} notice for the following:

CONTRACT: ${config.label}${data.parties.pm_org ? ` — ${term.supervisor}: ${data.parties.pm_org}` : ""}
PROJECT: ${data.projectName}
CLIENT: ${data.clientName ?? "—"}
CONTRACT VALUE: ${data.contractValue ? `£${data.contractValue.toLocaleString()}` : "—"}
REFERENCE: ${data.reference ?? "To be assigned"}
DATE RAISED: ${new Date(data.dateRaised).toLocaleDateString("en-GB")}
${data.dateAware ? `DATE AWARE: ${new Date(data.dateAware).toLocaleDateString("en-GB")}` : ""}
${data.timeBarDate ? `TIME BAR DATE: ${new Date(data.timeBarDate).toLocaleDateString("en-GB")} (cl. ${eventConfig.timeBarClause})` : ""}

EVENT TITLE: ${data.eventTitle}
DESCRIPTION: ${data.eventDescription ?? "See below"}

${data.relevantVariations?.length ? `RELEVANT VARIATIONS:\n${data.relevantVariations.map(v => `- ${v.description}${v.amount ? ` (£${v.amount.toLocaleString()})` : ""}`).join("\n")}` : ""}
${data.programmeDates?.length ? `PROGRAMME DATES:\n${data.programmeDates.map(d => `- ${d.task}: planned ${d.planned}${d.actual ? `, actual ${d.actual}` : ""}`).join("\n")}` : ""}
${data.recentCosts?.length ? `COSTS TO DATE:\n${data.recentCosts.map(c => `- ${c.category}: £${c.amount.toLocaleString()}`).join("\n")}` : ""}

Write the complete formal notice. Include:
1. Correct header (To: ${term.supervisor}, From: Contractor, Date, Reference, Subject)
2. Contract clause reference in the opening
3. Clear statement of the ${eventConfig.label}
4. Factual description using the project data above
5. Statement of entitlement and what is being requested
6. Signature block placeholder

Format as plain text, ready to send.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1200,
    });

    const notice = completion.choices[0].message.content ?? "";

    // Save draft to event
    await supabase
      .from("contract_events")
      .update({ drafted_notice: notice, updated_at: new Date().toISOString() })
      .eq("id", data.eventId)
      .eq("user_id", user.id);

    REVALIDATE();
    return { success: true, notice };
  } catch (err: any) {
    return { error: err.message ?? "AI draft failed" };
  }
}

// ─── Raise Claim ─────────────────────────────────────────────────────────────

export async function raiseClaimAction(data: {
  projectId: string;
  eventId?: string;
  claimType: string;
  title: string;
  timeClaimed?: number;
  costClaimed?: number;
  notes?: string;
}) {
  const { user, supabase } = await requireAuth();

  // Auto-reference
  const { count } = await supabase
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("project_id", data.projectId);

  const ref = `CLM-${String((count ?? 0) + 1).padStart(3, "0")}`;

  const { data: claim, error } = await supabase
    .from("claims")
    .insert({
      user_id:      user.id,
      project_id:   data.projectId,
      event_id:     data.eventId ?? null,
      claim_type:   data.claimType,
      reference:    ref,
      title:        data.title,
      status:       "draft",
      time_claimed: data.timeClaimed ?? null,
      cost_claimed: data.costClaimed ?? null,
      notes:        data.notes ?? null,
      updated_at:   new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  REVALIDATE();
  return { success: true, id: claim.id, reference: ref };
}

export async function updateClaimAction(id: string, data: {
  status?: string;
  aiNarrative?: string;
  aiEotCalc?: string;
  aiLeSchedule?: string;
  timeClaimed?: number;
  costClaimed?: number;
  timeAgreed?: number;
  costAgreed?: number;
  notes?: string;
}) {
  const { user, supabase } = await requireAuth();

  const { error } = await supabase
    .from("claims")
    .update({
      status:        data.status ?? undefined,
      ai_narrative:  data.aiNarrative ?? undefined,
      ai_eot_calc:   data.aiEotCalc ?? undefined,
      ai_le_schedule:data.aiLeSchedule ?? undefined,
      time_claimed:  data.timeClaimed ?? undefined,
      cost_claimed:  data.costClaimed ?? undefined,
      time_agreed:   data.timeAgreed ?? undefined,
      cost_agreed:   data.costAgreed ?? undefined,
      notes:         data.notes ?? undefined,
      updated_at:    new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  REVALIDATE();
  return { success: true };
}

// ─── AI Draft Claim ───────────────────────────────────────────────────────────

export async function draftClaimAction(data: {
  claimId: string;
  projectId: string;
  contractType: ContractType;
  claimType: string;
  claimTitle: string;
  projectName: string;
  clientName?: string;
  contractValue?: number;
  parties: Record<string, string>;
  timeClaimed?: number;
  costClaimed?: number;
  variations?: { description: string; status: string; amount?: number }[];
  programmeDates?: { task: string; planned: string; actual?: string }[];
  costs?: { category: string; amount: number }[];
  communications?: { date: string; subject: string; direction: string }[];
}) {
  const { user, supabase } = await requireAuth();

  const config = CONTRACTS_CONFIG[data.contractType];
  const term = config.terminology;

  const systemPrompt = `You are an expert construction claims consultant specialising in ${config.label}.
You draft structured, evidence-based claims that comply with the SCL Delay and Disruption Protocol and standard practice for this contract form.
Use precise legal/contractual language. Reference specific clauses. Be factual, not emotional.`;

  const claimTypeLabels: Record<string, string> = {
    ce_notification: "Compensation Event Notification",
    eot: "Extension of Time Application",
    loss_and_expense: "Loss and Expense / Prolongation Cost Claim",
    prolongation: "Prolongation Cost Claim",
    disruption: "Disruption and Loss of Productivity Claim",
    adjudication: "Adjudication Referral Notice",
  };

  const userPrompt = `Draft a ${claimTypeLabels[data.claimType] ?? data.claimType} for:

CONTRACT: ${config.label}
PROJECT: ${data.projectName}
CLIENT: ${data.clientName ?? "—"}
CONTRACT VALUE: ${data.contractValue ? `£${data.contractValue.toLocaleString()}` : "—"}
CLAIM TITLE: ${data.claimTitle}
TIME CLAIMED: ${data.timeClaimed ? `${data.timeClaimed} days` : "To be calculated"}
COST CLAIMED: ${data.costClaimed ? `£${data.costClaimed.toLocaleString()}` : "To be calculated"}

VARIATIONS / EVENTS:
${data.variations?.map(v => `- ${v.description} (${v.status})${v.amount ? ` — £${v.amount.toLocaleString()}` : ""}`).join("\n") ?? "None recorded"}

PROGRAMME DATES:
${data.programmeDates?.map(d => `- ${d.task}: planned ${d.planned}${d.actual ? `, actual ${d.actual}` : " (ongoing)"}`).join("\n") ?? "None recorded"}

COSTS TO DATE:
${data.costs?.map(c => `- ${c.category}: £${c.amount.toLocaleString()}`).join("\n") ?? "None recorded"}

COMMUNICATIONS LOG:
${data.communications?.map(c => `- ${c.date} [${c.direction}]: ${c.subject}`).join("\n") ?? "None recorded"}

Write a structured claim comprising:
1. Executive Summary (2-3 sentences)
2. Factual Background — chronology of events leading to the claim
3. Entitlement — contractual basis and clause references
4. Quantum / Time Analysis — calculation method and amounts
5. Evidence Required — list of supporting documents
6. Relief Sought — precise statement of time and/or money claimed

Format as plain text with numbered sections.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const narrative = completion.choices[0].message.content ?? "";

    // Save context snapshot + AI narrative
    await supabase
      .from("claims")
      .update({
        ai_narrative:     narrative,
        context_snapshot: { variations: data.variations, programmeDates: data.programmeDates, costs: data.costs },
        updated_at:       new Date().toISOString(),
      })
      .eq("id", data.claimId)
      .eq("user_id", user.id);

    REVALIDATE();
    return { success: true, narrative };
  } catch (err: any) {
    return { error: err.message ?? "AI draft failed" };
  }
}
