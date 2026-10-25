/**
 * MCP tools for mini apps: the MCP client takes the place of zdocs' AI builder.
 * Edits use zdocs' anchor-based applyEdits and every saved version is checked
 * with validateMiniAppCode, like the builder's generateEdit tool. Each save
 * also writes a mini_apps_history snapshot (in the copied update query).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  LOCAL_ORG_ID,
  LOCAL_USER_ID,
  createMiniApp,
  getMiniAppForOrg,
  listMiniAppsForOrg,
  updateMiniAppForOrg,
} from "@zdocs/db-schema";
import { getConfig, uiTxGeneralPrompt } from "@zdocs/srv";
import { applyEdits, validateMiniAppCode } from "@zdocs/util";
import type { EditOp, MiniApp, UpdateMiniAppParams } from "@zdocs/types";

const SDK_SRC = "/sdk/ui-tx/v1.js";

function appUrl(id: string) {
  return `http://localhost:${getConfig().port}/app/${id}`;
}

function summary(app: MiniApp, warnings: string[] = []) {
  return {
    id: app.id,
    name: app.name,
    description: app.description,
    icon: app.icon,
    color: app.color,
    url: appUrl(app.id),
    codeLength: app.code.length,
    updatedAt: app.updatedAt,
    archived: app.archivedAt !== null,
    ...(warnings.length ? { warnings } : {}),
  };
}

/** Throws on invalid code (nothing is saved); returns non-blocking warnings */
function checkCode(code: string): string[] {
  const validation = validateMiniAppCode(code);
  if (!validation.ok) {
    throw new Error(`Code not saved, validation failed:\n- ${validation.errors.join("\n- ")}`);
  }
  return code.includes(SDK_SRC)
    ? []
    : [`No <script src="${SDK_SRC}"> tag: window.zDocs.uiTx won't be available`];
}

async function getApp(id: string): Promise<MiniApp> {
  const app = await getMiniAppForOrg(LOCAL_ORG_ID, id);
  if (!app) throw new Error(`Mini app not found: ${id}`);
  return app;
}

/**
 * zdocs' builder instructions and uiTx SDK docs, adapted to an MCP client:
 * the builder's docSearch/moneyTrace tools are this server's search tools, and
 * NEXT_PUBLIC_URL is unset in doc-ai, so document links are relative.
 */
function miniAppGuide() {
  const sdkDocs = uiTxGeneralPrompt().replace(/undefined\/document\//g, "/document/");
  return `# Writing doc-ai mini apps

Mini apps are self-contained HTML/CSS/JavaScript apps that run in a sandboxed iframe inside the doc-ai web UI and read and update documents through the uiTx SDK.

REQUIREMENTS:
- A complete, self-contained HTML document
- Include the SDK: <script src="${SDK_SRC}"></script>
- Access the SDK via window.zDocs.uiTx (all methods are async)
- All CSS and JavaScript inline (no external dependencies)
- Modern, clean, responsive design with proper error handling
- Optional theme support: window.__PARENT_THEME__ is "dark" or "light"

BEFORE WRITING CODE: explore the data with this server's tools so the code matches the real schema.
- list_searchable_entities: the entity types (e.g. INVOICE_header, INVOICE_items)
- search_entities / get_entity: real results and schemas (the builder's "docSearch")
- get_document_type: full field definitions

DOC-AI DIFFERENCES FROM THE DOCS BELOW:
- There is no "moneyTrace" tool on this server: to see real reconciliation link shapes, follow the response structures below.
- Data methods: getSession, searchEntities, getEntity, listDocuments, aggregate, updateEntityFields, listReconciliationLinks, traceReconciliation, createReconciliationLink, deleteReconciliationLink.

EDITING: prefer update_mini_app with small anchor-based "edits" over resending the whole code:
- replace: { type: "replace", anchor, old?, new } (with "old", replaces that text near the anchor; without, replaces the anchor)
- insert_before / insert_after: { type, anchor, new } (new can be an array of lines)
- delete: { type: "delete", anchor, old } ("old" is required)
- occurrence picks the nth match of the anchor (0 = first); anchorContext limits the search to that substring.
Edits apply in order and all must succeed; the result must pass HTML/JS/CSS validation, otherwise nothing is saved.

UI TX SDK:
${sdkDocs}`;
}

const editOp = z.object({
  type: z.enum(["replace", "insert_before", "insert_after", "delete"]),
  anchor: z.string().describe("Exact, stable substring of the current code that locates the edit"),
  old: z.string().optional().describe("Exact text to replace or delete, near the anchor"),
  new: z.union([z.string(), z.array(z.string())]).optional().describe("New text (string or array of lines)"),
  occurrence: z.number().int().min(0).optional(),
  anchorContext: z.string().optional(),
  reason: z.string().optional(),
});

const metadata = {
  description: z.string().optional(),
  icon: z.string().optional().describe('Lucide icon name, e.g. "Receipt", "BarChart3"'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex colour, e.g. #6366f1"),
};

export function registerMiniAppTools(
  server: McpServer,
  wrap: <A>(fn: (args: A) => Promise<unknown>) => (args: A) => Promise<any>
) {
  server.registerTool(
    "get_mini_app_guide",
    {
      description:
        "How to write a doc-ai mini app: requirements, the uiTx SDK API and response shapes, and the edit format. Call this before create_mini_app or update_mini_app.",
    },
    async () => ({ content: [{ type: "text" as const, text: miniAppGuide() }] })
  );

  server.registerTool(
    "list_mini_apps",
    {
      description:
        "List mini apps (id, name, description, icon, colour, URL to open it in the web UI). Archived apps are left out unless includeArchived is set.",
      inputSchema: { includeArchived: z.boolean().optional() },
    },
    wrap(async ({ includeArchived }: { includeArchived?: boolean }) =>
      (await listMiniAppsForOrg(LOCAL_ORG_ID))
        .filter((app) => includeArchived || app.archivedAt === null)
        .map((app) => summary(app))
    )
  );

  server.registerTool(
    "get_mini_app",
    {
      description: "Get one mini app with its full HTML code. Use the code for anchors before update_mini_app edits.",
      inputSchema: { id: z.string() },
    },
    wrap(async ({ id }: { id: string }) => {
      const { messages: _messages, ...app } = await getApp(id);
      return { ...app, url: appUrl(app.id) };
    })
  );

  server.registerTool(
    "create_mini_app",
    {
      description:
        "Create a mini app from complete HTML code. Read get_mini_app_guide first. " +
        "The code is validated (HTML, inline JS and CSS); invalid code is not saved. Returns the URL to open it.",
      inputSchema: { name: z.string().min(1), code: z.string().min(1), ...metadata },
    },
    wrap(async (args: { name: string; code: string; description?: string; icon?: string; color?: string }) => {
      const warnings = checkCode(args.code);
      const app = await createMiniApp({ orgId: LOCAL_ORG_ID, userId: LOCAL_USER_ID, ...args });
      return summary(app, warnings);
    })
  );

  server.registerTool(
    "update_mini_app",
    {
      description:
        "Edit a mini app: anchor-based code edits (preferred), or a full code replacement, and/or name, description, icon, colour. " +
        "Set archived to archive the app (hidden from the app lists, still openable) or false to restore it. " +
        "Read get_mini_app_guide for the edit format and get_mini_app for the current code. " +
        "All edits must apply and the result must validate, otherwise nothing is saved.",
      inputSchema: {
        id: z.string(),
        edits: z.array(editOp).optional(),
        code: z.string().optional().describe("Complete new code; don't combine with edits"),
        name: z.string().min(1).optional(),
        archived: z.boolean().optional(),
        ...metadata,
      },
    },
    wrap(
      async ({
        id,
        edits,
        code,
        ...fields
      }: { id: string; edits?: z.infer<typeof editOp>[]; code?: string } & Omit<UpdateMiniAppParams, "code">) => {
        if (edits?.length && code !== undefined) throw new Error("Pass either edits or code, not both");
        const app = await getApp(id);

        let nextCode = code;
        if (edits?.length) {
          // applyEdits checks the per-type fields (e.g. delete needs "old")
          const result = applyEdits(app.code, edits as EditOp[]);
          if (result.failures.length) {
            throw new Error(
              `Code not saved, ${result.failures.length} edit(s) failed:\n` +
                result.failures.map((f) => `- ${f.error}: anchor ${JSON.stringify(f.edit.anchor)}`).join("\n")
            );
          }
          nextCode = result.code;
        }
        const warnings = nextCode !== undefined ? checkCode(nextCode) : [];

        const updated = await updateMiniAppForOrg(LOCAL_ORG_ID, id, { ...fields, code: nextCode });
        if (!updated) throw new Error(`Mini app not found: ${id}`);
        return summary(updated, warnings);
      }
    )
  );
}
