export function wrapCsvContent(filename: string, content: string): string {
  return `<csv-txt filename="${filename}">\n${content}\n</csv-txt>`;
}

export function stripCsvTags(text: string): string {
  // Matches <csv-txt filename="...">...</csv-txt> globally, including multi-line content
  const csvTagRegex = /<csv-txt\s+filename="[^"]*">[\s\S]*?<\/csv-txt>/g;
  return text.replace(csvTagRegex, "").trim();
}

export interface CsvAttachment {
  filename: string;
}

export function extractCsvAttachments(text: string): CsvAttachment[] {
  const attachments: CsvAttachment[] = [];
  // Regex to find filename attribute in opening tags
  const openingTagRegex = /<csv-txt\s+filename="([^"]*)">/g;
  
  let match;
  while ((match = openingTagRegex.exec(text)) !== null) {
    attachments.push({ filename: match[1] });
  }
  
  return attachments;
}

