import { z } from 'zod';
export const idSchema = z.string().uuid();
export const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('ADD_CREDIT'), customerId: idSchema, amount: z.string().max(30) }).strict(),
  z.object({ action: z.literal('RECORD_REPAYMENT'), customerId: idSchema, amount: z.string().max(30) }).strict(),
  z.object({ action: z.literal('CORRECT_LAST_CUSTOMER'), customerId: idSchema, targetId: idSchema }).strict(),
  z.object({ action: z.literal('REVERSE_LAST'), targetId: idSchema }).strict(),
]);
export type Action = z.infer<typeof actionSchema>;
const fields = { customerQuery: z.string().max(120).nullable(), amount: z.string().max(30).nullable(), missingFields: z.array(z.enum(['customer','amount','direction','target'])).max(4), message: z.string().max(240).nullable() };
export const intentSchema = z.discriminatedUnion('intent', [
  z.object({ intent: z.literal('ADD_CREDIT'), ...fields }).strict(),
  z.object({ intent: z.literal('RECORD_REPAYMENT'), ...fields }).strict(),
  z.object({ intent: z.literal('CORRECT_LAST_CUSTOMER'), ...fields }).strict(),
  z.object({ intent: z.literal('REVERSE_LAST'), ...fields }).strict(),
  z.object({ intent: z.literal('SHOW_BALANCE'), ...fields }).strict(),
  z.object({ intent: z.literal('NEEDS_CLARIFICATION'), ...fields }).strict(),
  z.object({ intent: z.literal('UNSUPPORTED'), ...fields }).strict(),
]);
export type Intent = z.infer<typeof intentSchema>;
export type Customer = { id: string; name: string; label: string; aliases: string; balance: number };
export type Entry = { seq: number; id: string; customerId: string; name: string; label: string; type: 'CREDIT'|'REPAYMENT'|'REVERSAL'; amount: number; delta: number; relatedId: string|null; operationId: string; createdAt: string };
export type Proposal = { id: string; action: Action['action']; customerId: string; name: string; label: string; amount: number; before: number; after: number; targetId?: string; originalName?: string; originalLabel?: string; originalBefore?: number; originalAfter?: number; expiresAt: string; state: string };
export type Receipt = { id: string; operationId: string; action: string; createdAt: string; entries: Entry[]; balances: {customerId:string; name:string; balance:number}[]; proposalId?: string };
export type Health = { ok: boolean; voiceConfigured: boolean; provider: string; transcriptionModel: string; intentModel: string; entryLimit: number; shopId: string; shopName: string; csrfToken: string; mode: 'local' };
export type Snapshot = { customers: Customer[]; entries: Entry[]; total: number; latest: Entry|null; shopId: string };
export type Interpretation = { kind: 'preview'; proposal: Proposal; source: string } | { kind: 'clarification'; message: string; candidates: Customer[]; action: string|null; amount: string|null; source: string; targetId?: string|null } | { kind: 'balance'; customers: Customer[]; source: string } | { kind: 'unsupported'; message: string; source: string };
export const formatMoney = (paise: number) => new Intl.NumberFormat('en-IN', {style:'currency', currency:'INR', minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2}).format(paise / 100);
