/**
 * Split CSV/text into logical records using RFC 4180 quoting rules.
 *
 * This does not interpret columns or a schema. It only decides where one
 * record ends and the next begins: a newline (or CR) inside a quoted field
 * stays in the same record; `""` is an escaped quote.
 *
 * Unclosed quotes at EOF keep the remainder as a single record so we never
 * invent a split the file did not make.
 */
export function splitCsvRecords(text: string): string[] {
  if (!text) return [];

  const records: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      current += char;
      if (char === '"') {
        if (text[i + 1] === '"') {
          current += text[i + 1];
          i += 1;
        } else {
          inQuotes = false;
        }
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      current += char;
      continue;
    }

    if (char === "\r") {
      if (text[i + 1] === "\n") {
        i += 1;
      }
      records.push(current);
      current = "";
      continue;
    }

    if (char === "\n") {
      records.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (inQuotes || current.length > 0) {
    records.push(current);
  }

  return records;
}
