/**
 * MCP tools for reconciliation links (payment ↔ invoice, statement line ↔
 * receipt, ...): list, trace, create and delete.
 *
 * They wrap the same uiTx handlers mini apps call through
 * zDocs.uiTx.*ReconciliationLink / traceReconciliation. create takes plain
 * entity ids and builds the ReconciliationObjRefs from get_entity, so the
 * caller doesn't have to assemble refs by hand.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LOCAL_ORG_ID } from "@zdocs/db-schema";
import {
  handleCreateReconciliationLink,
  handleDeleteReconciliationLink,
  handleGetEntity,
  handleListReconciliationLinks,
  handleTraceReconciliation,
  type UiTxContext,
} from "@zdocs/srv";
import type { ReconciliationObjRef } from "@zdocs/types";

const ctx: UiTxContext = { orgId: LOCAL_ORG_ID, authMethod: "api_key" };

/** Entity → ReconciliationObjRef; `field` names the amount field the link is matched on */
async function objRef(entityId: string, field?: string): Promise<ReconciliationObjRef> {
  const entity = await handleGetEntity(ctx, { orgId: LOCAL_ORG_ID, entityId });
  if (field && !(field in entity.data)) {
    throw new Error(`Field "${field}" not found on ${entityId}`);
  }
  const value = field ? Number(entity.data[field]) : NaN;
  return {
    ref: entity.ref,
    field: {
      name: field ?? null,
      value: Number.isFinite(value) ? value : null,
      description: entity.document?.description ?? "",
    },
  };
}

export function registerReconciliationTools(
  server: McpServer,
  wrap: <A>(fn: (args: A) => Promise<unknown>) => (args: A) => Promise<any>
) {
  server.registerTool(
    "list_reconciliation_links",
    {
      description:
        "List reconciliation links. With entityId, the links touching that entity (either side); " +
        'with schemaType (e.g. "INVOICE_header"), links where either side is of that kind.',
      inputSchema: {
        entityId: z.string().optional(),
        schemaType: z.string().optional(),
        limit: z.number().int().positive().optional(),
      },
    },
    wrap(async (args: any) => handleListReconciliationLinks(ctx, { ...args, orgId: LOCAL_ORG_ID }))
  );

  server.registerTool(
    "trace_reconciliation",
    {
      description:
        "Follow reconciliation links from an entity (and optionally to an end entity) and return the " +
        "graph of entities (nodes) and links (edges) the money flows through.",
      inputSchema: {
        startEntityId: z.string().optional(),
        endEntityId: z.string().optional(),
        maxDepth: z.number().int().positive().optional().describe("Default 10"),
        limit: z.number().int().positive().optional().describe("Default 50"),
      },
    },
    wrap(async (args: any) => handleTraceReconciliation(ctx, { ...args, orgId: LOCAL_ORG_ID }))
  );

  server.registerTool(
    "create_reconciliation_link",
    {
      description:
        "Link two entities (headers or line items, by entityId) as reconciled, e.g. a bank-statement " +
        "transaction (source) paying an invoice (target). amount is the part of the money this link covers; " +
        "a payment split over several invoices gets one link per invoice. date defaults to the source's date. " +
        "sourceField/targetField name the amount fields matched (e.g. transactionAmount, totalAmount).",
      inputSchema: {
        sourceEntityId: z.string(),
        targetEntityId: z.string(),
        amount: z.number(),
        currency: z.string(),
        date: z.string().optional().describe("YYYY-MM-DD"),
        sourceField: z.string().optional(),
        targetField: z.string().optional(),
        note: z.string().optional().describe("Why these were linked; stored in the link's metadata"),
      },
    },
    wrap(
      async (args: {
        sourceEntityId: string;
        targetEntityId: string;
        amount: number;
        currency: string;
        date?: string;
        sourceField?: string;
        targetField?: string;
        note?: string;
      }) => {
        const sourceRef = await objRef(args.sourceEntityId, args.sourceField);
        const targetRef = await objRef(args.targetEntityId, args.targetField);
        return handleCreateReconciliationLink(ctx, {
          orgId: LOCAL_ORG_ID,
          sourceRef,
          targetRef,
          amount: args.amount,
          currency: args.currency,
          date: args.date || sourceRef.ref.date,
          metadata: args.note ? { note: args.note, createdVia: "mcp" } : { createdVia: "mcp" },
          type: "manual",
        });
      }
    )
  );

  server.registerTool(
    "delete_reconciliation_link",
    {
      description: "Remove a reconciliation link by its id (from list_reconciliation_links). Soft delete.",
      inputSchema: { linkId: z.string() },
    },
    wrap(async ({ linkId }: { linkId: string }) =>
      handleDeleteReconciliationLink(ctx, { orgId: LOCAL_ORG_ID, linkId })
    )
  );
}
