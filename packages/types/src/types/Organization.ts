export interface Organization {
  id: string;
  name: string;
  description: string | null;
  baseCurrency: string;
  timezone: string;
  ownerUserId: string;
  maxPagesPerDoc: number;
  sharedWithEmails: string[];
  webhookId: string | null;
  webhookSecret: string | null;
  webhookCallbackUrl: string | null;
  webhookSigningSecret: string | null;
  emailId: string | null;
  emailForwardAddress: string | null;
  emailForwardEnabled: boolean;
  emailNotifyOnUpload: boolean;
  color: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
