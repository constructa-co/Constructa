import { z } from "zod";

const ProposalResponseInput = z.object({
    token: z.string().regex(/^[a-f0-9]{64}$/),
    response: z.enum(["acknowledged", "accepted", "declined"]),
    clientName: z.string().trim().min(2).max(200).refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
    clientEmail: z.union([
        z.literal(""),
        z.string().trim().email().max(320).refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
    ]),
});

export type ProposalResponseInput = z.infer<typeof ProposalResponseInput>;

export function parseProposalResponseInput(input: unknown) {
    return ProposalResponseInput.safeParse(input);
}
