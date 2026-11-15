export class DomainError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
export function parseMoney(value: string, limit = 1_000_000): number {
  const input = value.trim();
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(input)) throw new DomainError('INVALID_AMOUNT', 'Enter a positive rupee amount with at most two decimal places.');
  const [whole, fraction = ''] = input.split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(paise) || paise <= 0) throw new DomainError('INVALID_AMOUNT', 'The amount must be greater than zero.');
  if (paise > limit) throw new DomainError('ENTRY_LIMIT', `The prototype limit is ₹${limit / 100} per entry.`);
  return paise;
}
