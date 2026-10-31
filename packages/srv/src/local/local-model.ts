/**
 * doc-ai: the built-in local model ("local" provider), without Ollama.
 *
 * doc-ai downloads llama.cpp's llama-server (a pinned release for this OS) and
 * Qwen 3.5 9B (Q4_K_M GGUF + its vision projector) into `<data dir>/models/`,
 * starts llama-server on a free localhost port when a document needs it, and
 * talks to it through its OpenAI-compatible API (@ai-sdk/openai-compatible).
 */
import { execFile, spawn, type ChildProcess } from "child_process";
import fs from "fs";
import net from "net";
import os from "os";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { promisify } from "util";
import { getDataDir } from "@zdocs/db-schema/data-dir";

const LLAMA_CPP_BUILD = "b11500";
const MODEL_REPO = "https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/resolve/main";
export const LOCAL_MODEL_ID = "qwen3.5-9b";
export const LOCAL_MODEL_LABEL = "Qwen 3.5 9B (Q4_K_M)";
/** Below this, the 9B model (about 7 GB in memory with the projector) is too slow or doesn't fit */
export const LOCAL_MODEL_MIN_RAM_GB = 16;

interface Part {
  name: string;
  url: string;
  /** Path of the downloaded file, relative to the models folder */
  file: string;
}

/** llama.cpp release asset for this machine, or null if there's no prebuilt one */
function serverAsset(): string | null {
  const { platform, arch } = process;
  const pick: Record<string, string | undefined> = {
    "darwin-arm64": "macos-arm64.tar.gz",
    "darwin-x64": "macos-x64.tar.gz",
    "linux-x64": "ubuntu-x64.tar.gz",
    "linux-arm64": "ubuntu-arm64.tar.gz",
    "win32-x64": "win-cpu-x64.zip",
    "win32-arm64": "win-cpu-arm64.zip",
  };
  const suffix = pick[`${platform}-${arch}`];
  return suffix ? `llama-${LLAMA_CPP_BUILD}-bin-${suffix}` : null;
}

function parts(): Part[] {
  const asset = serverAsset();
  return [
    ...(asset
      ? [
          {
            name: "llama-server",
            url: `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_CPP_BUILD}/${asset}`,
            file: path.join("llama.cpp", asset),
          },
        ]
      : []),
    { name: "model", url: `${MODEL_REPO}/Qwen3.5-9B-Q4_K_M.gguf`, file: path.join(LOCAL_MODEL_ID, "Qwen3.5-9B-Q4_K_M.gguf") },
    { name: "vision projector", url: `${MODEL_REPO}/mmproj-F16.gguf`, file: path.join(LOCAL_MODEL_ID, "mmproj-F16.gguf") },
  ];
}

const modelsDir = () => path.join(getDataDir(), "models");
const serverDir = () => path.join(modelsDir(), "llama.cpp", LLAMA_CPP_BUILD);
const exists = (file: string) => fs.existsSync(path.join(modelsDir(), file));
const isMissing = (part: Part) => (part.name === "llama-server" ? !findServerBinary() : !exists(part.file));

/** llama-server inside the extracted release, wherever the archive put it */
function findServerBinary(dir = serverDir()): string | null {
  const name = process.platform === "win32" ? "llama-server.exe" : "llama-server";
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === name) return full;
    if (entry.isDirectory()) {
      const found = findServerBinary(full);
      if (found) return found;
    }
  }
  return null;
}

type DownloadState = "idle" | "downloading" | "done" | "error" | "cancelled";

const download = {
  state: "idle" as DownloadState,
  part: null as string | null,
  bytesDone: 0,
  bytesTotal: 0,
  error: null as string | null,
  abort: null as AbortController | null,
};

let server: ChildProcess | null = null;
let starting: Promise<string> | null = null;
let serverLog = "";

export function getLocalModelStatus() {
  const all = parts();
  const missing = all.filter(isMissing);
  return {
    label: LOCAL_MODEL_LABEL,
    supported: serverAsset() !== null,
    platform: `${process.platform}-${process.arch}`,
    installed: missing.length === 0,
    missing: missing.map((p) => p.name),
    totalMemGB: Math.round(os.totalmem() / 1024 ** 3),
    minMemGB: LOCAL_MODEL_MIN_RAM_GB,
    download: {
      state: download.state,
      part: download.part,
      bytesDone: download.bytesDone,
      bytesTotal: download.bytesTotal,
      error: download.error,
    },
    running: server !== null,
  };
}

async function contentLength(url: string): Promise<number> {
  const response = await fetch(url, { method: "HEAD", redirect: "follow" });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return Number(response.headers.get("content-length") || 0);
}

/** Download to `<file>.part`, resuming a previous attempt, then rename. */
async function fetchPart(part: Part, signal: AbortSignal, onBytes: (n: number) => void) {
  const target = path.join(modelsDir(), part.file);
  const temp = `${target}.part`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const have = fs.existsSync(temp) ? fs.statSync(temp).size : 0;
  const response = await fetch(part.url, {
    redirect: "follow",
    signal,
    headers: have ? { Range: `bytes=${have}-` } : {},
  });
  if (!response.ok || !response.body) throw new Error(`Downloading the ${part.name} failed: HTTP ${response.status}`);
  const resumed = response.status === 206;
  onBytes(resumed ? have : 0);
  const body = Readable.fromWeb(response.body as any);
  body.on("data", (chunk: Buffer) => onBytes(chunk.length));
  await pipeline(body, fs.createWriteStream(temp, { flags: resumed ? "a" : "w" }));
  fs.renameSync(temp, target);
}

async function extractServer(archive: string) {
  const dir = serverDir();
  fs.mkdirSync(dir, { recursive: true });
  // bsdtar (macOS, Windows 10+) reads zip too; GNU tar handles the Linux .tar.gz
  await promisify(execFile)("tar", ["-xf", archive, "-C", dir]);
  if (!findServerBinary()) throw new Error("llama-server was not found in the downloaded llama.cpp release");
  fs.rmSync(archive, { force: true });
}

/** Start (or continue) downloading whatever is missing. Progress is in getLocalModelStatus(). */
export function startLocalModelDownload(): void {
  if (download.state === "downloading") return;
  if (!serverAsset()) {
    throw new Error(`There is no prebuilt llama.cpp for ${process.platform}-${process.arch}. Use Ollama instead.`);
  }
  // A llama.cpp archive left from a failed extraction is extracted without downloading again
  const todo = parts().filter(isMissing);
  const abort = new AbortController();
  Object.assign(download, { state: "downloading", part: null, bytesDone: 0, bytesTotal: 0, error: null, abort });

  (async () => {
    const sizes = await Promise.all(todo.map((p) => (exists(p.file) ? 0 : contentLength(p.url))));
    download.bytesTotal = sizes.reduce((a, b) => a + b, 0);
    let before = 0;
    for (const [i, part] of todo.entries()) {
      download.part = part.name;
      let partBytes = 0;
      if (!exists(part.file)) {
        await fetchPart(part, abort.signal, (n) => {
          partBytes += n;
          download.bytesDone = before + partBytes;
        });
      }
      before += sizes[i];
      if (part.name === "llama-server") await extractServer(path.join(modelsDir(), part.file));
    }
    Object.assign(download, { state: "done", part: null, abort: null });
  })().catch((error) => {
    const cancelled = abort.signal.aborted;
    Object.assign(download, {
      state: cancelled ? "cancelled" : "error",
      error: cancelled ? null : error instanceof Error ? error.message : String(error),
      abort: null,
    });
  });
}

export function cancelLocalModelDownload(): void {
  download.abort?.abort();
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

async function waitForHealth(port: number, child: ChildProcess) {
  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`llama-server exited (code ${child.exitCode}): ${serverLog.trim().split("\n").slice(-5).join(" | ")}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("llama-server did not become ready within 5 minutes");
}

/** Start llama-server if needed and return its OpenAI-compatible base URL. */
export function ensureLocalModelRunning(): Promise<string> {
  // One start shared by every caller (the worker processes documents in parallel)
  starting ??= startServer().catch((error) => {
    starting = null;
    throw error;
  });
  return starting;
}

async function startServer(): Promise<string> {
  const binary = findServerBinary();
  const model = path.join(modelsDir(), LOCAL_MODEL_ID, "Qwen3.5-9B-Q4_K_M.gguf");
  const mmproj = path.join(modelsDir(), LOCAL_MODEL_ID, "mmproj-F16.gguf");
  if (!binary || !fs.existsSync(model) || !fs.existsSync(mmproj)) {
    throw new Error("The local model isn't downloaded yet. Open Settings → Processing and run the AI setup.");
  }
  const port = await freePort();
  serverLog = "";
  const child = spawn(
    binary,
    [
      "--model", model,
      "--mmproj", mmproj,
      "--host", "127.0.0.1",
      "--port", String(port),
      "--ctx-size", "16384",
      "--jinja",
      // Answer directly: thinking makes extraction several times slower
      "--reasoning-budget", "0",
      "--no-webui",
    ],
    { cwd: path.dirname(binary), stdio: ["ignore", "pipe", "pipe"] }
  );
  const keepLog = (chunk: Buffer) => {
    serverLog = (serverLog + chunk.toString()).slice(-8000);
  };
  child.stdout?.on("data", keepLog);
  child.stderr?.on("data", keepLog);
  server = child;
  child.on("exit", () => {
    if (server === child) {
      server = null;
      starting = null;
    }
  });
  try {
    await waitForHealth(port, child);
  } catch (error) {
    child.kill();
    throw error;
  }
  return `http://127.0.0.1:${port}/v1`;
}

export function stopLocalModel(): void {
  server?.kill();
  server = null;
  starting = null;
}

process.on("exit", stopLocalModel);
