export * from "./Auth";
export * from "./FieldDefinition";
import { FieldDefinition } from "./FieldDefinition";
export * from "./Organization";
export * from "./QuickBooksOrgConnection";
export * from "./XeroOrgConnection";
export * from "./Document";
export * from "./DocumentSchema";
export * from "./Folder";
export * from "./Institution";
export * from "./Entity";
export * from "./Search";
export * from "./AiUsage";
export * from "./AiModelConfig";
export * from "./Queue";
export * from "./ProcessLock";
export * from "./Reconciliation";
export * from "./ReconciliationClientTypes";
export * from "./ReconciliationTrace";
export * from "./Notification";
export * from "./AiDeskChat";
export * from "./UserOrgSettings";
export * from "./UserJourneyEvent";
export * from "./TxScript";
export * from "./uiTx";
export * from "./MiniApp";
export * from "./ApiKey";
export * from "./EditOp";
export * from "./Task";
export * from "./QuickAccess";
export * from "./AiBuilderInteraction";
export * from "./ContactUs";
export * from "./DataSource";
export * from "./DataSourceDriver";
export * from "./DocumentMetadata";

export interface ParsedDataset {
  headers: string[];
  schema: FieldDefinition[];
  rows: Record<string, unknown>[];
  rowCount: number;
  transform?: DatasetTransformConfig;
}

export interface DatasetTransformConfig {
  datasetName: string;
  skipRows: number;
  delimiter: "," | ";" | "\t";
  transformCode: string;
}

export const DATASET_LIMITS = {
  maxFileSizeBytes: 10 * 1024 * 1024, // 10 MB
  maxRows: 50000,
  maxColumns: 100,
} as const;

export const DOCUMENT_LIMITS = {
  maxFileSizeBytes: 10 * 1024 * 1024, // 10 MB
  maxMultiPageFileSizeBytes: 7 * 1024 * 1024, // 7 MB
  maxPagesForLargeFile: 5,
  maxPdfPages: 15,
  maxTextLines: 100,
} as const;
