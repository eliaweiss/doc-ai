// Contact Us status enum values
export const CONTACT_US_STATUSES = [
  "NEW",
  "IN_PROCESS",
  "CLOSED",
] as const;

export type ContactUsStatus = (typeof CONTACT_US_STATUSES)[number];

// Contact Us reply directions
export const CONTACT_US_REPLY_DIRECTIONS = [
  "inbound",
  "outbound",
] as const;

export type ContactUsReplyDirection =
  (typeof CONTACT_US_REPLY_DIRECTIONS)[number];

export interface ContactUsReply {
  id: string;
  contactUsId: string;
  direction: ContactUsReplyDirection;
  senderEmail: string;
  message: string;
  createdAt: Date;
}
