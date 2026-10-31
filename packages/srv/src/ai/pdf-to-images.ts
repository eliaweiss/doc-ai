/**
 * doc-ai: model middleware that turns PDF parts into one PNG per page.
 *
 * The pipeline sends PDFs to the model as files, which Gemini, OpenAI, Claude
 * and OpenRouter read natively. Local vision models (Ollama, llama-server) only
 * take images, so for them each PDF is rendered with pdf.js first.
 */
import type { LanguageModelMiddleware } from "ai";
import { createCanvas } from "@napi-rs/canvas";
import { createRequire } from "module";
import path from "path";

/** Longest side of a rendered page: enough for small print without blowing up the context */
const MAX_SIDE_PX = 1600;
/** Pages past this are dropped (the pipeline splits long documents into pages itself) */
const MAX_PAGES = 8;
/** The 14 standard PDF fonts, for PDFs that use them without embedding */
const STANDARD_FONTS_DIR =
  path.join(path.dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "standard_fonts") + path.sep;

function toBytes(data: string | Uint8Array | URL): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof URL) throw new Error("PDF parts given as URLs are not supported for local models");
  const base64 = data.startsWith("data:") ? data.slice(data.indexOf(",") + 1) : data;
  return new Uint8Array(Buffer.from(base64, "base64"));
}

export async function renderPdfPages(pdf: Uint8Array): Promise<Uint8Array[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // pdf.js takes ownership of the buffer, so give it a copy
  const task = pdfjs.getDocument({ data: pdf.slice(), disableFontFace: true, standardFontDataUrl: STANDARD_FONTS_DIR });
  const doc = await task.promise;
  try {
    const pages: Uint8Array[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(3, MAX_SIDE_PX / Math.max(base.width, base.height)) });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas: canvas as any, canvasContext: context as any, viewport }).promise;
      pages.push(new Uint8Array(canvas.toBuffer("image/png")));
      page.cleanup();
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

type Prompt = Parameters<NonNullable<LanguageModelMiddleware["transformParams"]>>[0]["params"]["prompt"];

async function rasterizePrompt(prompt: Prompt): Promise<Prompt> {
  return Promise.all(
    prompt.map(async (message) => {
      if (message.role !== "user") return message;
      const content = [];
      for (const part of message.content) {
        if (part.type === "file" && part.mediaType === "application/pdf") {
          for (const png of await renderPdfPages(toBytes(part.data))) {
            content.push({ type: "file" as const, mediaType: "image/png", data: png });
          }
        } else {
          content.push(part);
        }
      }
      return { ...message, content };
    })
  );
}

export const pdfToImagesMiddleware: LanguageModelMiddleware = {
  middlewareVersion: "v2",
  transformParams: async ({ params }) => ({ ...params, prompt: await rasterizePrompt(params.prompt) }),
};
