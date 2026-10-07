/**
 * Loopback stand-ins for the two external providers the Phase 1 journey
 * reaches: the AI model and the email service.
 *
 * The application is not changed for testing. Both provider SDKs read their
 * endpoint from the environment, and the harness points them here, so no
 * prompt reaches a real model and no email can leave the machine.
 *
 *   POST /openai/v1/chat/completions   deterministic wording
 *   POST /resend/emails                accepts synthetic recipients only
 *   POST /__control                    { failEmails: n } fails the next n sends; { reset: true } clears the record
 *   GET  /__log                        what was received (no bodies, no keys)
 *   GET  /__health
 */
import http from "node:http";

const url = new URL(process.env.E2E_STUB_URL || "http://127.0.0.1:3199");
const SYNTHETIC_DOMAIN = "@example.com";

/** Appended to AI replies so a test can tell a suggestion from the contractor's own words. */
const AI_MARKER = process.env.E2E_AI_MARKER || "Wording tidied by the assistant.";

let failEmails = 0;
const log = { ai: [], emails: [], violations: [] };

function readBody(request) {
    return new Promise((resolve) => {
        let raw = "";
        request.on("data", (chunk) => { raw += chunk; });
        request.on("end", () => {
            try { resolve(JSON.parse(raw || "{}")); } catch { resolve({}); }
        });
    });
}

function send(response, status, body) {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
}

function between(text, start, end) {
    const from = text.indexOf(start);
    if (from < 0) return "";
    const rest = text.slice(from + start.length);
    const to = end ? rest.indexOf(end) : -1;
    return (to < 0 ? rest : rest.slice(0, to)).trim();
}

/**
 * The budgeted features send their rules as a system message and the
 * contractor's text as JSON in a user message, and expect JSON back. Each is
 * recognised by its rules. The reply keeps the contractor's words and adds
 * only the marker, which holds no figure, name or claim.
 */
function structuredReply(messages) {
    const system = String(messages.find((message) => message?.role === "system")?.content ?? "");
    let sent = {};
    try { sent = JSON.parse(String(messages.find((message) => message?.role === "user")?.content ?? "{}")); } catch { /* reply to nothing */ }

    if (system.includes("write up a job they have described")) {
        log.ai.push({ feature: "brief.suggest" });
        return {
            scope: `${String(sent.description ?? "")} ${AI_MARKER}`,
            clientType: "domestic",
            suggestedTrades: ["Bathroom Installation", "Tiling"],
            estimatedValue: 0,
            startDate: null,
            response: "I tidied the wording and kept your facts as you wrote them.",
        };
    }
    if (system.includes("tidy the wording of a proposal")) {
        log.ai.push({ feature: "proposal.wording" });
        return { text: `${String(sent.text ?? "")} ${AI_MARKER}` };
    }
    if (system.includes("tidy the wording of a case study")) {
        log.ai.push({ feature: "case-studies.enhance" });
        const reply = {};
        for (const key of ["whatWeDelivered", "valueAdded"]) if (typeof sent[key] === "string") reply[key] = sent[key];
        return reply;
    }
    if (system.includes("taken from the contractor's programme")) {
        log.ai.push({ feature: "schedule.programme-update" });
        const stages = Array.isArray(sent.stages) ? sent.stages : [];
        return { update: stages.map((stage) => `${stage.name}: ${stage.status}.`).join(" ") };
    }
    return null;
}

function aiReply(body) {
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    if (messages.some((message) => message?.role === "system")) {
        const reply = structuredReply(messages);
        if (reply) return JSON.stringify(reply);
    }

    // Single-message prompts, as the unbudgeted paths still send them.
    const prompt = String(messages[0]?.content ?? "");
    if (prompt.includes("Contractor's description:")) {
        let description = between(prompt, "Contractor's description:", "\n");
        try { description = JSON.parse(description); } catch { /* keep as sent */ }
        log.ai.push({ feature: "brief.suggest" });
        return JSON.stringify({
            scope: `${description} ${AI_MARKER}`,
            clientType: "domestic",
            suggestedTrades: ["Bathroom Installation", "Tiling"],
            estimatedValue: 0,
            startDate: null,
            response: "I tidied the wording and kept your facts as you wrote them.",
        });
    }
    if (prompt.includes("Contractor's text:")) {
        log.ai.push({ feature: "proposal.wording" });
        return `${between(prompt, "Contractor's text:", null)} ${AI_MARKER}`;
    }
    log.ai.push({ feature: "other" });
    return body?.response_format?.type === "json_object" ? "{}" : AI_MARKER;
}

const server = http.createServer(async (request, response) => {
    const path = new URL(request.url ?? "/", url).pathname;

    if (request.method === "GET" && path === "/__health") return send(response, 200, { ok: true });
    if (request.method === "GET" && path === "/__log") return send(response, 200, log);

    const body = await readBody(request);

    if (request.method === "POST" && path === "/__control") {
        failEmails = Number.isInteger(body.failEmails) ? body.failEmails : 0;
        // Each journey starts its own record.
        if (body.reset === true) for (const entries of Object.values(log)) entries.length = 0;
        return send(response, 200, { failEmails });
    }

    if (request.method === "POST" && path === "/openai/v1/chat/completions") {
        return send(response, 200, {
            id: "chatcmpl-e2e",
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: "e2e-stub",
            choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: aiReply(body) } }],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        });
    }

    if (request.method === "POST" && path === "/resend/emails") {
        const recipients = [body.to].flat().map(String);
        const subject = String(body.subject ?? "");
        if (recipients.length === 0 || recipients.some((to) => !to.toLowerCase().endsWith(SYNTHETIC_DOMAIN))) {
            log.violations.push({ kind: "non-synthetic-recipient", subject });
            return send(response, 422, { name: "validation_error", message: "Synthetic recipients only.", statusCode: 422 });
        }
        if (failEmails > 0) {
            failEmails -= 1;
            log.emails.push({ to: recipients, subject, delivered: false });
            return send(response, 500, { name: "application_error", message: "Stubbed delivery failure.", statusCode: 500 });
        }
        log.emails.push({ to: recipients, subject, delivered: true });
        return send(response, 200, { id: `e2e-email-${log.emails.length}` });
    }

    log.violations.push({ kind: "unexpected-request", method: request.method, path });
    return send(response, 404, { error: "not stubbed" });
});

server.listen(Number(url.port), url.hostname);
