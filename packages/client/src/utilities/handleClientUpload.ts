import SparkMD5 from "spark-md5";
import useOrgStore from "../context-providers/orgStore";
import { useUploadStore } from "../context-providers/uploadStore";
import { zFetch } from "../lib/utils";

interface UploadOptions {
  isTest?: boolean;
  folderId?: string | null;
  processingMode?: "DEFAULT" | "DATA_SOURCE_FILE";
}

// Calculate MD5 hash of a file using chunked reading (efficient for large files)
async function calculateMD5(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunkSize = 2097152; // 2MB chunks
    const spark = new SparkMD5.ArrayBuffer();
    const fileReader = new FileReader();
    let currentChunk = 0;
    const chunks = Math.ceil(file.size / chunkSize);

    fileReader.onload = (e) => {
      spark.append(e.target?.result as ArrayBuffer);
      currentChunk++;
      if (currentChunk < chunks) {
        loadNext();
      } else {
        resolve(spark.end());
      }
    };

    fileReader.onerror = () => reject(new Error("Failed to read file for MD5"));

    function loadNext() {
      const start = currentChunk * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      fileReader.readAsArrayBuffer(file.slice(start, end));
    }

    loadNext();
  });
}

// Upload file using XMLHttpRequest for progress tracking
async function uploadWithProgress(
  uploadUrl: string,
  file: File,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status: ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Upload failed"));
    });

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}

// AWS S3 client upload with progress tracking
export async function handleClientUpload(
  file: File,
  options: UploadOptions = {}
): Promise<{ url: string; documentId?: string }> {
  const { isTest = false, folderId = null } = options;
  const { org } = useOrgStore.getState();
  const uploadStore = useUploadStore.getState();

  // Register upload in the store
  const uploadId = uploadStore.addUpload(file);

  try {
    // Calculate MD5 hash before upload
    const md5Hash = await calculateMD5(file);

    // Get the pre-signed URL from your backend
    const { uploadUrl, documentId } = await zFetch("/api/uploads/aws", {
      method: "POST",
      body: {
        contentType: file.type,
        orgId: org?.id,
        fileName: file.name,
        fileSizeBytes: file.size,
        md5Hash,
        isTest,
        folderId,
      },
    });

    if (uploadUrl) {
      // Upload directly to S3 using XMLHttpRequest for progress tracking
      await uploadWithProgress(uploadUrl, file, (progress) => {
        uploadStore.updateUploadProgress(uploadId, progress);
      });
    }

    // Mark upload as complete and start processing phase
    uploadStore.setUploadComplete(uploadId, documentId);

    const { url } = await zFetch(
      `/api/uploads/${documentId}/complete`,
      {
        method: "POST",
        body: {
          uploadComplete: true,
          processingMode: options?.processingMode,
        },
      }
    );

    // Mark as fully complete
    uploadStore.setComplete(uploadId);

    console.log("handleClientUpload url", url);
    return { url, documentId };
  } catch (error) {
    // Mark as failed in store
    uploadStore.setFailed(
      uploadId,
      error instanceof Error ? error.message : "Upload failed"
    );
    throw error;
  }
}

export const DropAccept = {
  none: null,
  images: {
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg", ".jfif"],
    "image/webp": [".webp"],
    "image/svg+xml": [".svg"],
  },
  documents: {
    "application/pdf": [".pdf"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
      ".xlsx",
    ],
    "application/vnd.ms-excel.sheet.macroEnabled.12": [".xlsm"],
    "application/vnd.ms-excel": [".xls"],
    "text/csv": [".csv"],
  },
  /** @deprecated Dataset pipeline disabled - spreadsheet types are now in documents */
  datasets: {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
      ".xlsx",
    ],
    "application/vnd.ms-excel.sheet.macroEnabled.12": [".xlsm"],
    "application/vnd.ms-excel": [".xls"],
    "text/csv": [".csv"],
  },
};



// coupled with cloudinary folder name:
// "image" used for images
// "video" used for audios and videos
export function getAssetType(dropAccept: any) {
  if (dropAccept === DropAccept.images) return "image";
  return null;
}

export class RequestEntityTooLarge413Error extends Error {
  status: number;
  statusText: string;
  constructor(status: number, statusText: string) {
    super(`Upload failed with status: ${status} ${statusText}`);
    this.name = "RequestEntityTooLarge413Error";
    this.status = status;
    this.statusText = statusText;
  }
}
