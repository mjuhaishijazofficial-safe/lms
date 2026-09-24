/** A StudyHub usage fee: a record the admin keeps of who owes what for which period. No payment gateway is
 *  involved — money changes hands off-platform, and this is only the bookkeeping. */
export const CURRENCY = "Rs.";

export const formatAmount = (amount: number) => `${CURRENCY} ${amount.toLocaleString()}`;

export const FEE_STATUSES = ["PENDING", "PAID", "WAIVED"] as const;
export type FeeStatusValue = (typeof FEE_STATUSES)[number];
