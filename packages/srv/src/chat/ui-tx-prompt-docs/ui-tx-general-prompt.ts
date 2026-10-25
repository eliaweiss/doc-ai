import { uiTxSearchEntitiesPrompt } from "./ui-tx-searchEntities-prompt";

export const uiTxGeneralPrompt = () => {
  const searchEntitiesPrompt = uiTxSearchEntitiesPrompt();

  return `
  - Use the uiTx SDK methods to interact with data:
    * uiTx.searchEntities() - Search for entities
    * uiTx.listDocuments() - List documents
    * uiTx.updateEntityFields() - Update entity fields
    * uiTx.createReconciliationLink() - Create reconciliation links (AKA money flow, or trace)
    * uiTx.listReconciliationLinks() - List reconciliation links with optional filtering
    * uiTx.traceReconciliation() - Trace money flow from/to an entity through reconciliation links
    * uiTx.ui.toast({ message: "...", level?: "info"|"success"|"warning"|"error" }) - Show notifications
    * uiTx.ui.confirm({ title: "...", message: "..." }) - Show confirmation dialog
    * uiTx.ui.openEntity({ entityId: "..." }) - Navigate to entity in main app
    * uiTx.ui.openFolder({ folderId: "..." }) - Navigate to folder in main app
    * uiTx.ui.uploadToFolder({ folderId: "..." }) - Upload a file to a folder in main app
    NOTE: if the user ask to upload a file, then create a btn that opens a folder, if the user doesn't specify a folder, use the root by default.
  
  UI TX API RESPONSE STRUCTURES:
  
  ${searchEntitiesPrompt}

2. uiTx.getEntity({ entityId }) returns:
   {
     ref: EntityObj;
     data: Record<string, unknown>;  // Full entity data with all fields (same as searchEntities)
     schema: FieldDefinition[];      // Schema definition for this entity
     document?: {
       id: string;
       folderId?: string;
       currency?: string;
       documentDate?: string;
       description?: string;
     };
   }

   Use getEntity() when you need the schema definition or document-level metadata.

2b. uiTx.updateEntityFields({ entityId, fields }) - Update entity fields.
   REQUIRED: entityId (string), fields (object with field name -> value).
   Use fields: { fieldName: value }
   Example: uiTx.updateEntityFields({ entityId: "doc123_items_0", fields: { duplicateStatus: "CONFIRMED" } })

3. uiTx.listReconciliationLinks(params?) returns:
   { links: ReconciliationPairObj[] }
   
   Parameters (all optional):
   - entityId?: string - Filter links for a specific entity (returns links where entity is source OR target)
   - schemaType?: string - Filter links where source OR target matches this type (not both)
   - limit?: number - Limit results
   
   Use listReconciliationLinks() to:
   - Find all links connected to a specific entity (pass entityId)
   - Filter links involving a document type (pass schemaType) - returns links where source OR target matches
   - Get a limited set of links (pass limit)
   - When no parameters are provided, returns all links for the organization
   - To filter links between two specific types, fetch all and filter client-side
   
   Each link contains:
   - id, amount, currency, date
   - sourceRef: { ref: EntityRef, field: { name, value, description } }
   - targetRef: { ref: EntityRef, field: { name, value, description } }
   
   IMPORTANT: sourceRef/targetRef are NESTED. Access via sourceRef.ref.schemaType, NOT sourceRef.schemaType.
   Use the moneyTrace tool to see the actual data structure before writing code.


4. uiTx.traceReconciliation(params) returns:
   {
     nodes: Array<{ ref: EntityObj; data: Record<string, unknown> }>;
     edges: Array<{
       source: string;      // entityId of source node
       target: string;      // entityId of target node
       amount: number;      // Amount of the reconciliation
       currency: string;   // Currency code
     }>;
     summary: {
       totalPaths: number;      // Total number of chains traced
       matchingPaths: number;   // Chains that reach the endEntityId (0 if no endEntityId)
       maxDepthReached: number; // Deepest hop reached
       truncated: boolean;      // True if result limit was hit
     };
   }
   
   Parameters:
   - startEntityId?: string - Entity ID to start tracing from
   - endEntityId?: string - Entity ID to trace towards
   - At least one of startEntityId or endEntityId is REQUIRED
   - direction?: "both" | "incoming" | "outgoing" (default: "both") - Direction to trace
     * "both" - Trace both incoming and outgoing links
     * "incoming" - Only trace links where the entity is the target
     * "outgoing" - Only trace links where the entity is the source
   - maxDepth?: number (default: 10) - Maximum depth to trace (how many hops away from start entity)
   - limit?: number (default: 50) - Maximum number of links to return
   
   Usage modes:
   - startEntityId only: Trace all connections from this entity outward
   - endEntityId only: Trace all connections to/from this entity (what flows to this entity)
   - Both startEntityId and endEntityId: Trace from start; summary.matchingPaths counts chains that reach the end entity
   
   The response represents a money flow graph:
   - nodes: Array of entities in the trace, each with:
     * ref: EntityObj - Entity reference (entityId, documentId, schemaType, etc.)
     * data: Record<string, unknown> - Entity data (includes date, amount, currency from the link)
   - edges: Array of connections between entities:
     * source: entityId of the source entity
     * target: entityId of the target entity
     * amount: Reconciliation amount
     * currency: Currency code
   
   Use traceReconciliation() to:
   - Visualize money flow from a specific invoice, payment, or transaction
   - Find all entities connected through reconciliation links
   - Build a graph representation of financial relationships
   - Trace how money moves through the system
   - Find the flow path between two specific entities (use both start and end)
   Before generating the code, use the moneyTrace tool to understand the data structure
   
   Example: Trace all payments connected to an invoice:
   const result = await uiTx.traceReconciliation({
     startEntityId: "abc123",
     maxDepth: 5
   });

   Example: Trace what flows into a bank transaction:
   const result = await uiTx.traceReconciliation({
     endEntityId: "xyz789_transactions_0",
   });

   Example: Trace the path between two entities:
   const result = await uiTx.traceReconciliation({
     startEntityId: "abc123",
     endEntityId: "xyz789_transactions_0",
   });
   // result.nodes contains all entities in the trace
   // result.edges contains all connections between them

6. When accessing search results in code:
   - Use result.ref.entityId (not result.entityId)
   - Use result.data.vendorName (not result.preview.vendorName - preview doesn't have it)
   - Use result.preview.amount for quick access, or result.data.total for full data
   - For navigation: window.zDocs.uiTx.ui.openEntity(result.ref.entityId)

7. Opening documents in a new tab:
   To open a document in a new tab, use:
   window.open(\`${process.env.NEXT_PUBLIC_URL
    }/document/\{documentId}\`, '_blank')
   
   Where:
   - documentId comes from result.ref.documentId (from searchEntities results)
   
   Always open document links in a new tab using '_blank' as the second parameter.

When the user describes what they want, explore the data first if needed, then propose edits.`;

}