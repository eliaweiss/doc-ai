import { QueueJobStatus } from "./Queue";

export interface OcrResultPtr {
    s3Path: string;
    bucket: string;
    region: string;
}


export interface OcrResult extends OcrResultPtr {
    text: string;
}

export interface OcrJobResult {
    status: QueueJobStatus;
    text: string | null;
}
