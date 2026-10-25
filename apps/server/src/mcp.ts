/**
 * MCP server (Streamable HTTP, stateless) exposed at /mcp.
 *
 * Tools wrap zdocs' uiTx handlers (search / get / aggregate / update /
 * reconciliation links), which
 * were the closest thing zdocs had to an agent tool surface, plus local
 * status / document / schema tools and mini-app tools (replacing the AI builder).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import {
  LOCAL_ORG_ID,
  getSearchableEntitiesForOrg,
} from "@zdocs/db-schema";
import {
  handleAggregate,
  handleGetEntity,
  handleListDocuments,
  handleSearchEntities,
  handleUpdateEntityFields,
  uiTxSearchEntitiesPrompt,
  type UiTxContext,
} from "@zdocs/srv";
import {
  createDocumentType,
  getDocumentDetail,
  getDocumentType,
  getStatus,
  listDocumentTypes,
  reprocessDocument,
} from "./services";
import { registerPhotoSortTools } from "./photo-sort/mcp-tools";
import { registerMiniAppTools } from "./mini-apps/mcp-tools";
import { registerFolderTools, type ApiPost } from "./folders/mcp-tools";
import { registerReconciliationTools } from "./reconciliation/mcp-tools";
import { checkExpectedCount, selectEntities, selectionPreview, selectionSchema, type Selection } from "./selection";

const ctx: UiTxContext = { orgId: LOCAL_ORG_ID, authMethod: "api_key" };

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function wrap<A>(fn: (args: A) => Promise<unknown>) {
  return async (args: A) => {
    try {
      return json(await fn(args));
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
      };
    }
  };
}

const stringOrArray = z.union([z.string(), z.array(z.string())]);
const range = <T extends z.ZodTypeAny>(t: T) => z.object({ gte: t.optional(), lte: t.optional() });
const whereOp = z.enum(["=", "in", ">", ">=", "<", "<=", "contains"]);

type McpOptions = { onEnqueued?: () => void; api: ApiPost };

export function createMcpServer(opts: McpOptions) {
  const server = new McpServer({ name: "doc-ai", version: "0.1.0" });

  server.registerTool(
    "get_status",
    {
      description:
        "doc-ai status: watched folder, model provider, document counts per extraction status and queue stats.",
    },
    wrap(async () => getStatus())
  );

  server.registerTool(
    "list_document_types",
    {
      description:
        "List document types (schemas) used for classification and extraction, with their header field names and line-item collections.",
    },
    wrap(async () => listDocumentTypes())
  );

  server.registerTool(
    "get_document_type",
    {
      description: "Get the full schema of one document type (header fields, line-item collections, formulas).",
      inputSchema: { name: z.string().describe('Type name, e.g. "INVOICE"') },
    },
    wrap(async ({ name }: { name: string }) => {
      const type = await getDocumentType(name);
      if (!type) throw new Error(`Document type not found: ${name}`);
      return type;
    })
  );

  server.registerTool(
    "create_document_type",
    {
      description:
        "Create a custom document type. headerSchema is an array of field definitions " +
        '({ name, displayName, type, description }); ' +
        "lineItemSchemas maps a collection key to { displayName, description, fields: FieldDefinition[] }. " +
        "Use get_document_type on a system type (e.g. INVOICE) to see the exact format. " +
        "Code formula fields are rejected for now.",
      inputSchema: {
        name: z.string(),
        displayName: z.string(),
        description: z.string().optional(),
        extractionHint: z.string().optional(),
        headerSchema: z.array(z.record(z.any())),
        lineItemSchemas: z.record(z.record(z.any())).optional(),
      },
    },
    wrap(async (args: any) => createDocumentType(args))
  );

  server.registerTool(
    "list_documents",
    {
      description: "List documents with optional filters (type, folder, date range, amount range, currency) and ordering.",
      inputSchema: {
        docType: stringOrArray.optional(),
        folderId: stringOrArray.optional(),
        date: range(z.string()).optional().describe("YYYY-MM-DD range on the document date"),
        amount: range(z.number()).optional(),
        currency: stringOrArray.optional(),
        orderBy: z
          .object({ field: z.enum(["documentDate", "createdAt", "totalAmount"]), dir: z.enum(["asc", "desc"]) })
          .optional(),
        limit: z.number().int().positive().max(500).optional(),
        offset: z.number().int().nonnegative().optional(),
      },
    },
    wrap(async (args: any) => handleListDocuments(ctx, { ...args, orgId: LOCAL_ORG_ID }))
  );

  server.registerTool(
    "get_document",
    {
      description: "Get one document: file info, extraction status, extracted header data, line items and notifications.",
      inputSchema: { documentId: z.string() },
    },
    wrap(async ({ documentId }: { documentId: string }) => {
      const detail = await getDocumentDetail(documentId);
      if (!detail) throw new Error(`Document not found: ${documentId}`);
      return detail;
    })
  );

  server.registerTool(
    "list_searchable_entities",
    {
      description:
        'List searchable entity kinds (schemaType values such as "INVOICE_header" or "BANK_STATEMENT_transactions") with their fields. Call before search_entities to pick schemaType and where fields.',
    },
    wrap(async () => getSearchableEntitiesForOrg(LOCAL_ORG_ID))
  );

  server.registerTool(
    "search_entities",
    {
      description:
        "Search extracted entities (document headers and line items such as transactions). Arguments are the params object below.\n" +
        uiTxSearchEntitiesPrompt(),
      inputSchema: {
        query: z.string().describe('Free text; "" to search by filters/where only'),
        limit: z.number().int().positive().max(500).optional(),
        offset: z.number().int().nonnegative().optional(),
        filters: z
          .object({
            preview: z
              .object({
                date: range(z.string()).optional(),
                amount: range(z.number()).optional(),
                currency: stringOrArray.optional(),
              })
              .optional(),
            entity: z
              .object({
                entityId: stringOrArray.optional(),
                documentId: stringOrArray.optional(),
                entityType: z
                  .union([z.enum(["HEADER", "LINE_ITEM"]), z.array(z.enum(["HEADER", "LINE_ITEM"]))])
                  .optional(),
                docType: stringOrArray.optional(),
                schemaType: stringOrArray.optional(),
                collectionKey: stringOrArray.optional(),
                folderId: stringOrArray.optional(),
                isDataset: z.boolean().optional(),
              })
              .optional(),
          })
          .optional(),
        exactMatch: z.boolean().optional(),
        where: z
          .array(z.object({ schemaType: z.string(), field: z.string(), op: whereOp, value: z.any() }))
          .optional(),
        sort: z
          .array(z.object({ field: z.enum(["date", "amount", "relevance"]), order: z.enum(["asc", "desc"]) }))
          .optional(),
      },
    },
    wrap(async (args: any) => handleSearchEntities(ctx, args))
  );

  server.registerTool(
    "get_entity",
    {
      description:
        "Get one entity by id: a documentId (header) or documentId_collectionKey_index (line item).",
      inputSchema: { entityId: z.string() },
    },
    wrap(async (args: { entityId: string }) => handleGetEntity(ctx, { ...args, orgId: LOCAL_ORG_ID }))
  );

  server.registerTool(
    "aggregate",
    {
      description:
        'Aggregate extracted entities: count/sum/avg with optional groupBy and where filters. Set from: "entities".\n' +
        "Index fields: groupBy docType, entityType, schemaType, collectionKey, currency, isDataset, isDuplicate, date, month, year; " +
        "sum/avg on amount; where on those plus entityId, documentId, date, amount, description.\n" +
        'Set schemaType (e.g. "INVOICE_header", from list_searchable_entities) to restrict to one entity kind and to use its schema fields ' +
        'in groupBy, where and sum/avg, e.g. total per vendor: schemaType "INVOICE_header", groupBy ["vendorName", "currency"].\n' +
        "Unknown fields are errors. Without schemaType or an entityType/schemaType/collectionKey filter, only headers are counted; " +
        "sums of amount are split by currency unless one currency is filtered. Both defaults are reported in notes.",
      inputSchema: {
        from: z.enum(["entities", "documents"]).default("entities"),
        metrics: z.array(
          z.object({ op: z.enum(["count", "sum", "avg"]), field: z.string().optional(), as: z.string() })
        ),
        groupBy: z.array(z.string()).optional(),
        where: z.array(z.object({ field: z.string(), op: whereOp, value: z.any() })).optional(),
        schemaType: z.string().optional().describe('One schema type, e.g. "INVOICE_header"; enables its schema fields'),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().int().positive().optional(),
      },
    },
    wrap(async (args: any) => handleAggregate(ctx, { ...args, orgId: LOCAL_ORG_ID }))
  );

  server.registerTool(
    "update_entity_fields",
    {
      description:
        "Correct extracted values on a header or line item. Field names are validated against the schema.\n" +
        "To set the same values on many entities, pass select (search_entities filters, one schemaType) instead of " +
        "entityId: call with dryRun: true first (counts and samples, nothing changed), show the user, then call again " +
        "with expectedCount set to the dry run's entityCount. excludeEntityIds drops entities that shouldn't change.",
      inputSchema: {
        entityId: z.string().optional(),
        select: selectionSchema.optional(),
        excludeEntityIds: z.array(z.string()).optional(),
        fields: z.record(z.any()),
        dryRun: z.boolean().optional(),
        expectedCount: z.number().int().nonnegative().optional(),
      },
    },
    wrap(
      async (args: {
        entityId?: string;
        select?: Selection;
        excludeEntityIds?: string[];
        fields: Record<string, unknown>;
        dryRun?: boolean;
        expectedCount?: number;
      }) => {
        if (!args.entityId === !args.select) throw new Error("Pass either entityId or select");
        if (args.entityId) {
          return handleUpdateEntityFields(ctx, { entityId: args.entityId, fields: args.fields, orgId: LOCAL_ORG_ID });
        }

        const excluded = new Set(args.excludeEntityIds ?? []);
        const entities = (await selectEntities(ctx, args.select!)).filter((e) => !excluded.has(e.ref.entityId));
        const schemaTypes = new Set(entities.map((e) => e.ref.schemaType));
        if (schemaTypes.size > 1) {
          throw new Error(`select matches several schemaTypes (${[...schemaTypes].join(", ")}); narrow it to one`);
        }
        if (args.dryRun) {
          return selectionPreview(entities, [...new Set(entities.map((e) => e.ref.documentId))], args.select!);
        }
        checkExpectedCount(entities.length, args.expectedCount, "entityCount");

        const updated: string[] = [];
        const failed: { entityId: string; error: string }[] = [];
        for (const e of entities) {
          let error: string | undefined;
          try {
            const res: any = await handleUpdateEntityFields(ctx, {
              entityId: e.ref.entityId,
              fields: args.fields,
              orgId: LOCAL_ORG_ID,
            });
            if (res?.ok === false) error = res.error?.message ?? "update failed";
          } catch (err) {
            error = err instanceof Error ? err.message : String(err);
          }
          if (!error) updated.push(e.ref.entityId);
          else {
            failed.push({ entityId: e.ref.entityId, error });
            // Same fields for every entity: if the first fails (e.g. unknown field), the rest would too
            if (updated.length === 0) return { updated: 0, failed, stopped: "first update failed; nothing changed" };
          }
        }
        return { updated: updated.length, failed };
      }
    )
  );

  server.registerTool(
    "reprocess_document",
    {
      description: "Queue a document for classification and extraction again (e.g. after a schema change).",
      inputSchema: { documentId: z.string() },
    },
    wrap(async ({ documentId }: { documentId: string }) => reprocessDocument(documentId, opts.onEnqueued))
  );

  registerPhotoSortTools(server, opts);
  registerMiniAppTools(server, wrap);
  registerFolderTools(server, wrap, opts.api);
  registerReconciliationTools(server, wrap);

  return server;
}

/** Stateless Streamable HTTP: one server + transport per request. */
export async function handleMcpRequest(req: Request, opts: McpOptions) {
  const server = createMcpServer(opts);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    // Response is fully built in JSON mode, so the per-request server can go
    void server.close();
  }
}
