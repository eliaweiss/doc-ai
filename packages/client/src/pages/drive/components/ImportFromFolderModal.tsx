"use client";
// doc-ai: new. Scan a local folder with Eye (on the server), pick the receipts
// and documents it found, import them into a doc-ai folder.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Folder as FolderIcon, Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Progress,
  cn,
} from "@zdocs/client-component";
import { RECENT_FOLDER_ID, useDocsStore } from "../../../context-providers/docsStore";
import { fetchDocuments } from "../../../utilities/api/fetchDocuments";

const API = "/api/local/photo-sort";
const LAST_FOLDER_KEY = "doc-ai:import-from-folder:last";

type Category = "receipt" | "document" | "screenshot" | "other";

interface ScanItem {
  path: string;
  relPath: string;
  size: number;
  category: Category;
  kind: string | null;
  confidence: number;
  existingDocumentId: string | null;
  error?: string;
}

interface ScanView {
  scanId: string;
  folder: string;
  status: "running" | "done" | "error";
  total: number;
  done: number;
  truncated: boolean;
  error?: string;
  elapsedMs: number;
  scannedAt: string | null;
  reused: boolean;
  counts: Record<Category, number>;
  items: ScanItem[];
}

/** A folder's previous scan, saved by the server */
interface SavedScanInfo {
  folder: string;
  scannedAt: string;
  total: number;
  truncated: boolean;
  counts: Record<Category, number>;
}

interface TargetFolder {
  id: string;
  name: string;
  parentId: string | null;
  isRoot: boolean;
}

async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data as T;
}

function readLastFolder(): string {
  try {
    return localStorage.getItem(LAST_FOLDER_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Folders as a flat list in tree order, with their depth (for indentation) */
function flattenFolders(folders: TargetFolder[]) {
  const byParent = new Map<string | null, TargetFolder[]>();
  for (const f of folders) byParent.set(f.parentId, [...(byParent.get(f.parentId) ?? []), f]);
  const out: { folder: TargetFolder; depth: number }[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const f of byParent.get(parentId) ?? []) {
      out.push({ folder: f, depth });
      visit(f.id, depth + 1);
    }
  };
  const roots = folders.filter((f) => f.isRoot);
  for (const root of roots) {
    out.push({ folder: root, depth: 0 });
    visit(root.id, 1);
  }
  return out;
}

interface ImportFromFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportFromFolderModal({ isOpen, onClose }: ImportFromFolderModalProps) {
  const t = useTranslations("importFromFolder");
  const { currentFolderId } = useDocsStore();

  const [folder, setFolder] = useState(readLastFolder);
  const [browser, setBrowser] = useState<{ dir: string; parent: string | null; dirs: string[] } | null>(null);
  const [scan, setScan] = useState<ScanView | null>(null);
  const [savedScan, setSavedScan] = useState<SavedScanInfo | null>(null);
  const [showScreenshots, setShowScreenshots] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targets, setTargets] = useState<TargetFolder[]>([]);
  const [targetId, setTargetId] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = null;
  };

  useEffect(() => {
    if (!isOpen) return;
    api<{ folders: TargetFolder[] }>(`${API}/folders`)
      .then(({ folders }) => {
        setTargets(folders);
        const current = folders.find((f) => f.id === currentFolderId && currentFolderId !== RECENT_FOLDER_ID);
        setTargetId((current ?? folders.find((f) => f.isRoot))?.id ?? "");
      })
      .catch((error) => toast.error(error.message));
    return stopPolling;
  }, [isOpen, currentFolderId]);

  const reset = () => {
    stopPolling();
    setScan(null);
    setSavedScan(null);
    setSelected(new Set());
    setBrowser(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const browse = async (dir?: string) => {
    try {
      const query = dir ?? folder;
      setBrowser(await api(`${API}/dirs${query ? `?dir=${encodeURIComponent(query)}` : ""}`));
    } catch (error) {
      // Typed path doesn't exist: start from the home folder
      if (dir === undefined && folder) return browse("");
      toast.error((error as Error).message);
    }
  };

  const poll = useCallback(
    (scanId: string, screenshots: boolean) => {
      stopPolling();
      const tick = async () => {
        try {
          const view = await api<ScanView>(`${API}/scan/${scanId}${screenshots ? "?screenshots=1" : ""}`);
          setScan(view);
          if (view.status === "running") {
            pollRef.current = setTimeout(tick, 500);
          } else {
            // All selected by default, except photos already in doc-ai
            setSelected(new Set(view.items.filter((it) => !it.existingDocumentId && !it.error).map((it) => it.path)));
          }
        } catch (error) {
          toast.error((error as Error).message);
        }
      };
      void tick();
    },
    []
  );

  /** reuse: undefined asks the server whether a saved scan exists; true/false answers that */
  const startScan = async (reuse?: boolean) => {
    if (!folder.trim()) return;
    try {
      setBrowser(null);
      setSavedScan(null);
      const response = await api<ScanView | { savedScan: SavedScanInfo }>(`${API}/scan`, {
        method: "POST",
        body: { folder, reuse },
      });
      if ("savedScan" in response) {
        stopPolling();
        setScan(null);
        setSavedScan(response.savedScan);
        return;
      }
      const view = response;
      try {
        localStorage.setItem(LAST_FOLDER_KEY, view.folder);
      } catch {
        // storage unavailable: just don't remember the folder
      }
      setFolder(view.folder);
      setScan(view);
      poll(view.scanId, showScreenshots);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const toggleScreenshots = (value: boolean) => {
    setShowScreenshots(value);
    if (scan && scan.status === "done") poll(scan.scanId, value);
  };

  const items = scan?.status === "done" ? scan.items : [];
  const selectable = useMemo(() => items.filter((it) => !it.error), [items]);
  const allSelected = selectable.length > 0 && selectable.every((it) => selected.has(it.path));
  const selectedCount = selectable.filter((it) => selected.has(it.path)).length;

  const toggle = (path: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const runImport = async () => {
    const paths = selectable.filter((it) => selected.has(it.path)).map((it) => it.path);
    if (!paths.length) return;
    setImporting(true);
    try {
      const result = await api<{
        folder: { name: string };
        imported: unknown[];
        skipped: unknown[];
        failed: { path: string; error: string }[];
      }>(`${API}/import`, { method: "POST", body: { paths, folderId: targetId || undefined } });
      toast.success(
        t("importDone", { imported: result.imported.length, skipped: result.skipped.length, folder: result.folder.name })
      );
      if (result.failed.length) toast.error(t("importFailed", { count: result.failed.length }));
      void fetchDocuments().catch(() => undefined);
      close();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const flatTargets = useMemo(() => flattenFolders(targets), [targets]);
  const running = scan?.status === "running";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-4xl" data-testid="import-from-folder-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t("title")}
            <span className="text-[10px] font-normal uppercase tracking-wide rounded px-1.5 py-0.5 border border-border text-muted-foreground">
              {t("experimental")}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground -mt-2 space-y-1">
          <p>{t("description")}</p>
          <p className="text-xs">{t("descriptionDetails")}</p>
        </div>

        <div className="flex gap-2">
          <Input
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && startScan()}
            placeholder={t("folderPlaceholder")}
            disabled={running}
            data-testid="import-folder-input"
          />
          <Button variant="outline" onClick={() => (browser ? setBrowser(null) : browse())} disabled={running}>
            {t("browse")}
          </Button>
          <Button onClick={() => startScan()} disabled={running || !folder.trim()} data-testid="import-scan-btn">
            {running ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ScanSearch className="w-4 h-4 mr-1" />}
            {t("scan")}
          </Button>
        </div>

        {browser && (
          <div className="border border-border rounded-md max-h-56 overflow-y-auto text-sm">
            <div className="sticky top-0 bg-background border-b border-border px-2 py-1 flex items-center gap-2">
              {browser.parent && (
                <button className="p-1 rounded hover:bg-accent" onClick={() => browse(browser.parent!)} title={t("up")}>
                  <ArrowUp className="w-4 h-4" />
                </button>
              )}
              <span className="truncate flex-1 text-muted-foreground">{browser.dir}</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setFolder(browser.dir);
                  setBrowser(null);
                }}
              >
                {t("useThisFolder")}
              </Button>
            </div>
            {browser.dirs.length === 0 && <div className="px-3 py-2 text-muted-foreground">{t("noSubfolders")}</div>}
            {browser.dirs.map((name) => (
              <div
                key={name}
                className="px-3 py-1 cursor-pointer hover:bg-accent flex items-center"
                onClick={() => browse(`${browser.dir}/${name}`)}
              >
                <FolderIcon className="w-4 h-4 mr-2 text-muted-foreground" />
                {name}
              </div>
            ))}
          </div>
        )}

        {savedScan && (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm space-y-2" data-testid="import-saved-scan">
            <p>
              {t("savedScanFound", {
                date: new Date(savedScan.scannedAt).toLocaleString(),
                total: savedScan.total,
                receipts: savedScan.counts.receipt,
                documents: savedScan.counts.document,
              })}
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => startScan(true)} data-testid="import-reuse-scan-btn">
                {t("reuseScan")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => startScan(false)} data-testid="import-new-scan-btn">
                {t("newScan")}
              </Button>
            </div>
          </div>
        )}

        {running && scan && (
          <div className="space-y-1">
            <Progress value={scan.total ? (scan.done / scan.total) * 100 : 0} />
            <p className="text-xs text-muted-foreground">
              {scan.total ? t("scanning", { done: scan.done, total: scan.total }) : t("listing")}
            </p>
          </div>
        )}

        {scan?.status === "error" && <p className="text-sm text-destructive">{scan.error}</p>}

        {scan?.status === "done" && (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) =>
                    setSelected(v ? new Set(selectable.map((it) => it.path)) : new Set())
                  }
                  data-testid="import-select-all"
                />
                {allSelected ? t("unselectAll") : t("selectAll")}
              </label>
              <span className="text-muted-foreground">
                {scan.reused && scan.scannedAt
                  ? t("summaryReused", {
                      total: scan.total,
                      receipts: scan.counts.receipt,
                      documents: scan.counts.document,
                      date: new Date(scan.scannedAt).toLocaleString(),
                    })
                  : t("summary", {
                      total: scan.total,
                      receipts: scan.counts.receipt,
                      documents: scan.counts.document,
                      seconds: (scan.elapsedMs / 1000).toFixed(1),
                    })}
              </span>
              <label className="flex items-center gap-2 cursor-pointer ml-auto">
                <Checkbox checked={showScreenshots} onCheckedChange={(v) => toggleScreenshots(Boolean(v))} />
                {t("includeScreenshots", { count: scan.counts.screenshot })}
              </label>
            </div>
            {scan.truncated && <p className="text-xs text-muted-foreground">{t("truncated", { total: scan.total })}</p>}

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t("nothingFound")}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 auto-rows-max gap-3 max-h-[50vh] overflow-y-auto pr-1">
                {items.map((it) => {
                  const isSelected = selected.has(it.path);
                  return (
                    <div
                      key={it.path}
                      onClick={() => !it.error && toggle(it.path)}
                      className={cn(
                        "relative rounded-md border cursor-pointer overflow-hidden bg-muted/30",
                        isSelected ? "border-primary ring-2 ring-primary/40" : "border-border opacity-70",
                        it.error && "cursor-not-allowed opacity-50"
                      )}
                      title={it.relPath}
                    >
                      <img
                        src={`${API}/thumb?path=${encodeURIComponent(it.path)}`}
                        alt={it.relPath}
                        loading="lazy"
                        className="w-full h-36 object-cover"
                      />
                      <div className="absolute top-2 left-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSelected} disabled={Boolean(it.error)} onCheckedChange={() => toggle(it.path)} />
                      </div>
                      <span className="absolute top-2 right-2 text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-background/90 border border-border">
                        {t(`category.${it.category}`)} · {Math.round(it.confidence * 100)}%
                      </span>
                      <div className="px-2 py-1 text-xs">
                        <div className="truncate">{it.relPath}</div>
                        {it.existingDocumentId && <div className="text-muted-foreground">{t("alreadyImported")}</div>}
                        {it.error && <div className="text-destructive truncate">{it.error}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <DialogFooter className="items-center gap-2 sm:justify-between">
          {scan?.status === "done" && items.length > 0 ? (
            <label className="flex items-center gap-2 text-sm">
              {t("importInto")}
              <select
                className="border border-border rounded-md bg-background px-2 py-1"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                data-testid="import-target-folder"
              >
                {flatTargets.map(({ folder: f, depth }) => (
                  <option key={f.id} value={f.id}>
                    {"  ".repeat(depth)}
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={close}>
              {t("cancel")}
            </Button>
            <Button
              onClick={runImport}
              disabled={importing || selectedCount === 0}
              data-testid="import-confirm-btn"
            >
              {importing && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {t("import", { count: selectedCount })}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
