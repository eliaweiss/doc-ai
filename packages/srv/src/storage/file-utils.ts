import { Readable } from "stream";
import { getPdfPageCount } from "../extraction/pdf-page-split";
import {
  validateDocumentFileSize,
  validateDocumentFileSizeAndPageCount,
} from "./file-size-limits";

/**
 * Extract file name and extension from a file name and content type
 * @param fileName - The file name (can be null)
 * @param contentType - The content type (e.g., "application/pdf")
 * @returns Object with baseFileName and fileExtension
 */
export function extractFileNameAndExtension(
  fileName: string | null,
  contentType: string
): { baseFileName: string | null; fileExtension: string | null } {
  let baseFileName = fileName || null;
  let fileExtension = contentType.split("/")[1]?.split("+")[0] || null;

  if (fileName) {
    const lastDotIndex = fileName.lastIndexOf(".");
    if (lastDotIndex > 0) {
      baseFileName = fileName.substring(0, lastDotIndex);
      fileExtension = fileName.substring(lastDotIndex + 1);
    }
  }

  if (fileExtension?.toLowerCase() === "jfif") {
    fileExtension = "jpeg";
  }

  return { baseFileName, fileExtension };
}

/**
 * Parse file from webhook request (supports multipart/form-data and JSON with base64)
 * @param req - Standard Web API Request object (compatible with NextRequest)
 * @returns Object with fileBuffer, fileName, contentType, and any extra params from body
 */
export async function parseWebhookFile(
  req: Request
): Promise<{ fileBuffer: Buffer; fileName: string | null; contentType: string; [key: string]: unknown }> {
  const contentTypeHeader = req.headers.get("content-type");

  if (contentTypeHeader?.includes("multipart/form-data")) {
    // Handle multipart/form-data upload
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw new Error("Missing file in form data");
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await validateDocumentUploadSize(fileBuffer, file.type || "application/octet-stream");
    const fileName = file.name;
    const contentType = file.type || "application/octet-stream";

    // Extract extra params from formData (excluding the file field)
    const extraParams: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      if (key !== "file") {
        extraParams[key] = value;
      }
    }

    return { fileBuffer, fileName, contentType, ...extraParams };
  } else {
    // Handle JSON body with base64 file
    const body = await req.json();
    const { file: bodyFile, fileName: bodyFileName, contentType: bodyContentType, ...rest } = body;

    if (!bodyFile) {
      throw new Error("Missing file in request body");
    }

    // Decode base64 file
    const base64Data = bodyFile.replace(/^data:.*,/, ""); // Remove data URL prefix if present
    validateDocumentFileSize(Math.floor((base64Data.length * 3) / 4));
    const fileBuffer = Buffer.from(base64Data, "base64");
    const fileName = bodyFileName || null;
    const contentType = bodyContentType || "application/octet-stream";
    await validateDocumentUploadSize(fileBuffer, contentType);

    return { fileBuffer, fileName, contentType, ...rest };
  }
}

/**
 * Convert a readable stream to a buffer
 * @param stream - The readable stream
 * @returns Promise that resolves to a Buffer
 */
export async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", (err) => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * Get content type from file extension
 * @param filename - The file name with extension
 * @returns MIME type string, or "application/octet-stream" if unknown
 */
export function getContentTypeFromExtension(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    jfif: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    tiff: "image/tiff",
    tif: "image/tiff",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
    csv: "text/csv",
  };
  return mimeTypes[ext || ""] || "application/octet-stream";
}

/**
 * Check if a string is a valid HTTP/HTTPS URL
 * @param str - The string to check
 * @returns true if the string is a valid HTTP/HTTPS URL
 */
export function isUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Fetch file from URL and extract metadata (filename, content type)
 * @param url - The URL to fetch the file from
 * @returns Object with fileBuffer, fileName, and contentType
 * @throws Error if the fetch fails or content type cannot be determined
 */
export async function fetchFileFromUrl(url: string): Promise<{
  fileBuffer: Buffer;
  fileName: string | null;
  contentType: string;
}> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch file from URL: ${response.status} ${response.statusText}`);
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const contentLengthBytes = Number(contentLength);
    if (Number.isFinite(contentLengthBytes)) {
      validateDocumentFileSize(contentLengthBytes);
    }
  }
  const fileBuffer = Buffer.from(await response.arrayBuffer());
  await validateDocumentUploadSize(fileBuffer, response.headers.get("content-type"));
  
  // Extract filename from Content-Disposition header or URL
  let fileName: string | null = null;
  const contentDisposition = response.headers.get("content-disposition");
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (filenameMatch && filenameMatch[1]) {
      fileName = filenameMatch[1].replace(/['"]/g, "");
    }
  }
  
  // If no filename from header, try to extract from URL
  if (!fileName) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const lastSlash = pathname.lastIndexOf("/");
      if (lastSlash >= 0 && lastSlash < pathname.length - 1) {
        fileName = pathname.substring(lastSlash + 1);
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

  // Get content type from response header
  let contentType = response.headers.get("content-type") || null;
  
  // If content type is missing but filename is available, infer from extension
  if (!contentType && fileName) {
    contentType = getContentTypeFromExtension(fileName);
  }

  // If still no content type, throw error
  if (!contentType || contentType === "application/octet-stream") {
    throw new Error(
      `Unable to determine content type for file. Please provide 'contentType' in the request body or ensure the URL response includes a Content-Type header.`
    );
  }

  return { fileBuffer, fileName, contentType };
}

export async function validateDocumentUploadSize(
  fileBuffer: Buffer,
  contentType: string | null | undefined
): Promise<void> {
  validateDocumentFileSize(fileBuffer.length);

  if (contentType?.split(";")[0]?.trim().toLowerCase() !== "application/pdf") {
    return;
  }

  const pageCount = await getPdfPageCount(fileBuffer);
  validateDocumentFileSizeAndPageCount({
    fileSizeBytes: fileBuffer.length,
    pageCount,
  });
}
