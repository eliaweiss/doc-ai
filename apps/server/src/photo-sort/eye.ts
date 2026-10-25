/**
 * Eye (Desert Ant Labs) photo classifier, run in this process through the
 * package's native core (Core ML on macOS, LiteRT on Linux).
 *
 * - The model is loaded once per process and reused; the first load downloads
 *   it into `<data dir>/cache/eye`, later starts read it from there.
 * - Results are cached per file (path + size + mtime) in `<data dir>/cache/eye/results.json`,
 *   so scanning the same folder again only analyzes new or changed photos.
 *
 * Only the "photo" part runs: it gives the photo type (receipt, document,
 * screenshot, ...), which is all sorting needs.
 */
import { promises as fs, readFileSync } from "fs";
import path from "path";
import sharp from "sharp";
import { getCacheDir } from "@zdocs/srv";

/** Image formats Eye gets (decoded by sharp). PDFs come later, rasterized to a photo. */
export const PHOTO_EXTENSIONS = new Set(["jpg", "jpeg", "jfif", "png", "gif", "webp", "tiff", "tif"]);

/** Photos are scaled to this long side before analysis, like eye-photo-sorter */
const MAX_SIDE = 1024;

export type PhotoCategory = "receipt" | "document" | "screenshot" | "other";

export interface PhotoClassification {
  category: PhotoCategory;
  /** Eye's most likely photo type: "receipt", "document", "whiteboard", "photo", ... */
  kind: string | null;
  /** Probability of `kind` */
  confidence: number;
}

/** Same rules as eye-photo-sorter's categories */
function categorize(kind: string | null, has: (tag: string) => boolean): PhotoCategory {
  if (kind === "receipt" || has("receipt")) return "receipt";
  if (["document", "whiteboard", "id_card"].some((t) => kind === t || has(t))) return "document";
  if (kind === "screenshot" || has("screenshot")) return "screenshot";
  return "other";
}

type EyeInstance = {
  analyze(
    image: { data: Uint8Array; width: number; height: number },
    options?: { parts?: string[] }
  ): Promise<{
    kind: string | null;
    has(tag: string): boolean;
    details: { photo: { type: Record<string, number> } | null } | null;
  }>;
};

let eyePromise: Promise<EyeInstance> | null = null;

function eyeCacheDir() {
  return path.join(getCacheDir(), "eye");
}

/** The process-wide Eye model, loaded (and downloaded on first use) once. */
export function getEye(): Promise<EyeInstance> {
  if (!eyePromise) {
    eyePromise = (async () => {
      const started = Date.now();
      // Server-only entry: the prebuilt native core, not the browser Wasm build
      const { Eye } = await import("@desert-ant-labs/eye/native");
      const cacheRoot = eyeCacheDir();
      await fs.mkdir(cacheRoot, { recursive: true });
      const eye = (await Eye.load({ cacheRoot })) as unknown as EyeInstance;
      console.log(`[Eye] Model ready in ${Date.now() - started} ms (cache: ${cacheRoot})`);
      return eye;
    })().catch((error) => {
      eyePromise = null; // let the next call retry (e.g. after a failed download)
      throw error;
    });
  }
  return eyePromise;
}

export function isEyeLoaded(): boolean {
  return eyePromise !== null;
}

// ---- per-file result cache ----

let results: Map<string, PhotoClassification> | null = null;
let saveTimer: NodeJS.Timeout | null = null;

function resultsPath() {
  return path.join(eyeCacheDir(), "results.json");
}

function loadResults(): Map<string, PhotoClassification> {
  if (!results) {
    try {
      results = new Map(Object.entries(JSON.parse(readFileSync(resultsPath(), "utf8"))));
    } catch {
      results = new Map();
    }
  }
  return results;
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      await fs.mkdir(eyeCacheDir(), { recursive: true });
      await fs.writeFile(resultsPath(), JSON.stringify(Object.fromEntries(loadResults())));
    } catch (error) {
      console.error("[Eye] Failed to save result cache:", error);
    }
  }, 2000);
}

const cacheKey = (absPath: string, size: number, mtimeMs: number) => `${absPath}|${size}|${Math.round(mtimeMs)}`;

export function getCachedClassification(absPath: string, size: number, mtimeMs: number) {
  return loadResults().get(cacheKey(absPath, size, mtimeMs)) ?? null;
}

/** Classify one photo. `buffer` is the file's bytes (already read by the caller). */
export async function classifyPhoto(
  absPath: string,
  buffer: Buffer,
  stat: { size: number; mtimeMs: number }
): Promise<PhotoClassification> {
  const cached = getCachedClassification(absPath, stat.size, stat.mtimeMs);
  if (cached) return cached;

  const { data, info } = await sharp(buffer, { failOn: "none" })
    .rotate() // upright, from EXIF orientation
    .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const eye = await getEye();
  const analysis = await eye.analyze(
    { data: new Uint8Array(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height },
    { parts: ["photo"] }
  );
  const kind = analysis.kind ?? null;
  const result: PhotoClassification = {
    category: categorize(kind, (t) => analysis.has(t)),
    kind,
    confidence: kind ? analysis.details?.photo?.type[kind] ?? 0 : 0,
  };
  loadResults().set(cacheKey(absPath, stat.size, stat.mtimeMs), result);
  scheduleSave();
  return result;
}

/** Small JPEG preview for the selection list */
export async function makeThumbnail(absPath: string, size = 240): Promise<Buffer> {
  return sharp(absPath, { failOn: "none" })
    .rotate()
    .resize(size, size, { fit: "cover" })
    .jpeg({ quality: 70 })
    .toBuffer();
}
