export interface SplitCsvVirtualPagesParams {
  /** Logical CSV records (no `#N,` prefix), in order. A record may contain newlines inside quotes. */
  lines: string[];
  /** 1-indexed record number of the table header row in `lines` */
  tableStartLine: number;
  /** 1-indexed record number of the last data row in `lines` */
  tableEndLine: number;
  /** Maximum number of data rows per virtual page */
  rowsPerPage: number;
}

export interface SplitCsvVirtualPagesResult {
  /** The header row text as it appears in the original CSV */
  headerLine: string;
  /** The total number of data rows actually used (after clamping to bounds) */
  totalDataRows: number;
  /** Each virtual page is the header row + a chunk of data rows, joined by `\n` */
  virtualPages: string[];
}

/**
 * Split CSV data rows into "virtual pages" of `rowsPerPage` rows each, with
 * the table header row prepended at the top of every page. This gives each
 * AI call a self-contained CSV chunk with column headers + a slice of data.
 *
 * `tableStartLine` and `tableEndLine` are 1-indexed logical record numbers
 * (matching the `#N,` scheme used in `preprocessCsvTable`).
 */
export function splitCsvVirtualPages(
  params: SplitCsvVirtualPagesParams
): SplitCsvVirtualPagesResult {
  const { lines, tableStartLine, tableEndLine, rowsPerPage } = params;

  if (rowsPerPage <= 0) {
    throw new Error(
      `splitCsvVirtualPages: rowsPerPage must be > 0, got ${rowsPerPage}`
    );
  }

  // Convert 1-indexed lines to 0-indexed array positions and clamp.
  const headerIdx = Math.max(0, Math.min(lines.length - 1, tableStartLine - 1));
  const dataStartIdx = headerIdx + 1;
  const dataEndIdx = Math.max(
    dataStartIdx,
    Math.min(lines.length, tableEndLine)
  );

  const headerLine = lines[headerIdx] ?? "";
  const dataRows = lines.slice(dataStartIdx, dataEndIdx);

  const virtualPages: string[] = [];
  for (let i = 0; i < dataRows.length; i += rowsPerPage) {
    const chunk = dataRows.slice(i, i + rowsPerPage);
    virtualPages.push([headerLine, ...chunk].join("\n"));
  }

  return {
    headerLine,
    totalDataRows: dataRows.length,
    virtualPages,
  };
}
