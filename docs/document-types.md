# Document types

A **document type** (called a schema or an extraction template in the UI) tells doc-ai what a kind of document looks like and what to extract from it. Classification picks a type for each document; extraction fills in that type's fields.

Types are stored per organization in the `document_types` table ([schemas/document-types.ts](../packages/db-schema/src/schemas/document-types.ts), queries in [queries/document-types.ts](../packages/db-schema/src/queries/document-types.ts)). The TypeScript shapes are `DocumentTypeRecord` and `LineItemCollectionSchema` in [DocumentSchema.ts](../packages/types/src/types/DocumentSchema.ts) and `FieldDefinition` in [FieldDefinition.ts](../packages/types/src/types/FieldDefinition.ts).

## Anatomy of a type

| Part | Purpose |
|---|---|
| `name` | Stable identifier in upper snake case, for example `INVOICE`. Used as `docType` on documents and in schema types such as `INVOICE_header`. |
| `displayName`, `description` | Shown in the UI. The description is also what the classifier sees when choosing between types, so it matters for accuracy. |
| `extractionHint` | Extra instructions for the extraction prompt. |
| `headerSchema` | The list of single-valued fields. |
| `lineItemSchemas` | Named tables. Each key (for example `lineItems`, `transactions`, `cards`) maps to a collection with a name, display name, description and its own field list. |
| `defaultFolderId` | Where newly classified documents of this type go if they have no folder yet. |
| `folderMapping` | Optional rules that let the model choose a folder during extraction: a list of folders, each with a hint describing which documents belong there and optionally a transaction type (income or expense). |
| `isSystem` | Built-in type (see below). |
| `isDataset` | A tabular dataset type (zdocs feature for spreadsheets used as reference data). Datasets are excluded from classification; the dataset UI is turned off in doc-ai. |
| `icon`, `color` | UI decoration. |
| `entityVersion` | Incremented when the schema changes; `document_data` records which version it was extracted with. |

## Fields

Each field has a `name` (the key in the stored JSON), a `displayName` and a `type`.

**Base types**: `text`, `number`, `currency`, `date` (ISO `YYYY-MM-DD`), `boolean`, `enum`.

**Derived types** (computed after extraction, never asked from the model): `sum` and `code`. See [Formula fields](#formula-fields).

Optional properties control validation, extraction and display:

- **Validation**: `required`, `enumValues`, `min`/`max`, `maxLength`, `pattern`.
- **AI extraction**: `aiExtractable` (false for fields the system fills itself), `description` (goes into the prompt), `extractionHint` (extra context, such as where the value usually appears).
- **Search**: `searchable` (included in the search index text).
- **Currency**: `currencyField` (which field holds the currency code).
- **Denormalization**: `denormalizedAs` copies the value to a fixed column (amount, total amount, date, document date, due date, currency, description) so lists, sorting, search previews and aggregation can use it without reading the JSON.
- **Display**: `format`, `hidden`, `isImportant`, `isDescription`, column `width`/`minWidth`/`flex`/`pinned`.
- **Other zdocs features**: `isPrimaryKey` (datasets), `isReconcilable` (reconciliation view, v2), `isInstitution` (resolve a bank or issuer name to an institution record).

The model's output is validated against a Zod schema generated from these definitions ([zod-schema-builder.ts](../packages/srv/src/extraction/zod-schema-builder.ts), [document-validation.ts](../packages/srv/src/validation/document-validation.ts)) after placeholder and type coercion ([coerceAiFieldValue.ts](../packages/srv/src/extraction/coerceAiFieldValue.ts)).

## System types

The built-in types are defined in [packages/types/src/schemas/system-schemas.ts](../packages/types/src/schemas/system-schemas.ts) (`SYSTEM_DOCUMENT_TYPES`). They are seeded into the local organization on startup when any are missing (`ensureDocumentTypesForOrg`):

| Type | Line-item collections |
|---|---|
| `CREDIT_CARD_STATEMENT` | cards, transactions |
| `INVOICE` | line items |
| `RECEIPT` | line items |
| `BANK_STATEMENT` | transactions |
| `SUMMARY_OF_BILLING` | transactions |
| `TAX_FORM` | boxes |
| `PAYSLIP` | earnings, deductions |
| `INVESTMENT_STATEMENT` | holdings, activities |
| `PURCHASE_ORDER` | line items |
| `CONTRACT` | none |
| `EXPENSE_REPORT` | expenses |
| `QUOTE` | line items |
| `REMITTANCE` | none |
| `FOREIGN_EXCHANGE_CONTRACT` | none |
| `ACCOUNTING_LEDGER` | transactions |

Each system type also names a default folder (for example "Credit Card Statements"). Use `get_document_type` over MCP, or the schema page in the UI, to see the full field lists.

## Creating and editing types

**In the UI** (`/schema`, [packages/client/src/pages/schema](../packages/client/src/pages/schema)):

- The sidebar lists every type; the detail view has sections for general settings, header fields, line-item collections, extraction settings and folder mapping ([components/sections](../packages/client/src/pages/schema/components/sections)).
- Fields can be added, edited (core properties, flags, display and behaviour, formula) and reordered by drag and drop.
- New types can be created from scratch or from a system type ([document-types/create-custom](../apps/server/src/zdocs-api/org/[orgId]/document-types/create-custom/route.ts), [create-from-system](../apps/server/src/zdocs-api/org/[orgId]/document-types/create-from-system/route.ts)).
- Types can be exported and imported as portable JSON ([portableSchema.ts](../packages/client/src/pages/schema/utils/portableSchema.ts)).
- Formulas can be dry-run against a document before saving ([dry-run-formula route](../apps/server/src/zdocs-api/org/[orgId]/document-types/dry-run-formula/route.ts)).
- "Schema from sample" (upload a sample document to generate a type) isn't available yet: it relies on an S3 upload that hasn't been replaced locally.

**Over MCP**: `create_document_type` creates a custom type ([services.ts](../apps/server/src/services.ts)). The name is upper-cased with non-alphanumerics turned into underscores; existing names are rejected; and any schema with `code` fields is rejected (schema review isn't implemented). The recommended workflow is to call `get_document_type` on a similar system type and adapt it.

After changing a type, existing documents keep their old data. Use `reprocess_document` (or the extract action in the viewer) to re-extract them; the schema hash in the extraction cache key means the model is called again.

## Formula fields

Formulas are evaluated after extraction by [formula-service.ts](../packages/srv/src/extraction/formula-service.ts), always in the order sum, then code.

- **`sum`**: adds up one numeric or currency column of a line-item collection (a field path such as `lineItems.amount`), optionally taking the currency from another field. Used, for example, for computed totals that can be compared with the printed total.
- **`code`**: a JavaScript function body that receives a capability object, `tx`, through which it reads fields, writes values and emits notifications ([tx-capability.ts](../packages/srv/src/extraction/tx-capability.ts), types and limits in [TxScript.ts](../packages/types/src/types/TxScript.ts)). The schema editor includes an AI chat pane for writing these.

Formula results can raise notifications (info, warning, error), for example an invoice whose line items don't sum to the total. See [Processing pipeline](processing-pipeline.md#step-2-extraction).

**Code formulas are disabled by default** because they run unsandboxed in the server process. They are skipped (with an info notification) unless `DOC_AI_ALLOW_CODE_FORMULAS=true`. See [Security](security.md).
