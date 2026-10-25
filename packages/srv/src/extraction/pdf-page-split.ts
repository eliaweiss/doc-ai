import { PDFDocument } from "pdf-lib";

/**
 * Returns the number of pages in a PDF buffer.
 * Lightweight - only loads metadata, does not split or render.
 *
 * @param pdfBuffer - PDF file buffer
 * @returns Number of pages
 */
export async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  const pdf = await PDFDocument.load(new Uint8Array(pdfBuffer), {
    updateMetadata: false,
  });
  return pdf.getPageCount();
}

/**
 * Splits a PDF buffer into individual single-page PDFs as base64 data URLs.
 * Works in both Lambda and Vercel environments (no file system or native dependencies).
 *
 * Uses pdf-lib (pure JavaScript) to extract each page as a standalone PDF document.
 * Gemini Vision handles PDF data URLs natively, so no image rendering is needed.
 *
 * @param pdfBuffer - PDF file buffer from S3
 * @returns Array of data URLs, one per page (format: `data:application/pdf;base64,...`)
 * @throws Error if PDF cannot be loaded or processed
 */
/**
 * Extracts the first page and last N pages from a PDF into a single combined PDF data URL.
 * Useful for header extraction where relevant info is on the first and last pages
 * (e.g., account info on page 1, closing balance/totals on last pages).
 *
 * If the PDF has 3 or fewer pages, returns the full document as-is.
 * Deduplicates pages (e.g., for a 4-page PDF with lastPages=2, returns pages [0, 2, 3]).
 *
 * @param pdfBuffer - PDF file buffer
 * @param lastPages - Number of pages from the end to include (default: 2)
 * @returns A data URL of the combined PDF (`data:application/pdf;base64,...`)
 */
export async function extractHeaderPages(
  pdfBuffer: Buffer,
  lastPages: number = 2
): Promise<string> {
  console.log(`[extractHeaderPages] Splitting PDF into header pages, lastPages: ${lastPages}`);
  const sourcePdf = await PDFDocument.load(new Uint8Array(pdfBuffer));
  const pageCount = sourcePdf.getPageCount();

  // If small enough, just return the whole document
  if (pageCount <= lastPages + 1) {
    const base64 = pdfBuffer.toString("base64");
    return `data:application/pdf;base64,${base64}`;
  }

  // Collect unique page indices: first page + last N pages
  const pageIndices = new Set<number>();
  pageIndices.add(0); // first page
  for (let i = pageCount - lastPages; i < pageCount; i++) {
    pageIndices.add(i);
  }

  // Build a new PDF with just these pages (in order)
  const combinedPdf = await PDFDocument.create();
  const sortedIndices = Array.from(pageIndices).sort((a, b) => a - b);
  const copiedPages = await combinedPdf.copyPages(sourcePdf, sortedIndices);
  for (const page of copiedPages) {
    combinedPdf.addPage(page);
  }

  const pdfBytes = await combinedPdf.save();
  const base64 = Buffer.from(pdfBytes).toString("base64");
  return `data:application/pdf;base64,${base64}`;
}

export async function splitPdfToPageDataUrls(
  pdfBuffer: Buffer
): Promise<string[]> {
  const sourcePdf = await PDFDocument.load(new Uint8Array(pdfBuffer));
  const pageCount = sourcePdf.getPageCount();
  const pageDataUrls: string[] = [];

  for (let i = 0; i < pageCount; i++) {
    // Create a new single-page PDF document
    const singlePagePdf = await PDFDocument.create();
    const [copiedPage] = await singlePagePdf.copyPages(sourcePdf, [i]);
    singlePagePdf.addPage(copiedPage);

    // Serialize to bytes and convert to base64 data URL
    const pdfBytes = await singlePagePdf.save();
    const base64 = Buffer.from(pdfBytes).toString("base64");
    pageDataUrls.push(`data:application/pdf;base64,${base64}`);
  }

  return pageDataUrls;
}
