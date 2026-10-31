"use client";

/**
 * doc-ai: the AI setup wizard. Shown on first run (with a watch folder step)
 * and from Settings → Processing whenever the AI provider is changed.
 *
 * Steps: choose a setup → configure it (Ollama, built-in model download, or an
 * API key and models) → test it → save. Backend: apps/server/src/ai-setup.ts.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, Cloud, ExternalLink, FolderOpen, HardDrive, Loader2, XCircle } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Progress,
  cn,
} from "@zdocs/client-component";
import { zFetch } from "../../../../lib/utils";

export type Provider = "ollama" | "local" | "gateway" | "openrouter" | "openai" | "anthropic" | "google";
type KeyProvider = "gateway" | "openrouter" | "openai" | "anthropic" | "google";
type CloudProvider = "openrouter" | "openai" | "anthropic" | "google";
interface StepModels {
  classify: string;
  extract: string;
}

interface DownloadStatus {
  state: "idle" | "downloading" | "done" | "error" | "cancelled";
  part: string | null;
  bytesDone: number;
  bytesTotal: number;
  error: string | null;
}

interface OllamaPullStatus {
  state: "idle" | "pulling" | "done" | "error";
  status: string | null;
  bytesDone: number;
  bytesTotal: number;
  error: string | null;
}

export interface LocalModelStatus {
  label: string;
  supported: boolean;
  installed: boolean;
  missing: string[];
  totalMemGB: number;
  minMemGB: number;
  download: DownloadStatus;
  running: boolean;
}

/** GET /api/local/settings */
export interface LocalSettings {
  watchDir: string | null;
  dataDir: string;
  dataDirNext: string;
  dataDirSource: "env" | "settings" | "default";
  provider: Provider;
  setupNeeded: boolean;
  apiKeys: Record<KeyProvider, { set: boolean; last4: string | null; source: "settings" | "env" | null; envVar: string }>;
  cloudModels: Record<CloudProvider, StepModels>;
  defaultCloudModels: Record<CloudProvider, StepModels>;
  localModel: LocalModelStatus;
  ollamaBaseUrl: string;
  ollamaModel: string;
  models: { action: string; model: string; defaultModel: string }[];
  modelOptions: string[];
}

const LOCAL_PROVIDERS: Provider[] = ["ollama", "local"];
const CLOUD_CHOICES: Provider[] = ["openai", "anthropic", "google", "openrouter", "gateway"];
const KEY_URLS: Record<KeyProvider, string> = {
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/settings/keys",
  google: "https://aistudio.google.com/apikey",
  openrouter: "https://openrouter.ai/keys",
  gateway: "https://vercel.com/docs/ai-gateway",
};
const DEFAULT_OLLAMA_MODEL = "qwen3.5:9b";

const isKeyProvider = (p: Provider): p is KeyProvider => !LOCAL_PROVIDERS.includes(p);
const isCloudProvider = (p: Provider): p is CloudProvider => isKeyProvider(p) && p !== "gateway";

const gb = (bytes: number) => (bytes / 1024 ** 3).toFixed(1);
const percent = (d: { bytesDone: number; bytesTotal: number }) =>
  d.bytesTotal ? Math.min(100, Math.round((d.bytesDone / d.bytesTotal) * 100)) : 0;

type Step = "folder" | "choose" | "configure" | "test";

interface AiSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: LocalSettings;
  /** Called with the saved settings */
  onDone: (settings: LocalSettings) => void;
  /** First run: starts with the watch folder and can be skipped */
  onboarding?: boolean;
}

export function AiSetupWizard({ open, onOpenChange, settings, onDone, onboarding = false }: AiSetupWizardProps) {
  const t = useTranslations("aiSetup");
  const [step, setStep] = useState<Step>(onboarding ? "folder" : "choose");
  const [watchDir, setWatchDir] = useState(settings.watchDir ?? "");
  const [isPicking, setIsPicking] = useState(false);
  const [provider, setProvider] = useState<Provider>(settings.setupNeeded ? "local" : settings.provider);

  // Cloud
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<StepModels>({ classify: "", extract: "" });
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Ollama
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState(settings.ollamaBaseUrl);
  const [ollamaModel, setOllamaModel] = useState(settings.ollamaModel || DEFAULT_OLLAMA_MODEL);
  const [ollama, setOllama] = useState<{ reachable: boolean; version: string | null; hasModel: boolean } | null>(null);
  const [ollamaChecking, setOllamaChecking] = useState(false);
  const [pull, setPull] = useState<OllamaPullStatus | null>(null);

  // Built-in model
  const [localModel, setLocalModel] = useState<LocalModelStatus>(settings.localModel);

  // Test and save
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; models?: string[]; ms?: number; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const keyInfo = isKeyProvider(provider) ? settings.apiKeys[provider] : null;

  // Defaults for the chosen setup
  useEffect(() => {
    setApiKey("");
    setModelOptions([]);
    setModelsError(null);
    setTestResult(null);
    if (isCloudProvider(provider)) setModels(settings.cloudModels[provider]);
    else if (provider === "gateway") {
      const byAction = Object.fromEntries(settings.models.map((m) => [m.action, m.model]));
      setModels({ classify: byAction.CLASSIFY_DOCUMENT ?? "", extract: byAction.EXTRACT_DOCUMENT ?? "" });
      setModelOptions(settings.modelOptions);
    }
  }, [provider, settings]);

  const loadModels = useCallback(async () => {
    if (!isKeyProvider(provider)) return;
    setModelsLoading(true);
    setModelsError(null);
    try {
      const result = await zFetch("/api/local/settings/ai/models", { method: "POST", body: { provider, apiKey } });
      setModelOptions(result.models);
    } catch (error) {
      setModelsError(error instanceof Error ? error.message : String(error));
    } finally {
      setModelsLoading(false);
    }
  }, [provider, apiKey]);

  // A saved key can list models right away
  useEffect(() => {
    if (step === "configure" && keyInfo?.set && !apiKey) loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, provider]);

  const checkOllama = useCallback(async () => {
    setOllamaChecking(true);
    try {
      setOllama(
        await zFetch("/api/local/settings/ai/ollama/check", {
          method: "POST",
          body: { baseUrl: ollamaBaseUrl, model: ollamaModel },
        })
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setOllamaChecking(false);
    }
  }, [ollamaBaseUrl, ollamaModel]);

  useEffect(() => {
    if (step === "configure" && provider === "ollama") checkOllama();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, provider]);

  // Poll downloads while they run
  const pulling = pull?.state === "pulling";
  const downloading = localModel.download.state === "downloading";
  useEffect(() => {
    if (!pulling && !downloading) return;
    const timer = setInterval(async () => {
      try {
        if (pulling) {
          const status = await zFetch("/api/local/settings/ai/ollama/pull", { method: "GET" });
          setPull(status);
          if (status.state === "done") checkOllama();
        }
        if (downloading) setLocalModel(await zFetch("/api/local/settings/ai/local", { method: "GET" }));
      } catch {
        // keep polling
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [pulling, downloading, checkOllama]);

  const startPull = async () => {
    try {
      setPull(
        await zFetch("/api/local/settings/ai/ollama/pull", {
          method: "POST",
          body: { baseUrl: ollamaBaseUrl, model: ollamaModel },
        })
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const startDownload = async () => {
    try {
      setLocalModel(await zFetch("/api/local/settings/ai/local/download", { method: "POST" }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const cancelDownload = async () => {
    setLocalModel(await zFetch("/api/local/settings/ai/local/cancel", { method: "POST" }));
  };

  const pickFolder = async () => {
    setIsPicking(true);
    try {
      const result = await zFetch("/api/local/settings/pick-folder", { method: "POST" });
      if (!result.supported) toast.error(t("folderPickerUnsupported"));
      else if (result.path) setWatchDir(result.path);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPicking(false);
    }
  };

  /** The wizard's choices, in the shape the test and save endpoints take */
  const choices = useMemo(
    () => ({
      provider,
      apiKey: apiKey.trim(),
      models: isCloudProvider(provider) ? models : undefined,
      ollamaBaseUrl,
      ollamaModel,
    }),
    [provider, apiKey, models, ollamaBaseUrl, ollamaModel]
  );

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await zFetch("/api/local/settings/ai/test", { method: "POST", body: choices }));
    } catch (error) {
      setTestResult({ ok: false, error: error instanceof Error ? error.message : String(error) });
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    if (step === "test") runTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await zFetch("/api/local/settings", {
        method: "POST",
        body: {
          provider,
          setupDone: true,
          ...(onboarding && watchDir ? { watchDir } : {}),
          ...(isKeyProvider(provider) && apiKey.trim() ? { apiKeys: { [provider]: apiKey.trim() } } : {}),
          ...(isCloudProvider(provider) ? { cloudModels: { [provider]: models } } : {}),
          ...(provider === "gateway"
            ? { models: { CLASSIFY_DOCUMENT: models.classify, EXTRACT_DOCUMENT: models.extract } }
            : {}),
          ...(provider === "ollama" ? { ollamaBaseUrl, ollamaModel } : {}),
        },
      });
      toast.success(t("saved"));
      onDone(updated);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const configured =
    provider === "local"
      ? localModel.installed
      : provider === "ollama"
        ? Boolean(ollama?.reachable && ollama.hasModel)
        : Boolean((apiKey.trim() || keyInfo?.set) && models.classify.trim() && models.extract.trim());

  const choiceCard = (p: Provider) => (
    <button
      key={p}
      type="button"
      onClick={() => setProvider(p)}
      className={cn(
        "w-full rounded-md border p-3 text-left transition-colors hover:bg-accent",
        provider === p && "border-primary ring-1 ring-primary bg-accent"
      )}
      data-testid={`ai-setup-choice-${p}`}
    >
      <div className="text-sm font-medium">{t(`providers.${p}.name`)}</div>
      <div className="text-xs text-muted-foreground">{t(`providers.${p}.description`)}</div>
    </button>
  );

  const modelField = (field: keyof StepModels) => (
    <div className="space-y-1">
      <Label htmlFor={`ai-model-${field}`} className="text-sm font-normal">
        {t(`models.${field}`)}
      </Label>
      <Input
        id={`ai-model-${field}`}
        list="ai-setup-model-options"
        value={models[field]}
        onChange={(e) => setModels((prev) => ({ ...prev, [field]: e.target.value }))}
        className="font-mono text-sm"
        data-testid={`ai-setup-model-${field}`}
      />
    </div>
  );

  const progressBlock = (d: { bytesDone: number; bytesTotal: number }, label: string) => (
    <div className="space-y-1">
      <Progress value={percent(d)} />
      <p className="text-xs text-muted-foreground">
        {label} {d.bytesTotal ? `${gb(d.bytesDone)} / ${gb(d.bytesTotal)} GB (${percent(d)}%)` : ""}
      </p>
    </div>
  );

  const configure = () => {
    if (provider === "local") {
      const lowMemory = localModel.totalMemGB < localModel.minMemGB;
      return (
        <div className="space-y-4" data-testid="ai-setup-local">
          <p className="text-sm">{t("local.intro", { model: localModel.label })}</p>
          {!localModel.supported ? (
            <p className="text-sm text-destructive">{t("local.unsupported")}</p>
          ) : (
            <>
              <p className={cn("text-xs", lowMemory ? "text-amber-600" : "text-muted-foreground")}>
                {lowMemory
                  ? t("local.lowMemory", { total: localModel.totalMemGB, min: localModel.minMemGB })
                  : t("local.memoryOk", { total: localModel.totalMemGB })}
              </p>
              {localModel.installed ? (
                <p className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4" /> {t("local.installed")}
                </p>
              ) : downloading ? (
                <div className="space-y-2">
                  {progressBlock(localModel.download, t("local.downloading", { part: localModel.download.part ?? "" }))}
                  <Button variant="outline" size="sm" onClick={cancelDownload}>
                    {t("cancel")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {localModel.download.state === "error" && (
                    <p className="text-sm text-destructive">{localModel.download.error}</p>
                  )}
                  <Button onClick={startDownload} data-testid="ai-setup-local-download">
                    {localModel.download.state === "cancelled" || localModel.download.state === "error"
                      ? t("local.resume")
                      : t("local.download")}
                  </Button>
                  <p className="text-xs text-muted-foreground">{t("local.downloadHint")}</p>
                </div>
              )}
            </>
          )}
        </div>
      );
    }

    if (provider === "ollama") {
      return (
        <div className="space-y-4" data-testid="ai-setup-ollama">
          <p className="text-sm">{t("ollama.intro")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ai-ollama-url" className="text-sm font-normal">{t("ollama.url")}</Label>
              <Input
                id="ai-ollama-url"
                value={ollamaBaseUrl}
                onChange={(e) => setOllamaBaseUrl(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-ollama-model" className="text-sm font-normal">{t("ollama.model")}</Label>
              <Input
                id="ai-ollama-model"
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={checkOllama} disabled={ollamaChecking}>
            {ollamaChecking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("ollama.check")}
          </Button>
          {ollama && !ollama.reachable && (
            <p className="text-sm text-destructive" data-testid="ai-setup-ollama-unreachable">
              {t("ollama.unreachable")}{" "}
              <a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="underline">
                ollama.com/download
              </a>
            </p>
          )}
          {ollama?.reachable && ollama.hasModel && (
            <p className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" /> {t("ollama.ready", { version: ollama.version ?? "", model: ollamaModel })}
            </p>
          )}
          {ollama?.reachable && !ollama.hasModel && (
            <div className="space-y-2">
              {pull?.state === "pulling" ? (
                progressBlock(pull, pull.status ?? "")
              ) : (
                <>
                  {pull?.state === "error" && <p className="text-sm text-destructive">{pull?.error}</p>}
                  <p className="text-sm">{t("ollama.missing", { model: ollamaModel })}</p>
                  <Button onClick={startPull}>{t("ollama.pull", { model: ollamaModel })}</Button>
                </>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4" data-testid="ai-setup-cloud">
        <div className="space-y-1">
          <Label htmlFor="ai-api-key" className="text-sm font-normal">{t("key.label")}</Label>
          <div className="flex gap-2">
            <Input
              id="ai-api-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                keyInfo?.set
                  ? t("key.set", { last4: keyInfo.last4 ?? "", source: keyInfo.source === "env" ? keyInfo.envVar : "settings" })
                  : t("key.missing")
              }
              data-testid="ai-setup-api-key"
            />
            <Button
              variant="outline"
              onClick={loadModels}
              disabled={modelsLoading || (!apiKey.trim() && !keyInfo?.set)}
              data-testid="ai-setup-load-models"
            >
              {modelsLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("key.verify")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("key.hint")}{" "}
            {isKeyProvider(provider) && (
              <a href={KEY_URLS[provider]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                {t("key.get")} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </p>
          {modelsError && <p className="text-sm text-destructive">{modelsError}</p>}
          {!modelsError && modelOptions.length > 0 && provider !== "gateway" && (
            <p className="flex items-center gap-1 text-xs text-green-700">
              <CheckCircle2 className="h-3 w-3" /> {t("key.ok", { count: modelOptions.length })}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t("models.hint")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {modelField("classify")}
            {modelField("extract")}
          </div>
          <datalist id="ai-setup-model-options">
            {modelOptions.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
      </div>
    );
  };

  const test = () => (
    <div className="space-y-3" data-testid="ai-setup-test">
      {testing && (
        <p className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> {provider === "local" ? t("test.runningLocal") : t("test.running")}
        </p>
      )}
      {testResult?.ok && (
        <p className="flex items-center gap-2 text-sm text-green-700" data-testid="ai-setup-test-ok">
          <CheckCircle2 className="h-4 w-4" /> {t("test.ok", { models: (testResult.models ?? []).join(", "), ms: testResult.ms ?? 0 })}
        </p>
      )}
      {testResult && !testResult.ok && (
        <div className="space-y-2" data-testid="ai-setup-test-failed">
          <p className="flex items-start gap-2 text-sm text-destructive">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {testResult.error}
          </p>
          <Button variant="outline" size="sm" onClick={runTest}>
            {t("test.retry")}
          </Button>
        </div>
      )}
    </div>
  );

  const titles: Record<Step, string> = {
    folder: t("folder.title"),
    choose: t("choose.title"),
    configure: t(`providers.${provider}.name`),
    test: t("test.title"),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" data-testid="ai-setup-wizard">
        <DialogHeader>
          <DialogTitle>{titles[step]}</DialogTitle>
          {step === "folder" && <DialogDescription>{t("folder.description")}</DialogDescription>}
          {step === "choose" && <DialogDescription>{t("choose.description")}</DialogDescription>}
        </DialogHeader>

        {step === "folder" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={watchDir}
                onChange={(e) => setWatchDir(e.target.value)}
                placeholder="~/Documents/receipts"
                className="font-mono text-sm"
                data-testid="ai-setup-watch-dir"
              />
              <Button type="button" variant="outline" onClick={pickFolder} disabled={isPicking}>
                {isPicking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderOpen className="mr-2 h-4 w-4" />}
                {t("folder.choose")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("folder.hint")}</p>
          </div>
        )}

        {step === "choose" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <HardDrive className="h-4 w-4" /> {t("choose.localTitle")}
              </div>
              <p className="text-xs text-muted-foreground">{t("choose.localHint")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{LOCAL_PROVIDERS.map(choiceCard)}</div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Cloud className="h-4 w-4" /> {t("choose.cloudTitle")}
              </div>
              <p className="text-xs text-muted-foreground">{t("choose.cloudHint")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{CLOUD_CHOICES.map(choiceCard)}</div>
            </div>
          </div>
        )}

        {step === "configure" && configure()}
        {step === "test" && test()}

        <DialogFooter className="gap-2">
          {step === "folder" && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t("skip")}
              </Button>
              <Button onClick={() => setStep("choose")} data-testid="ai-setup-next">
                {t("next")}
              </Button>
            </>
          )}
          {step === "choose" && (
            <>
              <Button variant="ghost" onClick={() => (onboarding ? setStep("folder") : onOpenChange(false))}>
                {onboarding ? t("back") : t("cancel")}
              </Button>
              <Button onClick={() => setStep("configure")} data-testid="ai-setup-next">
                {t("next")}
              </Button>
            </>
          )}
          {step === "configure" && (
            <>
              <Button variant="ghost" onClick={() => setStep("choose")}>
                {t("back")}
              </Button>
              <Button onClick={() => setStep("test")} disabled={!configured} data-testid="ai-setup-next">
                {t("next")}
              </Button>
            </>
          )}
          {step === "test" && (
            <>
              <Button variant="ghost" onClick={() => setStep("configure")} disabled={testing}>
                {t("back")}
              </Button>
              {testResult && !testResult.ok && (
                <Button variant="outline" onClick={save} disabled={saving}>
                  {t("saveAnyway")}
                </Button>
              )}
              <Button onClick={save} disabled={saving || testing || !testResult?.ok} data-testid="ai-setup-finish">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("finish")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
