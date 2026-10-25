/**
 * Filter-based selection for bulk MCP tools (move_documents,
 * update_entity_fields).
 *
 * A selection is a search_entities query without paging; the server resolves
 * it, so entity and document ids never have to pass through the model's
 * context. Bulk tools take `dryRun` (count + samples, nothing changed) and,
 * for a real run, `expectedCount` from that dry run: if the selection now
 * matches a different number of entities, nothing is changed.
 */
import { z } from "zod";
import { handleSearchEntities, type UiTxContext } from "@zdocs/srv";

const PAGE = 500;
/** Most entities one selection may resolve to */
export const MAX_SELECTED = 2000;

const stringOrArray = z.union([z.string(), z.array(z.string())]);
const range = <T extends z.ZodTypeAny>(t: T) => z.object({ gte: t.optional(), lte: t.optional() });
const whereOp = z.enum(["=", "in", ">", ">=", "<", "<=", "contains"]);

export const selectionSchema = z
  .object({
    query: z.string().optional().describe('Free text, as in search_entities; omit or "" to select by filters/where only'),
    exactMatch: z.boolean().optional(),
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
          })
          .optional(),
      })
      .optional(),
    where: z
      .array(z.object({ schemaType: z.string(), field: z.string(), op: whereOp, value: z.any() }))
      .optional(),
  })
  .describe(
    "Which entities to act on: the same query/filters/where as search_entities (no limit/offset/sort). " +
      'E.g. { filters: { entity: { schemaType: "RECEIPT_header" } }, where: [{ schemaType: "RECEIPT_header", field: "merchantName", op: "in", value: ["Luigi\'s", "LUIGIS PIZZERIA"] }] }'
  );

export type Selection = z.infer<typeof selectionSchema>;

type Entity = {
  ref: { entityId: string; documentId: string; schemaType: string };
  preview?: { date?: string; amount?: number; currency?: string; description?: string };
  data?: Record<string, unknown>;
};

/** Resolves a selection to its entities; refuses an empty (select-everything) or oversized selection */
export async function selectEntities(ctx: UiTxContext, selection: Selection): Promise<Entity[]> {
  const narrowed =
    !!selection.query?.trim() ||
    !!selection.where?.length ||
    Object.values(selection.filters?.entity ?? {}).some((v) => v !== undefined) ||
    Object.values(selection.filters?.preview ?? {}).some((v) => v !== undefined);
  if (!narrowed) throw new Error("select needs a query, where or filters; it won't select everything");

  const entities: Entity[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const page: any = await handleSearchEntities(ctx, { query: "", ...selection, limit: PAGE, offset } as any);
    entities.push(...(page.results as Entity[]));
    if (entities.length > MAX_SELECTED) {
      throw new Error(`select matches more than ${MAX_SELECTED} entities (total ${page.total}); narrow it`);
    }
    if (!page.hasMore || page.results.length === 0) break;
  }
  return entities;
}

/** What a dry run reports: counts and a few examples (with the fields `where` matched on) to check the selection against */
export function selectionPreview(entities: Entity[], documentIds: string[], selection: Selection) {
  const whereFields = [...new Set((selection.where ?? []).map((w) => w.field))];
  return {
    dryRun: true,
    entityCount: entities.length,
    documentCount: documentIds.length,
    schemaTypes: [...new Set(entities.map((e) => e.ref.schemaType))],
    samples: entities.slice(0, 8).map((e) => ({
      entityId: e.ref.entityId,
      date: e.preview?.date,
      amount: e.preview?.amount,
      currency: e.preview?.currency,
      description: e.preview?.description,
      ...Object.fromEntries(whereFields.map((f) => [f, e.data?.[f]])),
    })),
  };
}

/** Real runs on a selection must carry the dry run's count */
export function checkExpectedCount(actual: number, expected: number | undefined, what: string) {
  if (expected === undefined) {
    throw new Error(`Run with dryRun: true first, then pass its ${what} as expectedCount`);
  }
  if (actual !== expected) {
    throw new Error(`select now matches ${actual} ${what === "documentCount" ? "documents" : "entities"}, not ${expected}; nothing changed. Dry-run again.`);
  }
}
