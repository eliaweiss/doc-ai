/**
 * Read-only export of indexed documents (DB rows + original files from S3) from a
 * zdocs database, for import-zdocs-export.ts. Uses zdocs' node_modules.
 *
 *   set -a; source ~/work/zdocs/.env.1flow; set +a
 *   ZDOCS_ORG_ID=<org id> node scripts/export-from-zdocs.cjs <outDir> <manifest.json>
 */
const { createRequire } = require("module");
const path = require("path");
const zreq = createRequire(path.join(process.env.ZDOCS_DIR || path.join(require("os").homedir(), "work/zdocs"), "package.json"));
const postgres = zreq("postgres");
const { S3Client, GetObjectCommand } = zreq("@aws-sdk/client-s3");
const fs = require("fs");
const crypto = require("crypto");

const ORG_ID = process.env.ZDOCS_ORG_ID;
if (!ORG_ID) throw new Error("ZDOCS_ORG_ID is not set");
const PER_TYPE = Number(process.env.PER_TYPE || 3);
const TYPES = ["INVOICE", "RECEIPT", "BANK_STATEMENT", "CREDIT_CARD_STATEMENT", "PAYSLIP", "TAX_FORM",
  "REMITTANCE", "FOREIGN_EXCHANGE_CONTRACT", "INVESTMENT_STATEMENT", "PURCHASE_ORDER", "CONTRACT",
  "EXPENSE_REPORT", "QUOTE", "SUMMARY_OF_BILLING", "ACCOUNTING_LEDGER"];
const CONTENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "text/csv"];
const [watchDir, manifestPath] = process.argv.slice(2);

const sql = postgres(process.env.DATABASE_URL, {
  connection: { default_transaction_read_only: "on", application_name: "doc-ai-export" }, max: 1,
});
const s3 = new S3Client({ region: process.env.S3_REGION || process.env.AWS_REGION });

const safe = (s) => String(s || "document").replace(/[\/\\:*?"<>|\x00-\x1f]/g, "_").slice(0, 120);

(async () => {
  const docs = await sql`
    select * from (
      select d.*, row_number() over (partition by d.doc_type order by d.created_at desc) rn
      from documents d
      where d.org_id = ${ORG_ID} and d.deleted_at is null and d.extraction_status = 'INDEXED'
        and d.doc_type in ${sql(TYPES)} and d.content_type in ${sql(CONTENT_TYPES)}
        and coalesce(d.page_count, 1) <= 15
    ) x where rn <= ${PER_TYPE} order by doc_type, created_at desc`;
  const ids = docs.map((d) => d.id);
  const data = ids.length ? await sql`select * from document_data where document_id in ${sql(ids)}` : [];
  const dataByDoc = Object.fromEntries(data.map((r) => [r.document_id, r]));

  const out = [];
  for (const d of docs) {
    const ext = (d.file_extension || d.content_type.split("/")[1]).toLowerCase().replace("jpeg", "jpg");
    let rel = path.join(d.doc_type, `${safe(d.file_name)}.${ext}`);
    for (let i = 1; out.some((o) => o.rel === rel); i++) rel = path.join(d.doc_type, `${safe(d.file_name)} (${i}).${ext}`);
    try {
      const obj = await s3.send(new GetObjectCommand({ Bucket: d.s3_bucket, Key: d.s3_key }));
      const buf = Buffer.from(await obj.Body.transformToByteArray());
      fs.mkdirSync(path.join(watchDir, d.doc_type), { recursive: true });
      fs.writeFileSync(path.join(watchDir, rel), buf);
      const md5 = crypto.createHash("md5").update(buf).digest("hex");
      delete d.rn;
      out.push({ rel, md5, document: d, data: dataByDoc[d.id] || null });
      console.log(`ok   ${rel} (${buf.length} bytes)`);
    } catch (e) {
      console.log(`skip ${d.id} ${d.doc_type}: ${e.name || e.message}`);
    }
  }
  fs.writeFileSync(manifestPath, JSON.stringify(out));
  console.log(`exported ${out.length} documents`);
  await sql.end();
})().catch((e) => { console.error(e); process.exit(1); });
