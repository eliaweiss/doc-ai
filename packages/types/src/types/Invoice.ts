// Payment status enum values (runtime array for Drizzle)
export const PAYMENT_STATUSES = [
  "DRAFT",
  "PAID",
  "UNPAID",
  "OVERDUE",
  "CANCELLED",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];


