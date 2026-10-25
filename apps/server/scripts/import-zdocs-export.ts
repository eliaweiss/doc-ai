/**
 * Import documents exported from a zdocs database (already classified and
 * extracted) into the local doc-ai DB, without re-running AI.
 *
 * Input: a manifest JSON of { rel, md5, document, data } rows (snake_case
 * columns as returned by postgres) and a folder with the files at `rel`.
 * Files are copied into DOC_AI_WATCH_DIR at the same relative path, so the
 * watcher later sees a known hash and leaves them alone.
 *
 * Run with the doc-ai server stopped (PGlite is single-process):
 *   npx tsx --env-file=../../.env scripts/import-zdocs-export.ts <manifest.json> <filesDir>
 */
import { promises as fs } from "fs";
import path from "path";
import { LOCAL_ORG_ID, closeDatabase, indexDocument, pgliteClient } from "@zdocs/db-schema";
import { getConfig } from "@zdocs/srv";
import { initDatabase } from "../src/db";

interface ManifestEntry {
  rel: string;
  md5: string;
  document: Record<string, unknown>;
  data: Record<string, unknown> | null;
}

async function main() {
  const [manifestPath, filesDir] = process.argv.slice(2);
  if (!manifestPath || !filesDir) throw new Error("usage: import-zdocs-export.ts <manifest.json> <filesDir>");
  const { watchDir } = getConfig();
  if (!watchDir) throw new Error("DOC_AI_WATCH_DIR is not set");

  const { rootFolder } = await initDatabase();
  const entries: ManifestEntry[] = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  let imported = 0;

  for (const { rel, md5, document, data } of entries) {
    const target = path.join(watchDir, rel);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(path.join(filesDir, rel), target);

    const doc = {
      ...document,
      org_id: LOCAL_ORG_ID,
      folder_id: rootFolder.id,
      s3_key: rel,
      s3_bucket: "local",
      s3_region: "local",
      content_hash: md5,
      institution_id: null, // institutions are not imported
      ocr_result_ptr: null,
      metadata: {
        ...((document.metadata as Record<string, unknown> | null) ?? {}),
        sourcePath: rel,
        importedFrom: { orgId: document.org_id, documentId: document.id },
      },
    };

    // json_populate_record converts every column type (jsonb, arrays, timestamps, numeric)
    const inserted = await pgliteClient.query(
      `INSERT INTO documents SELECT * FROM json_populate_record(null::documents, $1::json)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [JSON.stringify(doc)]
    );
    if (inserted.rows.length === 0) {
      console.log(`exists ${rel}`);
      continue;
    }
    if (data) {
      await pgliteClient.query(
        `INSERT INTO document_data SELECT * FROM json_populate_record(null::document_data, $1::json)
         ON CONFLICT (id) DO NOTHING`,
        [JSON.stringify({ ...data, org_id: LOCAL_ORG_ID })]
      );
    }
    await indexDocument(document.id as string, LOCAL_ORG_ID);
    imported++;
    console.log(`ok     ${rel}`);
  }

  console.log(`Imported ${imported} of ${entries.length} documents`);
  await closeDatabase();
}

main().catch(async (error) => {
  console.error(error);
  await closeDatabase().catch(() => {});
  process.exit(1);
});
