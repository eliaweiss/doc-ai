// Folder classification type enum values (for expense/income categorization)
export const FOLDER_TYPES = [
  "GENERAL",
  "EXPENSE",
  "INCOME",
  "ASSET",
  "LIABILITY",
] as const;

export type FolderType = (typeof FOLDER_TYPES)[number];

export interface Folder {
  id: string;
  orgId: string;
  name: string;
  parentId: string | null; // Null for root folders
  type: FolderType; // Classification type for reporting
  isSystem: boolean; // True for auto-created default folders
  isRoot: boolean; // True for "My Drive" root folder
  description: string | null;
  color: string | null; // Optional color for folder icon
  documentCount: number; // Denormalized count for performance
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
