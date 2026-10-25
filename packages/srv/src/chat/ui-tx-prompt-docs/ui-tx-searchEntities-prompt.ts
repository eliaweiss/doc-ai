export const uiTxSearchEntitiesPrompt = () => {
  return `
---
uiTx.searchEntities(params)

Designed to run complex queries - searching across multiple entity types with a single query string.

   Parameters (params object):
   {
     query: string;                    //  A free-form text that is expected to appear in the entity's content, eg "serrano", "walmart", "Thinking Machines", etc. empty if you want to search by filters/where clauses only - but not literal '""'
     limit?: number;                    // Maximum number of results to return (default: 50)
     offset?: number;                   // Number of results to skip for pagination (default: 0)
     filters?: {                        // Optional structured filters
       preview?: {                      // Preview data filters - indexed fields for fast filtering
         date?: {                       // Filter by date range (YYYY-MM-DD format)
           gte?: string;                // Start date (inclusive)
           lte?: string;                // End date (inclusive)
         };
         amount?: {                     // Filter by amount range
           gte?: number;                // Minimum amount (inclusive)
           lte?: number;                // Maximum amount (inclusive)
         };
         currency?: string | string[];  // Filter by currency code(s) (e.g., "USD", "EUR")
       };
      entity?: {                       // Entity metadata filters - exact matching
        entityId?: string | string[];  // Filter by entity ID(s) - for exact entity retrieval
        documentId?: string | string[];  // Filter by document ID(s) - to find all entities (headers and line items) from specific document(s)
        entityType?: "HEADER" | "LINE_ITEM" | Array<"HEADER" | "LINE_ITEM">;  // Filter by entity type(s)
        docType?: string | string[];   // Filter by document type(s) (e.g., "INVOICE", "BANK_STATEMENT")
        schemaType?: string | string[];  // Filter by schema type(s) (e.g., "INVOICE_header", "INVOICE_items")
        collectionKey?: string | string[];  // Filter by collection key(s) (e.g., "items", "transactions")
        folderId?: string | string[];  // Filter by document folder ID(s)
        isDataset?: boolean;           // Filter by dataset flag (true/false)
       };
     };
     where?: Array<{                    // Optional structured where clauses (ANDed with queries). Filters on schema-specific JSONB fields
       schemaType: string;              // REQUIRED: The schema type to filter on (e.g., "INVOICE_header", "INVOICE_items")
                                        // For HEADER entities (e.g., "INVOICE_header"): filters on headerData JSONB fields
                                        // For LINE_ITEM entities (e.g., "INVOICE_items"): returns ALL line items from documents
                                        //   where ANY item in the collection matches the condition
       field: string;                   // Field name to filter on - schema-specific field from headerData or lineItems
                                        // Examples for INVOICE_header: "invoiceNumber", "vendorName", "total"
                                        // Examples for INVOICE_items: "description", "amount", "quantity", "sku"
       op: "=" | "in" | ">" | ">=" | "<" | "<=" | "contains";  // Comparison operator
       value: unknown;                  // Value to compare against (type depends on field and operator)
     }>;
     excludeReconciled?: boolean;       // When true, excludes entities that are already reconciled (default: false)
     reconciliationTargetEntity?: {     // Required when excludeReconciled is true. Specifies the target entity type for reconciliation filtering
       schemaType: string;              // e.g., "INVOICE_header", "BANK_STATEMENT_transactions"
       entityType: "HEADER" | "LINE_ITEM";
       docType: string;                 // e.g., "INVOICE", "BANK_STATEMENT"
       collectionKey: string | null;    // e.g., "items", "transactions", null for headers
     };
     exactMatch?: boolean;               // When true, disables fuzzy matching - only exact text matches (default: true)
     sort?: Array<{                     // Sort order for results (can specify multiple sort fields)
       field: "date" | "amount" | "relevance";  // Field to sort by
       order: "asc" | "desc";           // Sort direction: "asc" (ascending) or "desc" (descending)
     }>;
   }

   Returns:
   {
     total: number;                     // Total number of matching entities (for pagination)
     hasMore: boolean;                  // Whether there are more results beyond the current page
     results: Array<{
       ref: {
         entityId: string;              // Use this for getEntity() or openEntity()
         documentId: string;             // ID of the parent document
         entityType: "HEADER" | "LINE_ITEM";
         docType: string;               // e.g., "INVOICE", "BANK_STATEMENT"
         schemaType: string;             // e.g., "INVOICE_header", "INVOICE_items"
         collectionKey: string | null;  // e.g., "items", "transactions", null for headers
         index?: number;                // For line items: position in collection
         isDataset: boolean;            // Whether the source document is a dataset
       };
       preview: {                       // Quick preview data (date, amount, currency, description)
         date: string;
         amount: number;
         currency: string;
         description: string;
       };
       data: Record<string, unknown>;   // ✅ FULL entity data with ALL schema fields
                                        // Examples: vendorName, invoiceNumber, paymentStatus,
                                        // total, subtotal, tax, dueDate, etc.
                                        // This is the complete data from header or line item
     }>;
   }

   IMPORTANT: searchEntities() returns BOTH preview (quick fields) AND full data (all fields).
   You can access fields like:
   - result.data.vendorName (for invoices)
   - result.data.invoiceNumber
   - result.data.paymentStatus
   - result.data.total
   - result.ref.entityId (for navigation or getEntity calls)

   Examples:
   * find all invoices from serrano in the last year with preview filters
   uiTx.searchEntities({
     query: "serrano",
     limit: 20,
     filters: {
       preview: {
         date: { gte: "2024-01-01", lte: "2024-12-31" },
         currency: "USD",
         amount: { gte: 100 }
       },
       entity: {
         schemaType: ["INVOICE_header", "RECEIPT_header"]
       }
     },
     sort: [{ field: "date", order: "desc" }]
   })

   * retrieve specific entities by ID
   uiTx.searchEntities({
     query: "",
     filters: {
       entity: { entityId: ["abc123", "def456"] }
     }
   })

   * find all entities (headers and line items) from specific document(s)
   uiTx.searchEntities({
     query: "",
     filters: {
       entity: { documentId: ["doc123", "doc456"] }
     }
   })

   * find a specific invoice by invoice number (filtering on header JSONB field)
   uiTx.searchEntities({
     query: "",
     where: [{
       schemaType: "INVOICE_header",
       field: "invoiceNumber",
       op: "contains",
       value: "INV-2024",
     }]
   })

   * find ALL line items from invoices where ANY item has amount > 100
   uiTx.searchEntities({
     query: "",
     where: [{
       schemaType: "INVOICE_items",
       field: "amount",
       op: ">",
       value: 100,
     }]
   })

   * find ALL transactions from bank statements where ANY transaction contains "payment"
   uiTx.searchEntities({
     query: "",
     where: [{
       schemaType: "BANK_STATEMENT_transactions",
       field: "description",
       op: "contains",
       value: "payment",
     }]
   })
`;

}