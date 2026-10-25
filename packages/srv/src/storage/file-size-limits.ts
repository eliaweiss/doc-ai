import { DOCUMENT_LIMITS } from "@zdocs/types";

export class FileSizeLimitError extends Error {
  statusCode = 413;

  constructor(fileSizeBytes: number) {
    super(
      `File size ${formatFileSize(fileSizeBytes)} exceeds the ${formatFileSize(
        DOCUMENT_LIMITS.maxFileSizeBytes
      )} upload limit`
    );
    this.name = "FileSizeLimitError";
  }
}

export function validateDocumentFileSize(fileSizeBytes: number): void {
  if (fileSizeBytes > DOCUMENT_LIMITS.maxFileSizeBytes) {
    throw new FileSizeLimitError(fileSizeBytes);
  }
}

export function validateDocumentFileSizeAndPageCount(params: {
  fileSizeBytes: number;
  pageCount: number;
}): void {
  const { fileSizeBytes, pageCount } = params;
  validateDocumentFileSize(fileSizeBytes);

  if (
    fileSizeBytes > DOCUMENT_LIMITS.maxMultiPageFileSizeBytes &&
    pageCount > DOCUMENT_LIMITS.maxPagesForLargeFile
  ) {
    throw new FileSizeLimitError(fileSizeBytes);
  }
}

function formatFileSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
