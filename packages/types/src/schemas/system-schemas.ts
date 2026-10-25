import {
  DenormalizedAsType,
  FieldDefinition,
  FormulaCode,
} from "../types/FieldDefinition";
import {
  LineItemCollectionSchema,
  DocumentTypeSchema,
} from "../types/DocumentSchema";

// ═══════════════════════════════════════════════════════════════════════════════
// CREDIT CARD STATEMENT SCHEMA (e.g., Isracard, Max, Cal)
// ═══════════════════════════════════════════════════════════════════════════════

export const CREDIT_CARD_STATEMENT_HEADER_SCHEMA: FieldDefinition[] = [
  {
    name: "cardholderName",
    type: "text",
    displayName: "Cardholder Name",
    description: "Name of the primary account holder on the statement",
    searchable: true,
    isImportant: true,
  },
  {
    name: "cardIssuer",
    type: "text",
    displayName: "Card Issuer",
    description: "The company issuing the card (e.g., Isracard, Max, Cal)",
    searchable: true,
    isInstitution: true,
    institutionType: "BANK",
  },
  {
    name: "billingDate",
    type: "date",
    displayName: "Billing Date",
    description: "The date the account is actually debited (Settlement Date)",
    denormalizedAs: DenormalizedAsType.DATE,
    isImportant: true,
  },
  {
    name: "currency",
    type: "text",
    displayName: "Currency",
    description: "",
    maxLength: 3,
    isImportant: true,
  },
  {
    name: "sum_chargeAmount",
    type: "sum",
    displayName: "Sum of Charge Amount",
    description: "Sum of Charge Amount",
    searchable: true,
    isImportant: true,
    aiExtractable: false,
    denormalizedAs: DenormalizedAsType.AMOUNT,
    formula: {
      fieldPath: "transactions.chargeAmount",
      fieldType: "currency",
      currencyFieldPath: "transactions.currency",
    },
  },

];

// One row per card included in the statement (multi-card statements)
export const CREDIT_CARD_CARD_SCHEMA: FieldDefinition[] = [
  {
    name: "cardNumberLastFour",
    type: "text",
    displayName: "Card Last 4 Digits",
    description: "Last 4 digits identifying this card",
    maxLength: 4,
    isImportant: true,
    searchable: true,
  },
  {
    name: "cardholderName",
    type: "text",
    displayName: "Cardholder Name",
    description: "Name of the person this card is issued to",
    searchable: true,
    isImportant: true,
  },
  {
    name: "cardType",
    type: "text",
    displayName: "Card Type",
    description: "",
    extractionHint: "Extract the type EXACTLY as it appear in the document",
    isImportant: true,
  },
];

export const CREDIT_CARD_TRANSACTION_SCHEMA: FieldDefinition[] = [
  {
    name: "cardNumberLastFour",
    type: "text",
    displayName: "Card Last 4 Digits",
    description: "Last 4 digits of the card used for this transaction",
    maxLength: 4,
    isImportant: true,
    searchable: true,
  },
  {
    name: "category",
    type: "text",
    displayName: "Category",
    description: "Expense category assigned by AI category mapping",
    searchable: true,
    isImportant: false,
    aiExtractable: false,
  },
  {
    name: "billing_date",
    type: "date",
    displayName: "Billing date",
    description: "תאריך החיוב של העסקה",
    extractionHint: "המסמכים של max תאריך החיוב מופיע כשורה נפרדת, מעל שורת החיוב, לפעמים מספר שורות מעל, כלומר התאריך מוכל על כל השורות שמתחתיו.",
  },
  {
    name: "purchaseDate",
    type: "date",
    displayName: "Purchase Date",
    description: "The date the transaction was made",
    isImportant: true,
  },
  {
    name: "chargeDate",
    type: "date",
    displayName: "Charge Date",
    description: "The date the transaction appears for billing (common in foreign transactions)",
  },
  {
    name: "merchantName",
    type: "text",
    displayName: "Merchant",
    description: "Name of the business (e.g., Microsoft, Rami Levy)",
    searchable: true,
    isImportant: true,
  },
  {
    name: "transactionAmount",
    type: "currency",
    displayName: "Original Amount",
    description: "Amount in the original currency or before discounts",
    currencyField: "currency",
  },
  {
    name: "chargeAmount",
    type: "currency",
    displayName: "Charge Amount",
    description: "The actual amount billed to the card in local currency",
    currencyField: "currency",
    isReconcilable: true,
    isImportant: true,
  },
  {
    name: "voucherNumber",
    type: "text",
    displayName: "Voucher #",
    description: "The unique transaction identifier (מספר שובר)",
    searchable: true,
  },
  {
    name: "notes",
    type: "text",
    displayName: "Notes/Extra Info",
    description: "Installment info (e.g., '8 of 12') or specific discounts (e.g., 'Ashmoret')",
    searchable: true,
  },
  {
    name: "installmentCurrent",
    type: "number",
    displayName: "Installment Current",
    description: "The current payment number",
  },
  {
    name: "installmentTotal",
    type: "number",
    displayName: "Installment Total",
    description: "The total number of payments in the plan",
  },
  {
    name: "isForeignTransaction",
    type: "boolean",
    displayName: "Foreign?",
    description: "Whether the transaction was made abroad or in foreign currency",
  },
];


// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

export const INVOICE_HEADER_SCHEMA: FieldDefinition[] = [
  {
    name: "vendorName",
    type: "text",
    displayName: "Vendor",
    description: "Vendor/supplier name",
    searchable: true,
    isInstitution: true,
    institutionType: "MERCHANT",
    isImportant: true,
  },
  {
    name: "invoiceNumber",
    type: "text",
    displayName: "Invoice Number",
    description: "The unique invoice identifier",
    searchable: true,
  },
  {
    name: "date",
    type: "date",
    displayName: "Invoice Date",
    description: "The date the invoice was issued",
    denormalizedAs: DenormalizedAsType.DATE,
    searchable: true,
    isImportant: true,
  },
  {
    name: "dueDate",
    type: "date",
    displayName: "Due Date",
    description: "Payment due date",
    denormalizedAs: DenormalizedAsType.DUE_DATE,
  },
  {
    name: "subtotal",
    type: "currency",
    displayName: "Subtotal",
    description: "Sum before tax",
    currencyField: "currency",
  },
  {
    name: "tax",
    type: "currency",
    displayName: "Tax",
    description: "Tax amount",
    currencyField: "currency",
  },
  {
    name: "total",
    type: "currency",
    displayName: "Total",
    description: "The total amount due",
    required: true,
    currencyField: "currency",
    denormalizedAs: DenormalizedAsType.AMOUNT,
    searchable: true,
    isImportant: true,
    isReconcilable: true,
  },
  {
    name: "totalDiscount",
    type: "currency",
    displayName: "Total Discount",
    description: "The total discount amount",
    extractionHint:
      "The global discount amount, appears next to the total amount",
    aiExtractable: true,
    currencyField: "currency",
  },
  {
    name: "currency",
    type: "text",
    displayName: "Currency",
    description: "ISO currency code (USD, EUR, BRL)",
    maxLength: 3,
    isImportant: true,
  },
  {
    name: "paymentMethod",
    type: "text",
    displayName: "Payment Method",
    description: "Method of payment if specified",
    searchable: true,
  },
  {
    name: "paymentStatus",
    type: "enum",
    displayName: "Payment Status",
    enumValues: ["DRAFT", "PAID", "UNPAID", "OVERDUE", "CANCELLED", "APPROVED", "REJECTED", "REQUIRES_REVIEW"],
    aiExtractable: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CODE FIELD: Total Validation
  // Validates that extracted total matches sum of line item amounts
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "totalValidation",
    type: "code",
    displayName: "Total Validation",
    description: "Validates extracted total matches line item sum",
    aiExtractable: false,
    searchable: false,
    isImportant: false,
    hidden: true,
    formula: {
      type: "code",
      fieldType: "boolean",
      inputFields: [
        "header.total",
        "header.items_amount_sum",
        "header.totalDiscount",
      ],
      code: `
const { items_amount_sum = 0, totalDiscount = 0, subtotal = 0, total = 0 } = tx.getFields(['items_amount_sum', 'totalDiscount', 'subtotal', 'total']);
const items = tx.getLineItems('items') || [];
if (items.length === 0) {
  tx.setResult(true);
  return;
}

const maxDiff = 0.02;

// Check direct match
if (Math.abs(items_amount_sum - subtotal) <= maxDiff || Math.abs(items_amount_sum - total) <= maxDiff) {
  tx.setResult(true);
  return;
}

// Check net match (after discount)
const netSum = items_amount_sum - totalDiscount;
if (Math.abs(netSum - subtotal) <= maxDiff || Math.abs(netSum - total) <= maxDiff) {
  tx.setResult(true);
  return;
}

// No match - add warning
tx.addMessage(\`Line item sum (\${items_amount_sum}) or net sum (\${netSum}) does not match subtotal (\${subtotal}) or total (\${total})\`, { level: 'warning', field: 'total' });
tx.setResult(false);
      `,
    } as FormulaCode,
  },
];

export const INVOICE_LINE_ITEM_SCHEMA: FieldDefinition[] = [
  {
    name: "description",
    type: "text",
    displayName: "Description",
    description: "Original line item text from document",
    searchable: true,
    isImportant: true,
  },
  {
    name: "amount",
    type: "currency",
    displayName: "Amount",
    description: "Line total = quantity × unitPrice",
    currencyField: "currency",
    denormalizedAs: DenormalizedAsType.AMOUNT,
    isReconcilable: true,
    isImportant: true,
  },
  {
    name: "sku",
    type: "text",
    displayName: "SKU",
    description: "Product code or SKU",
    searchable: true,
    isImportant: true,
  },

  {
    name: "quantity",
    type: "number",
    displayName: "Quantity",
    description: "Number of units",
    min: 0,
    isImportant: true,
  },
  {
    name: "measureUnit",
    type: "text",
    displayName: "Unit",
    description: "Unit of measure (kg, hours, pcs)",
  },
  {
    name: "unitPrice",
    type: "currency",
    displayName: "Unit Price",
    description: "Price per unit",
    currencyField: "currency",
  },

  {
    name: "discount",
    type: "currency",
    displayName: "Discount",
    extractionHint: "Normally found under the line item",
    aiExtractable: true,
    currencyField: "currency",
  },

  {
    name: "enhancedDescription",
    type: "text",
    displayName: "Enhanced Description",
    description: "AI-improved human-readable description",
    searchable: true,
  },
  {
    name: "folderId",
    type: "text",
    displayName: "Category",
    description: "Expense/income classification folder",
    aiExtractable: false, // Set by user or system logic
    hidden: true,
  },
  {
    name: "pageNumber",
    type: "number",
    displayName: "Page",
    description: "Document page where this line appears",
    aiExtractable: false, // Set by system based on OCR page detection
    hidden: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// RECEIPT SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

export const RECEIPT_HEADER_SCHEMA: FieldDefinition[] = [
  {
    name: "merchantName",
    type: "text",
    displayName: "Merchant",
    description: "Name of the merchant/store",
    searchable: true,
    isInstitution: true,
    institutionType: "MERCHANT",
    isImportant: true,
  },
  {
    name: "merchantAddress",
    type: "text",
    displayName: "Address",
    description: "Merchant address",
  },
  {
    name: "date",
    type: "date",
    displayName: "Date",
    description: "Receipt date",
    denormalizedAs: DenormalizedAsType.DATE,
  },
  {
    name: "time",
    type: "text",
    displayName: "Time",
    description: "Transaction time",
  },
  {
    name: "receiptNumber",
    type: "text",
    displayName: "Receipt #",
    description: "Receipt or transaction number",
    searchable: true,
  },
  {
    name: "subtotal",
    type: "currency",
    displayName: "Subtotal",
    currencyField: "currency",
  },
  {
    name: "tax",
    type: "currency",
    displayName: "Tax",
    currencyField: "currency",
  },
  {
    name: "total",
    type: "currency",
    displayName: "Total",
    description: "Total amount paid",
    required: true,
    currencyField: "currency",
    denormalizedAs: DenormalizedAsType.AMOUNT,
    isReconcilable: true,
    isImportant: true,
  },
  {
    name: "totalDiscount",
    type: "currency",
    displayName: "Total Discount",
    description: "The total discount amount",
    extractionHint:
      "The global discount amount, appears next to the total amount",
    aiExtractable: true,
    currencyField: "currency",
  },
  {
    name: "currency",
    type: "text",
    displayName: "Currency",
    maxLength: 3,
  },
  {
    name: "paymentMethod",
    type: "text",
    displayName: "Payment Method",
    description: "Cash, credit card, etc.",
  },
  {
    name: "cardLastFour",
    type: "text",
    displayName: "Card Last 4",
    description: "Last 4 digits of payment card",
    maxLength: 4,
  },
  {
    name: "description",
    type: "text",
    displayName: "Description",
    description: "General description or notes about the receipt",
    searchable: true,
  },
  {
    name: "totalValidation",
    type: "code",
    displayName: "Total Validation",
    description: "Validates extracted total matches line item sum",
    aiExtractable: false,
    searchable: false,
    isImportant: false,
    hidden: true,
    formula: {
      type: "code",
      fieldType: "boolean",
      inputFields: [
        "header.total",
        "header.items_amount_sum",
        "header.totalDiscount",
      ],
      code: `
const { items_amount_sum = 0, items_discount_sum = 0, subtotal = 0, total = 0 } = tx.getFields(['items_amount_sum', 'items_discount_sum', 'subtotal', 'total']);
const items = tx.getLineItems('items') || [];
if (items.length === 0) {
  tx.setResult(true);
  return;
}

const maxDiff = 0.02;

// Check direct match
if (Math.abs(items_amount_sum - subtotal) <= maxDiff || Math.abs(items_amount_sum - total) <= maxDiff) {
  tx.setResult(true);
  return;
}

// Check net match (after discount)
const netSum = items_amount_sum - items_discount_sum;
if (Math.abs(netSum - subtotal) <= maxDiff || Math.abs(netSum - total) <= maxDiff) {
  tx.setResult(true);
  return;
}

// No match - add warning
tx.addMessage(\`Line item sum (\${items_amount_sum}) or net sum (\${netSum}) does not match subtotal (\${subtotal}) or total (\${total})\`, { level: 'warning', field: 'total' });
tx.setResult(false);
      `,
    } as FormulaCode,
  },
];

export const RECEIPT_LINE_ITEM_SCHEMA: FieldDefinition[] = [
  {
    name: "description",
    type: "text",
    displayName: "Item",
    description: "Item description",
    searchable: true,
  },
  {
    name: "quantity",
    type: "number",
    displayName: "Qty",
    min: 0,
  },
  {
    name: "unitPrice",
    type: "currency",
    displayName: "Unit Price",
    description: "Price per unit",
    currencyField: "currency",
  },
  {
    name: "amount",
    type: "currency",
    displayName: "Amount",
    currencyField: "currency",
  },
  {
    name: "discount",
    type: "currency",
    displayName: "Discount",
    extractionHint: "Normally found under the line item",
    aiExtractable: true,
    currencyField: "currency",
  },
  {
    name: "sku",
    type: "text",
    displayName: "SKU",
    searchable: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// BANK STATEMENT SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

export const BANK_STATEMENT_HEADER_SCHEMA: FieldDefinition[] = [
  {
    name: "accountName",
    type: "text",
    displayName: "Account Name",
    description: "Name of the account or the owner's name",
    searchable: true,
    isImportant: true,
  },
  {
    name: "bankName",
    type: "text",
    displayName: "Bank",
    description: "Name of the bank",
    searchable: true,
    isInstitution: true,
    institutionType: "BANK",
  },
  {
    name: "accountNumber",
    type: "text",
    displayName: "Account #",
    description: "Bank account number (may be masked)",
  },
  {
    name: "accountType",
    type: "text",
    displayName: "Account Type",
    description: "Checking, Savings, etc.",
  },
  {
    name: "statementPeriodStart",
    type: "date",
    displayName: "Period Start",
    description: "Statement period start date",
    denormalizedAs: DenormalizedAsType.DATE,
  },
  {
    name: "statementPeriodEnd",
    type: "date",
    displayName: "Period End",
    description: "Statement period end date",
  },
  {
    name: "openingBalance",
    type: "currency",
    displayName: "Opening Balance",
    currencyField: "currency",
  },
  {
    name: "closingBalance",
    type: "currency",
    displayName: "Closing Balance",
    currencyField: "currency",
    denormalizedAs: DenormalizedAsType.AMOUNT,
  },
  {
    name: "currency",
    type: "text",
    displayName: "Currency",
    maxLength: 3,
  },
];

export const BANK_STATEMENT_TRANSACTION_SCHEMA: FieldDefinition[] = [
  {
    name: "date",
    type: "date",
    displayName: "Date",
    description: "Transaction date",
    isImportant: true,
  },
  {
    name: "description",
    type: "text",
    displayName: "Description",
    description: "Transaction description",
    searchable: true,
    isImportant: true,
  },
  {
    name: "reference",
    type: "text",
    displayName: "Reference",
    description: "Transaction reference number",
    searchable: true,
  },
  {
    name: "debit",
    type: "currency",
    displayName: "Debit",
    description: "Amount debited (withdrawn)",
    currencyField: "currency",
    isReconcilable: true,
    isImportant: true,
  },
  {
    name: "credit",
    type: "currency",
    displayName: "Credit",
    description: "Amount credited (deposited)",
    currencyField: "currency",
    isReconcilable: true,
    isImportant: true,
  },
  {
    name: "balance",
    type: "currency",
    displayName: "Balance",
    description: "Running balance after transaction",
    currencyField: "currency",
  },
  {
    name: "category",
    type: "text",
    displayName: "Category",
    description: "Transaction category if provided",
  },
  // {
  //   name: "currency",
  //   type: "text",
  //   displayName: "Currency",
  //   maxLength: 3,
  // },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY OF BILLING SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

export const SUMMARY_OF_BILLING_HEADER_SCHEMA: FieldDefinition[] = [
  {
    name: "accountName",
    type: "text",
    displayName: "Account Name",
    description: "Name of the account or the owner's name",
    searchable: true,
    isImportant: true,
  },
  {
    name: "bankName",
    type: "text",
    displayName: "Bank",
    description: "Name of the bank",
    searchable: true,
    isInstitution: true,
    institutionType: "BANK",
  },
  {
    name: "accountNumber",
    type: "text",
    displayName: "Account #",
    description: "Bank account number (may be masked)",
  },
  {
    name: "accountType",
    type: "text",
    displayName: "Account Type",
    description: "Checking, Savings, etc.",
  },
  {
    name: "statementPeriodStart",
    type: "date",
    displayName: "Period Start",
    description: "Statement period start date",
    denormalizedAs: DenormalizedAsType.DATE,
  },
  {
    name: "statementPeriodEnd",
    type: "date",
    displayName: "Period End",
    description: "Statement period end date",
  },
  {
    name: "openingBalance",
    type: "currency",
    displayName: "Opening Balance",
    currencyField: "currency",
  },
  {
    name: "closingBalance",
    type: "currency",
    displayName: "Closing Balance",
    currencyField: "currency",
    denormalizedAs: DenormalizedAsType.AMOUNT,
  },
  {
    name: "currency",
    type: "text",
    displayName: "Currency",
    maxLength: 3,
  },
  {
    name: "totalAmount",
    type: "currency",
    displayName: "Total Amount",
    extractionHint: "Total payments received",
    currencyField: "currency",
    denormalizedAs: DenormalizedAsType.AMOUNT,
    isImportant: true,
    isReconcilable: true,
  },
];

export const SUMMARY_OF_BILLING_TRANSACTION_SCHEMA: FieldDefinition[] = [
  {
    name: "date",
    type: "date",
    displayName: "Date",
    description: "Transaction date",
    isImportant: true,
  },
  {
    name: "description",
    type: "text",
    displayName: "Description",
    description: "Transaction description",
    searchable: true,
    isImportant: true,
  },
  {
    name: "reference",
    type: "text",
    displayName: "Reference",
    description: "Transaction reference number",
    searchable: true,
  },
  {
    name: "debit",
    type: "currency",
    displayName: "Debit",
    description: "Amount debited (withdrawn)",
    currencyField: "currency",
    isReconcilable: true,
    isImportant: true,
  },
  {
    name: "credit",
    type: "currency",
    displayName: "Credit",
    description: "Amount credited (deposited)",
    currencyField: "currency",
    isReconcilable: true,
    isImportant: true,
  },
  {
    name: "balance",
    type: "currency",
    displayName: "Balance",
    description: "Running balance after transaction",
    currencyField: "currency",
  },
  {
    name: "category",
    type: "text",
    displayName: "Category",
    description: "Transaction category if provided",
  },
  // {
  //   name: "currency",
  //   type: "text",
  //   displayName: "Currency",
  //   maxLength: 3,
  // },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TAX FORM SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

export const TAX_FORM_HEADER_SCHEMA: FieldDefinition[] = [
  {
    name: "formType",
    type: "text",
    displayName: "Form Type",
    description: "Tax form type (W-2, 1099, etc.)",
    searchable: true,
  },
  {
    name: "taxYear",
    type: "number",
    displayName: "Tax Year",
    description: "The tax year this form covers",
  },
  {
    name: "issuerName",
    type: "text",
    displayName: "Issuer",
    description: "Employer or issuing entity name",
    searchable: true,
    isInstitution: true,
    institutionType: "EMPLOYER",
  },
  {
    name: "issuerEin",
    type: "text",
    displayName: "Issuer EIN",
    description: "Employer Identification Number",
  },
  {
    name: "recipientName",
    type: "text",
    displayName: "Recipient",
    description: "Recipient/employee name",
    searchable: true,
  },
  {
    name: "recipientSsn",
    type: "text",
    displayName: "SSN",
    description: "Social Security Number (masked)",
  },
  {
    name: "grossIncome",
    type: "currency",
    displayName: "Gross Income",
    description: "Total gross income/wages",
    currencyField: "currency",
    denormalizedAs: DenormalizedAsType.AMOUNT,
  },
  {
    name: "taxLiability",
    type: "currency",
    displayName: "Tax Liability",
    currencyField: "currency",
    description: "The total tax liability",
    denormalizedAs: DenormalizedAsType.AMOUNT,
  },
  {
    name: "stateTaxWithheld",
    type: "currency",
    displayName: "State Tax Withheld",
    currencyField: "currency",
  },
  {
    name: "currency",
    type: "text",
    displayName: "Currency",
    maxLength: 3,
  },
  {
    name: "period",
    type: "number",
    displayName: "The Tax Period (Month)",
    description: "The tax period is the number of the Month (1-12)",
  },
  {
    name: "date",
    type: "date",
    displayName: "Date",
    description: "The Tax Period - first day of the month",
    denormalizedAs: DenormalizedAsType.DATE,
  },
  {
    name: "receiptNumber",
    type: "text",
    displayName: "Receipt Number",
    description: "The number of the receipt",
  },
];

// Tax forms typically don't have line items, but may have boxes/fields
export const TAX_FORM_BOX_SCHEMA: FieldDefinition[] = [
  {
    name: "boxNumber",
    type: "text",
    displayName: "Box",
    description: "Form box number",
  },
  {
    name: "boxLabel",
    type: "text",
    displayName: "Label",
    description: "Box label/description",
    isDescription: true,
  },
  {
    name: "value",
    type: "text",
    displayName: "Value",
    description: "Box value",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PAYSLIP SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

export const PAYSLIP_HEADER_SCHEMA: FieldDefinition[] = [
  {
    name: "employerName",
    type: "text",
    displayName: "Employer",
    description: "Company/employer name",
    searchable: true,
    isInstitution: true,
    institutionType: "EMPLOYER",
  },
  {
    name: "employeeName",
    type: "text",
    displayName: "Employee",
    description: "Employee name",
    searchable: true,
  },
  {
    name: "employeeId",
    type: "text",
    displayName: "Employee ID",
    description: "Employee identification number",
  },
  {
    name: "payPeriodStart",
    type: "date",
    displayName: "Period Start",
    description: "Pay period start date",
    denormalizedAs: DenormalizedAsType.DATE,
  },
  {
    name: "payPeriodEnd",
    type: "date",
    displayName: "Period End",
    description: "Pay period end date",
  },
  {
    name: "payDate",
    type: "date",
    displayName: "Pay Date",
    description: "Date payment was made",
  },
  {
    name: "grossPay",
    type: "currency",
    displayName: "Gross Pay",
    currencyField: "currency",
  },
  {
    name: "netPay",
    type: "currency",
    displayName: "Net Pay",
    description: "Take-home pay after deductions",
    currencyField: "currency",
    denormalizedAs: DenormalizedAsType.AMOUNT,
  },
  {
    name: "currency",
    type: "text",
    displayName: "Currency",
    maxLength: 3,
  },
];

const PAYSLIP_EARNINGS_SCHEMA: LineItemCollectionSchema = {
  name: "PAYSLIP_EARNINGS",
  displayName: "Earnings",
  description: "Earnings and income items",
  fields: [
    {
      name: "type",
      type: "text",
      displayName: "Type",
      description: "Regular, Overtime, Bonus, etc.",
    },
    {
      name: "hours",
      type: "number",
      displayName: "Hours",
    },
    {
      name: "rate",
      type: "currency",
      displayName: "Rate",
      currencyField: "currency",
    },
    {
      name: "amount",
      type: "currency",
      displayName: "Amount",
      currencyField: "currency",
    },
  ],
};

const PAYSLIP_DEDUCTIONS_SCHEMA: LineItemCollectionSchema = {
  name: "PAYSLIP_DEDUCTIONS",
  displayName: "Deductions",
  description: "Tax and other deductions",
  fields: [
    {
      name: "type",
      type: "text",
      displayName: "Type",
      description: "Federal Tax, State Tax, 401k, etc.",
    },
    {
      name: "amount",
      type: "currency",
      displayName: "Amount",
      currencyField: "currency",
    },
    {
      name: "ytdAmount",
      type: "currency",
      displayName: "YTD",
      description: "Year-to-date total",
      currencyField: "currency",
    },
    {
      name: "description",
      type: "text",
      displayName: "Description",
      description: "General description or notes about the deduction item",
      searchable: true,
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// INVESTMENT STATEMENT SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

export const INVESTMENT_STATEMENT_HEADER_SCHEMA: FieldDefinition[] = [
  {
    name: "brokerageName",
    type: "text",
    displayName: "Brokerage",
    description: "Brokerage or financial institution name",
    searchable: true,
    isInstitution: true,
    institutionType: "INVESTMENT_FIRM",
  },
  {
    name: "accountNumber",
    type: "text",
    displayName: "Account #",
    description: "Account number (may be masked)",
  },
  {
    name: "accountType",
    type: "text",
    displayName: "Account Type",
    description: "IRA, 401k, Brokerage, etc.",
  },
  {
    name: "periodStart",
    type: "date",
    displayName: "Period Start",
    denormalizedAs: DenormalizedAsType.DATE,
  },
  {
    name: "periodEnd",
    type: "date",
    displayName: "Period End",
  },
  {
    name: "beginningValue",
    type: "currency",
    displayName: "Beginning Value",
    currencyField: "currency",
  },
  {
    name: "endingValue",
    type: "currency",
    displayName: "Ending Value",
    currencyField: "currency",
    denormalizedAs: DenormalizedAsType.AMOUNT,
  },
  {
    name: "currency",
    type: "text",
    displayName: "Currency",
    maxLength: 3,
  },
];

const INVESTMENT_HOLDINGS_SCHEMA: LineItemCollectionSchema = {
  name: "INVESTMENT_HOLDINGS",
  displayName: "Holdings",
  description: "Current portfolio positions",
  fields: [
    {
      name: "ticker",
      type: "text",
      displayName: "Symbol",
      description: "Stock/fund ticker symbol",
      searchable: true,
    },
    {
      name: "name",
      type: "text",
      displayName: "Security Name",
      searchable: true,
    },
    {
      name: "quantity",
      type: "number",
      displayName: "Shares",
    },
    {
      name: "price",
      type: "currency",
      displayName: "Price",
      currencyField: "currency",
    },
    {
      name: "marketValue",
      type: "currency",
      displayName: "Market Value",
      currencyField: "currency",
    },
    {
      name: "costBasis",
      type: "currency",
      displayName: "Cost Basis",
      currencyField: "currency",
    },
    {
      name: "gainLoss",
      type: "currency",
      displayName: "Gain/Loss",
      currencyField: "currency",
    },
    {
      name: "description",
      type: "text",
      displayName: "Description",
      description: "General description or notes about the holding",
      searchable: true,
    },
  ],
};

const INVESTMENT_ACTIVITIES_SCHEMA: LineItemCollectionSchema = {
  name: "INVESTMENT_ACTIVITIES",
  displayName: "Activities",
  description: "Transactions during the period",
  fields: [
    {
      name: "date",
      type: "date",
      displayName: "Date",
      searchable: true,
      isImportant: true,
    },
    {
      name: "type",
      type: "enum",
      displayName: "Type",
      enumValues: [
        "BUY",
        "SELL",
        "DIVIDEND",
        "INTEREST",
        "FEE",
        "TRANSFER",
        "OTHER",
      ],
    },
    {
      name: "ticker",
      type: "text",
      displayName: "Symbol",
      searchable: true,
    },
    {
      name: "description",
      type: "text",
      displayName: "Description",
      searchable: true,
      isImportant: true,
    },
    {
      name: "quantity",
      type: "number",
      displayName: "Shares",
      isReconcilable: true,
    },
    {
      name: "price",
      type: "currency",
      displayName: "Price",
      currencyField: "currency",
      isReconcilable: true,
    },
    {
      name: "amount",
      type: "currency",
      displayName: "Amount",
      currencyField: "currency",
      isReconcilable: true,
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// PURCHASE ORDER SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

export const PURCHASE_ORDER_HEADER_SCHEMA: FieldDefinition[] = [
  {
    name: "poNumber",
    type: "text",
    displayName: "PO Number",
    description: "Purchase order number",
    searchable: true,
  },
  {
    name: "date",
    type: "date",
    displayName: "Date",
    description: "PO issue date",
    denormalizedAs: DenormalizedAsType.DATE,
  },
  {
    name: "deliveryDate",
    type: "date",
    displayName: "Delivery Date",
    description: "Expected delivery date",
    denormalizedAs: DenormalizedAsType.DUE_DATE,
  },
  {
    name: "vendorName",
    type: "text",
    displayName: "Vendor",
    description: "Vendor/supplier name",
    searchable: true,
    isInstitution: true,
    institutionType: "MERCHANT",
  },
  {
    name: "vendorAddress",
    type: "text",
    displayName: "Vendor Address",
  },
  {
    name: "shipToAddress",
    type: "text",
    displayName: "Ship To",
  },
  {
    name: "subtotal",
    type: "currency",
    displayName: "Subtotal",
    currencyField: "currency",
  },
  {
    name: "tax",
    type: "currency",
    displayName: "Tax",
    currencyField: "currency",
  },
  {
    name: "shipping",
    type: "currency",
    displayName: "Shipping",
    currencyField: "currency",
  },
  {
    name: "total",
    type: "currency",
    displayName: "Total",
    currencyField: "currency",
    denormalizedAs: DenormalizedAsType.AMOUNT,
  },
  {
    name: "currency",
    type: "text",
    displayName: "Currency",
    maxLength: 3,
  },
  {
    name: "status",
    type: "enum",
    displayName: "Status",
    enumValues: ["DRAFT", "SENT", "CONFIRMED", "SHIPPED", "RECEIVED", "CLOSED"],
  },
];

export const PURCHASE_ORDER_LINE_ITEM_SCHEMA: FieldDefinition[] = [
  {
    name: "lineNumber",
    type: "number",
    displayName: "Line #",
  },
  {
    name: "sku",
    type: "text",
    displayName: "SKU",
    searchable: true,
  },
  {
    name: "description",
    type: "text",
    displayName: "Description",
    description:
      "General description or notes about the purchase order line item",
    searchable: true,
  },
  {
    name: "quantity",
    type: "number",
    displayName: "Quantity",
    min: 0,
  },
  {
    name: "unit",
    type: "text",
    displayName: "Unit",
  },
  {
    name: "unitPrice",
    type: "currency",
    displayName: "Unit Price",
    currencyField: "currency",
  },
  {
    name: "amount",
    type: "currency",
    displayName: "Amount",
    currencyField: "currency",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRACT SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

export const CONTRACT_HEADER_SCHEMA: FieldDefinition[] = [
  {
    name: "contractNumber",
    type: "text",
    displayName: "Contract #",
    description: "Contract reference number",
    searchable: true,
  },
  {
    name: "title",
    type: "text",
    displayName: "Title",
    description: "Contract title or subject",
    searchable: true,
  },
  {
    name: "contractType",
    type: "text",
    displayName: "Type",
    description: "Service Agreement, NDA, Lease, etc.",
  },
  {
    name: "effectiveDate",
    type: "date",
    displayName: "Effective Date",
    denormalizedAs: DenormalizedAsType.DATE,
  },
  {
    name: "expirationDate",
    type: "date",
    displayName: "Expiration Date",
    denormalizedAs: DenormalizedAsType.DUE_DATE,
  },
  {
    name: "party1Name",
    type: "text",
    displayName: "Party 1",
    searchable: true,
    isInstitution: true,
    institutionType: "OTHER",
  },
  {
    name: "party2Name",
    type: "text",
    displayName: "Party 2",
    searchable: true,
    isInstitution: true,
    institutionType: "OTHER",
  },
  {
    name: "totalValue",
    type: "currency",
    displayName: "Total Value",
    description: "Contract value if applicable",
    currencyField: "currency",
    denormalizedAs: DenormalizedAsType.AMOUNT,
  },
  {
    name: "currency",
    type: "text",
    displayName: "Currency",
    maxLength: 3,
  },
  {
    name: "status",
    type: "enum",
    displayName: "Status",
    enumValues: ["DRAFT", "PENDING", "ACTIVE", "EXPIRED", "TERMINATED"],
  },
];

// Contracts typically don't have line items

// ═══════════════════════════════════════════════════════════════════════════════
// EXPENSE REPORT SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

export const EXPENSE_REPORT_HEADER_SCHEMA: FieldDefinition[] = [
  {
    name: "reportNumber",
    type: "text",
    displayName: "Report #",
    searchable: true,
  },
  {
    name: "employeeName",
    type: "text",
    displayName: "Employee",
    searchable: true,
  },
  {
    name: "department",
    type: "text",
    displayName: "Department",
  },
  {
    name: "submissionDate",
    type: "date",
    displayName: "Submitted",
    denormalizedAs: DenormalizedAsType.DATE,
  },
  {
    name: "periodStart",
    type: "date",
    displayName: "Period Start",
  },
  {
    name: "periodEnd",
    type: "date",
    displayName: "Period End",
  },
  {
    name: "purpose",
    type: "text",
    displayName: "Purpose",
    description: "Trip or expense purpose",
    searchable: true,
  },
  {
    name: "totalAmount",
    type: "currency",
    displayName: "Total",
    currencyField: "currency",
    denormalizedAs: DenormalizedAsType.AMOUNT,
  },
  {
    name: "currency",
    type: "text",
    displayName: "Currency",
    maxLength: 3,
  },
  {
    name: "status",
    type: "enum",
    displayName: "Status",
    enumValues: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "PAID"],
  },
  {
    name: "description",
    type: "text",
    displayName: "Description",
    description: "General description or notes about the expense report",
    searchable: true,
  },
];

export const EXPENSE_REPORT_EXPENSE_SCHEMA: FieldDefinition[] = [
  {
    name: "date",
    type: "date",
    displayName: "Date",
  },
  {
    name: "category",
    type: "text",
    displayName: "Category",
    description: "Travel, Meals, Lodging, etc.",
  },
  {
    name: "description",
    type: "text",
    displayName: "Description",
    searchable: true,
  },
  {
    name: "vendor",
    type: "text",
    displayName: "Vendor",
    searchable: true,
    isInstitution: true,
    institutionType: "MERCHANT",
  },
  {
    name: "amount",
    type: "currency",
    displayName: "Amount",
    currencyField: "currency",
  },
  {
    name: "receiptAttached",
    type: "boolean",
    displayName: "Receipt",
    description: "Whether receipt is attached",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// QUOTE SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

export const QUOTE_HEADER_SCHEMA: FieldDefinition[] = [
  {
    name: "quoteNumber",
    type: "text",
    displayName: "Quote #",
    searchable: true,
  },
  {
    name: "date",
    type: "date",
    displayName: "Date",
    denormalizedAs: DenormalizedAsType.DATE,
  },
  {
    name: "validUntil",
    type: "date",
    displayName: "Valid Until",
    denormalizedAs: DenormalizedAsType.DUE_DATE,
  },
  {
    name: "customerName",
    type: "text",
    displayName: "Customer",
    searchable: true,
    isInstitution: true,
    institutionType: "OTHER",
  },
  {
    name: "customerAddress",
    type: "text",
    displayName: "Customer Address",
  },
  {
    name: "subtotal",
    type: "currency",
    displayName: "Subtotal",
    currencyField: "currency",
  },
  {
    name: "tax",
    type: "currency",
    displayName: "Tax",
    currencyField: "currency",
  },
  {
    name: "discount",
    type: "currency",
    displayName: "Discount",
    currencyField: "currency",
  },
  {
    name: "total",
    type: "currency",
    displayName: "Total",
    currencyField: "currency",
    denormalizedAs: DenormalizedAsType.AMOUNT,
  },
  {
    name: "currency",
    type: "text",
    displayName: "Currency",
    maxLength: 3,
  },
  {
    name: "status",
    type: "enum",
    displayName: "Status",
    enumValues: ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"],
  },
];

export const QUOTE_LINE_ITEM_SCHEMA: FieldDefinition[] = [
  {
    name: "sku",
    type: "text",
    displayName: "SKU",
    searchable: true,
  },
  {
    name: "description",
    type: "text",
    displayName: "Description",
    searchable: true,
    description: "General description or notes about the quote line item",
  },
  {
    name: "quantity",
    type: "number",
    displayName: "Quantity",
    min: 0,
  },
  {
    name: "unit",
    type: "text",
    displayName: "Unit",
  },
  {
    name: "unitPrice",
    type: "currency",
    displayName: "Unit Price",
    currencyField: "currency",
  },
  {
    name: "discount",
    type: "currency",
    displayName: "Discount",
    currencyField: "currency",
  },
  {
    name: "amount",
    type: "currency",
    displayName: "Amount",
    currencyField: "currency",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// REMITTANCE SCHEMA (Wire Transfer / Payment Notification)
// ═══════════════════════════════════════════════════════════════════════════════

export const REMITTANCE_HEADER_SCHEMA: FieldDefinition[] = [
  {
    name: "senderName",
    type: "text",
    displayName: "Sender Name",
    description: "Name of the person or company sending the payment",
    searchable: true,
    isInstitution: true,
    institutionType: "OTHER",
    isImportant: true,
  },
  {
    name: "senderBank",
    type: "text",
    displayName: "Sender Bank/Platform",
    description:
      "Bank or platform used to send the payment (e.g., Mercury, Chase)",
    searchable: true,
    isInstitution: true,
    institutionType: "BANK",
  },
  {
    name: "swiftCode",
    type: "text",
    displayName: "SWIFT/BIC Code",
    description: "SWIFT or BIC code for international transfers",
    searchable: true,
  },
  {
    name: "iban",
    type: "text",
    displayName: "IBAN",
    description: "International Bank Account Number (may be masked)",
  },
  {
    name: "receiverAccount",
    type: "text",
    displayName: "Receiver Account",
    description: "Receiver's account number or last 4 digits",
  },
  {
    name: "transferDate",
    type: "date",
    displayName: "Transfer Date",
    description: "Date the transfer was initiated",
    denormalizedAs: DenormalizedAsType.DATE,
    isImportant: true,
  },
  {
    name: "expectedArrivalDate",
    type: "date",
    displayName: "Expected Arrival",
    description: "Expected date for funds to be available",
  },
  {
    name: "amount",
    type: "currency",
    displayName: "Amount",
    description: "Transfer amount",
    required: true,
    currencyField: "currency",
    denormalizedAs: DenormalizedAsType.AMOUNT,
    isReconcilable: true,
  },
  {
    name: "currency",
    type: "text",
    displayName: "Currency",
    description: "ISO currency code (USD, EUR, BRL)",
    maxLength: 3,
    isImportant: true,
  },
  {
    name: "reference",
    type: "text",
    displayName: "Reference/Memo",
    description: "Transfer reference number or memo",
    searchable: true,
  },
  {
    name: "transferType",
    type: "enum",
    displayName: "Transfer Type",
    description: "Type of transfer",
    enumValues: ["WIRE", "ACH", "SEPA", "SWIFT", "OTHER"],
  },
  {
    name: "status",
    type: "enum",
    displayName: "Status",
    enumValues: ["PENDING", "COMPLETED", "FAILED", "CANCELLED"],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// FOREIGN EXCHANGE CONTRACT SCHEMA (Brazilian Contrato de Câmbio)
// ═══════════════════════════════════════════════════════════════════════════════

export const FOREIGN_EXCHANGE_CONTRACT_HEADER_SCHEMA: FieldDefinition[] = [
  // Contract identification
  {
    name: "contractNumber",
    type: "text",
    displayName: "Contract Number",
    description: "Unique contract identifier (Número do contrato de câmbio)",
    searchable: true,
  },
  {
    name: "contractDate",
    type: "date",
    displayName: "Contract Date",
    description: "Date the contract was issued",
    denormalizedAs: DenormalizedAsType.DATE,
    isImportant: true,
  },
  {
    name: "contractType",
    type: "enum",
    displayName: "Contract Type",
    description: "Purchase or Sale (Compra/Venda)",
    enumValues: ["PURCHASE", "SALE"],
  },
  {
    name: "eventType",
    type: "text",
    displayName: "Event Type",
    description: "Contract event (Contratação, Alteração, Cancelamento)",
  },

  // Bank/Institution
  {
    name: "bankName",
    type: "text",
    displayName: "Bank Name",
    description: "Authorized FX institution name",
    searchable: true,
    isInstitution: true,
    institutionType: "BANK",
    isImportant: true,
  },
  {
    name: "bankTaxId",
    type: "text",
    displayName: "Bank Tax ID",
    description: "Bank CNPJ or tax identifier",
  },

  // Client
  {
    name: "clientName",
    type: "text",
    displayName: "Client Name",
    description: "Client/company name",
    searchable: true,
    isImportant: true,
  },
  {
    name: "clientTaxId",
    type: "text",
    displayName: "Client Tax ID",
    description: "Client CNPJ/CPF or tax identifier",
    searchable: true,
  },
  {
    name: "clientAddress",
    type: "text",
    displayName: "Client Address",
    description: "Client full address",
  },

  // Foreign currency details
  {
    name: "foreignCurrency",
    type: "text",
    displayName: "Foreign Currency",
    description: "ISO code of foreign currency (USD, EUR, etc.)",
    maxLength: 3,
    isImportant: true,
  },
  {
    name: "foreignAmount",
    type: "currency",
    displayName: "Foreign Amount",
    description: "Amount in foreign currency",
    required: true,
    currencyField: "foreignCurrency",
    denormalizedAs: DenormalizedAsType.AMOUNT,
    isImportant: true,
    isReconcilable: true,
  },

  // Exchange rate and local currency
  {
    name: "exchangeRate",
    type: "number",
    displayName: "Exchange Rate",
    description: "Currency exchange rate (Taxa-cambial)",
    isReconcilable: true,
  },
  {
    name: "localCurrency",
    type: "text",
    displayName: "Local Currency",
    description: "ISO code of local currency (eg BRL)",
    maxLength: 3,
  },
  {
    name: "localAmount",
    type: "currency",
    displayName: "Local Amount",
    description: "Amount in local currency (Valor em moeda nacional)",
    currencyField: "localCurrency",
    isReconcilable: true,
  },
  {
    name: "effectiveTotalRate",
    type: "number",
    displayName: "Effective Total Rate (VET)",
    description: "Valor Efetivo Total - all-in exchange rate including fees",
    isReconcilable: true,
  },

  // Delivery and settlement
  {
    name: "deliveryMethod",
    type: "text",
    displayName: "Delivery Method",
    description: "How foreign currency is delivered (e.g., Wire transfer)",
  },
  {
    name: "settlementDate",
    type: "date",
    displayName: "Settlement Date",
    description: "Date when funds will be settled (Liquidação até)",
    denormalizedAs: DenormalizedAsType.DUE_DATE,
  },

  // Nature/Classification (Brazilian regulatory)
  {
    name: "natureCode",
    type: "text",
    displayName: "Nature Code",
    description: "Brazilian Central Bank nature code (Código da natureza)",
    searchable: true,
  },
  {
    name: "natureDescription",
    type: "text",
    displayName: "Nature Description",
    description: "Description of the operation nature",
    searchable: true,
  },

  // Foreign party
  {
    name: "foreignPartyName",
    type: "text",
    displayName: "Foreign Party Name",
    description:
      "Name of payer/receiver abroad (Pagador ou recebedor no exterior)",
    searchable: true,
    isInstitution: true,
    institutionType: "OTHER",
  },
  {
    name: "foreignPartyCountry",
    type: "text",
    displayName: "Foreign Party Country",
    description: "Country of the foreign payer/receiver",
  },
  {
    name: "relationshipCode",
    type: "text",
    displayName: "Relationship Code",
    description: "Code describing relationship between parties",
  },

  // Additional fields
  {
    name: "advancePercentage",
    type: "number",
    displayName: "Advance Percentage",
    description: "Percentage of advance payment on FX contract",
    min: 0,
    max: 100,
  },
  {
    name: "rdeNumber",
    type: "text",
    displayName: "RDE Number",
    description: "Electronic Declaratory Registration number (if applicable)",
  },
  {
    name: "status",
    type: "enum",
    displayName: "Status",
    enumValues: ["CONTRACTED", "SETTLED", "CANCELLED", "AMENDED"],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNTING LEDGER SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

export const ACCOUNTING_LEDGER_HEADER_SCHEMA: FieldDefinition[] = [
  {
    name: "companyName",
    type: "text",
    displayName: "Company Name",
    description: "Name of the company/organization",
    searchable: true,
    isImportant: true,
  },
  {
    name: "reportTitle",
    type: "text",
    displayName: "Report Title",
    description: "Title of the ledger report",
  },
  {
    name: "reportDateStart",
    type: "date",
    displayName: "Report Date Start",
    description: "Start date of the report period",
    denormalizedAs: DenormalizedAsType.DATE,
    isImportant: true,
  },
  {
    name: "reportDateEnd",
    type: "date",
    displayName: "Report Date End",
    description: "End date of the report period",
  },
  {
    name: "valueDateStart",
    type: "date",
    displayName: "Value Date Start",
    description: "Start date for value date range",
  },
  {
    name: "valueDateEnd",
    type: "date",
    displayName: "Value Date End",
    description: "End date for value date range",
  },
  {
    name: "accountName",
    type: "text",
    displayName: "Account/Entity Name",
    description: "Name of the account or counterparty entity",
    searchable: true,
    isInstitution: true,
    institutionType: "OTHER",
    isImportant: true,
  },
  {
    name: "accountNumber",
    type: "text",
    displayName: "Account Number",
    description: "Account identifier or code",
    searchable: true,
  },
  {
    name: "openingBalance",
    type: "currency",
    displayName: "Opening Balance",
    description: "Opening balance at the start of the period",
    currencyField: "currency",
  },
  {
    name: "closingBalance",
    type: "currency",
    displayName: "Closing Balance",
    description: "Closing balance at the end of the period",
    currencyField: "currency",
    denormalizedAs: DenormalizedAsType.AMOUNT,
  },
  {
    name: "totalDebit",
    type: "currency",
    displayName: "Total Debit",
    description: "Total debit amount for the period",
    currencyField: "currency",
  },
  {
    name: "totalCredit",
    type: "currency",
    displayName: "Total Credit",
    description: "Total credit amount for the period",
    currencyField: "currency",
  },
  {
    name: "currency",
    type: "text",
    displayName: "Currency",
    description: "ISO currency code (ILS, USD, EUR, etc.)",
    maxLength: 3,
    isImportant: true,
  },
];

export const ACCOUNTING_LEDGER_TRANSACTION_SCHEMA: FieldDefinition[] = [
  {
    name: "title",
    type: "text",
    displayName: "Title/Description",
    description: "Transaction title or description",
    searchable: true,
    isImportant: true,
  },
  {
    name: "movementId",
    type: "text",
    displayName: "Movement ID",
    description: "Transaction or movement identifier",
    searchable: true,
  },
  {
    name: "contraAccount",
    type: "text",
    displayName: "Contra Account",
    description: "Contra account number or identifier",
    searchable: true,
  },
  {
    name: "documentTypeCode",
    type: "text",
    displayName: "Document Type Code",
    description: "Code indicating the document type",
    searchable: true,
  },
  {
    name: "batchNumber",
    type: "text",
    displayName: "Batch/Lot Number",
    description: "Batch or lot identifier",
    searchable: true,
  },
  {
    name: "valueDate",
    type: "date",
    displayName: "Value Date",
    description: "Value date of the transaction",
    isImportant: true,
  },
  {
    name: "referenceDate",
    type: "date",
    displayName: "Reference Date",
    description: "Reference date for the transaction",
    denormalizedAs: DenormalizedAsType.DATE,
  },
  {
    name: "reference",
    type: "text",
    displayName: "Reference",
    description: "Transaction reference number",
    searchable: true,
  },
  {
    name: "reference2",
    type: "text",
    displayName: "Reference 2",
    description: "Secondary reference number",
    searchable: true,
  },
  {
    name: "details",
    type: "text",
    displayName: "Details",
    description: "Additional transaction details",
    searchable: true,
  },
  {
    name: "debit",
    type: "currency",
    displayName: "Debit",
    description: "Debit amount (outgoing)",
    currencyField: "currency",
    isReconcilable: true,
    isImportant: true,
  },
  {
    name: "credit",
    type: "currency",
    displayName: "Credit",
    description: "Credit amount (incoming)",
    currencyField: "currency",
    isReconcilable: true,
    isImportant: true,
  },
  {
    name: "balance",
    type: "currency",
    displayName: "Balance",
    description: "Running balance after this transaction",
    currencyField: "currency",
  },
  {
    name: "costPrice",
    type: "currency",
    displayName: "Cost Price",
    description: "Cost price if applicable",
    currencyField: "currency",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM DOCUMENT TYPES ARRAY
// ═══════════════════════════════════════════════════════════════════════════════

export interface SystemDocumentType extends DocumentTypeSchema {
  defaultFolderName: string;
  icon: string;
  color: string;
}

export const SYSTEM_DOCUMENT_TYPES: SystemDocumentType[] = [
  {
    name: "CREDIT_CARD_STATEMENT",
    displayName: "Credit Card Statement",
    description: "Monthly credit card activity report",
    headerSchema: CREDIT_CARD_STATEMENT_HEADER_SCHEMA,
    lineItemSchemas: {
      cards: {
        name: "CREDIT_CARD_CARD",
        displayName: "Cards",
        description: "One row per card included in the statement (supports multi-card statements)",
        fields: CREDIT_CARD_CARD_SCHEMA,
      },
      transactions: {
        name: "CREDIT_CARD_TRANSACTION",
        displayName: "Transactions",
        description: "Individual credit card purchases and credits",
        fields: CREDIT_CARD_TRANSACTION_SCHEMA,
      },
    },
    defaultFolderName: "Credit Card Statements",
    icon: "credit-card",
    color: "#f43f5e", // Rose/Pink
  },
  {
    name: "INVOICE",
    displayName: "Invoice",
    description: "Commercial invoice from vendors/suppliers",
    headerSchema: INVOICE_HEADER_SCHEMA,
    lineItemSchemas: {
      items: {
        name: "INVOICE_LINE_ITEM",
        displayName: "Invoice Items",
        description: "Individual line items from the invoice",
        fields: INVOICE_LINE_ITEM_SCHEMA,
      },
    },
    defaultFolderName: "Invoices",
    icon: "file-text",
    color: "#3b82f6", // blue
  },
  {
    name: "RECEIPT",
    displayName: "Receipt",
    description: "Point-of-sale receipt from merchants",
    headerSchema: RECEIPT_HEADER_SCHEMA,
    lineItemSchemas: {
      items: {
        name: "RECEIPT_LINE_ITEM",
        displayName: "Receipt Items",
        description: "Individual line items from the receipt",
        fields: RECEIPT_LINE_ITEM_SCHEMA,
      },
    },
    defaultFolderName: "Receipts",
    icon: "receipt",
    color: "#10b981", // green
  },
  {
    name: "BANK_STATEMENT",
    displayName: "Bank Statement",
    description: "Monthly bank or credit card statement",
    headerSchema: BANK_STATEMENT_HEADER_SCHEMA,
    lineItemSchemas: {
      transactions: {
        name: "BANK_TRANSACTION",
        displayName: "Transactions",
        description: "Bank account transactions",
        fields: BANK_STATEMENT_TRANSACTION_SCHEMA,
      },
    },
    defaultFolderName: "Bank Statements",
    icon: "landmark",
    color: "#6366f1", // indigo
  },
  {
    name: "SUMMARY_OF_BILLING",
    displayName: "Summary of billing",
    description: "Summary of billing",
    headerSchema: SUMMARY_OF_BILLING_HEADER_SCHEMA,
    lineItemSchemas: {
      transactions: {
        name: "SUMMARY_OF_BILLING_TRANSACTION",
        displayName: "Transactions",
        description: "Summary of billing transactions",
        fields: SUMMARY_OF_BILLING_TRANSACTION_SCHEMA,
      },
    },
    defaultFolderName: "Summary of billing",
    icon: "file-text",
    color: "#0ea5e9", // sky blue
  },
  {
    name: "TAX_FORM",
    displayName: "Tax Form",
    description: "Tax documents (W-2, 1099, etc.)",
    headerSchema: TAX_FORM_HEADER_SCHEMA,
    lineItemSchemas: {
      boxes: {
        name: "TAX_FORM_BOX",
        displayName: "Tax Boxes",
        description: "Individual tax form boxes/fields",
        fields: TAX_FORM_BOX_SCHEMA,
      },
    },
    defaultFolderName: "Tax Documents",
    icon: "file-badge",
    color: "#ef4444", // red
  },
  {
    name: "PAYSLIP",
    displayName: "Payslip",
    description: "Employee pay stub / salary slip",
    headerSchema: PAYSLIP_HEADER_SCHEMA,
    lineItemSchemas: {
      earnings: PAYSLIP_EARNINGS_SCHEMA,
      deductions: PAYSLIP_DEDUCTIONS_SCHEMA,
    },
    defaultFolderName: "Payslips",
    icon: "wallet",
    color: "#8b5cf6", // violet
  },
  {
    name: "INVESTMENT_STATEMENT",
    displayName: "Investment Statement",
    description: "Brokerage or retirement account statement",
    headerSchema: INVESTMENT_STATEMENT_HEADER_SCHEMA,
    lineItemSchemas: {
      holdings: INVESTMENT_HOLDINGS_SCHEMA,
      activities: INVESTMENT_ACTIVITIES_SCHEMA,
    },
    defaultFolderName: "Investments",
    icon: "trending-up",
    color: "#14b8a6", // teal
  },
  {
    name: "PURCHASE_ORDER",
    displayName: "Purchase Order",
    description: "Purchase order sent to suppliers",
    headerSchema: PURCHASE_ORDER_HEADER_SCHEMA,
    lineItemSchemas: {
      items: {
        name: "PURCHASE_ORDER_LINE_ITEM",
        displayName: "Order Items",
        description: "Individual items in the purchase order",
        fields: PURCHASE_ORDER_LINE_ITEM_SCHEMA,
      },
    },
    defaultFolderName: "Purchase Orders",
    icon: "shopping-cart",
    color: "#f97316", // orange
  },
  {
    name: "CONTRACT",
    displayName: "Contract",
    description: "Legal contracts and agreements",
    headerSchema: CONTRACT_HEADER_SCHEMA,
    lineItemSchemas: null,
    defaultFolderName: "Contracts",
    icon: "file-signature",
    color: "#64748b", // slate
  },
  {
    name: "EXPENSE_REPORT",
    displayName: "Expense Report",
    description: "Employee expense reimbursement report",
    headerSchema: EXPENSE_REPORT_HEADER_SCHEMA,
    lineItemSchemas: {
      expenses: {
        name: "EXPENSE_REPORT_EXPENSE",
        displayName: "Expenses",
        description: "Individual expense items",
        fields: EXPENSE_REPORT_EXPENSE_SCHEMA,
      },
    },
    defaultFolderName: "Expense Reports",
    icon: "clipboard-list",
    color: "#ec4899", // pink
  },
  {
    name: "QUOTE",
    displayName: "Quote",
    description: "Price quote or estimate",
    headerSchema: QUOTE_HEADER_SCHEMA,
    lineItemSchemas: {
      items: {
        name: "QUOTE_LINE_ITEM",
        displayName: "Quote Items",
        description: "Individual items in the quote",
        fields: QUOTE_LINE_ITEM_SCHEMA,
      },
    },
    defaultFolderName: "Quotes",
    icon: "file-text",
    color: "#eab308", // yellow
  },
  {
    name: "REMITTANCE",
    displayName: "Remittance",
    description: "Wire transfer, ACH, or payment notification",
    headerSchema: REMITTANCE_HEADER_SCHEMA,
    lineItemSchemas: null, // Remittances typically don't have line items
    defaultFolderName: "Remittances",
    icon: "send",
    color: "#0ea5e9", // sky blue
  },
  {
    name: "FOREIGN_EXCHANGE_CONTRACT",
    displayName: "Foreign Exchange Contract",
    description: "Currency exchange contract (Brazilian Contrato de Câmbio)",
    headerSchema: FOREIGN_EXCHANGE_CONTRACT_HEADER_SCHEMA,
    lineItemSchemas: null, // FX contracts typically don't have line items
    defaultFolderName: "FX Contracts",
    icon: "currency",
    color: "#22c55e", // green
  },
  {
    name: "ACCOUNTING_LEDGER",
    displayName: "Accounting Ledger",
    description: "Accounting ledger or journal entry report",
    headerSchema: ACCOUNTING_LEDGER_HEADER_SCHEMA,
    lineItemSchemas: {
      transactions: {
        name: "ACCOUNTING_LEDGER_TRANSACTION",
        displayName: "Transactions",
        description: "Individual ledger transactions",
        fields: ACCOUNTING_LEDGER_TRANSACTION_SCHEMA,
      },
    },
    defaultFolderName: "Accounting Ledgers",
    icon: "book-open",
    color: "#06b6d4", // cyan
  },
];

/**
 * Get system document type by name
 */
export function getSystemDocumentType(
  name: string
): SystemDocumentType | undefined {
  return SYSTEM_DOCUMENT_TYPES.find((t) => t.name === name);
}

/**
 * Get all system document type names
 */
export function getSystemDocumentTypeNames(): string[] {
  return SYSTEM_DOCUMENT_TYPES.map((t) => t.name);
}

