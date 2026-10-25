"use client";

/**
 * doc-ai: local processing settings (watch folder, data folder, model provider, model per step).
 * Replaces zdocs' Billing / Invoice History sections. Saved to the doc-ai
 * server (`/api/local/settings`), which overrides the matching .env values.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FolderOpen, Loader2 } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Separator,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zdocs/client-component";
import { zFetch } from "../../../../lib/utils";

type Provider = "gateway" | "ollama";

interface LocalSettings {
  watchDir: string | null;
  dataDir: string;
  dataDirNext: string;
  dataDirSource: "env" | "settings" | "default";
  provider: Provider;
  gatewayApiKeySet: boolean;
  gatewayApiKeyLast4: string | null;
  gatewayApiKeySource: "settings" | "env" | null;
  ollamaBaseUrl: string;
  ollamaModel: string;
  models: { action: string; model: string; defaultModel: string }[];
  modelOptions: string[];
}

const modelMap = (s: LocalSettings) => Object.fromEntries(s.models.map((m) => [m.action, m.model]));

export function ProcessingSection() {
  const t = useTranslations("localSettings");
  const [settings, setSettings] = useState<LocalSettings | null>(null);
  const [watchDir, setWatchDir] = useState("");
  const [dataDir, setDataDir] = useState("");
  const [provider, setProvider] = useState<Provider>("gateway");
  const [models, setModels] = useState<Record<string, string>>({});
  const [gatewayApiKey, setGatewayApiKey] = useState("");
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("");
  const [ollamaModel, setOllamaModel] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  // Typing a path is only offered when the server can't open a folder dialog
  const [pickerSupported, setPickerSupported] = useState(true);

  const apply = useCallback((s: LocalSettings) => {
    setSettings(s);
    setWatchDir(s.watchDir ?? "");
    setDataDir(s.dataDirNext);
    setProvider(s.provider);
    setModels(modelMap(s));
    setGatewayApiKey("");
    setOllamaBaseUrl(s.ollamaBaseUrl);
    setOllamaModel(s.ollamaModel);
  }, []);

  useEffect(() => {
    zFetch("/api/local/settings", { method: "GET" })
      .then(apply)
      .catch((error) => toast.error(error.message));
  }, [apply]);

  const save = async () => {
    setIsSaving(true);
    try {
      const updated = await zFetch("/api/local/settings", {
        method: "POST",
        body: { watchDir, dataDir, provider, models, gatewayApiKey, ollamaBaseUrl, ollamaModel },
      });
      apply(updated);
      toast.success(t("saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const pickWatchDir = async () => {
    setIsPicking(true);
    try {
      const result = await zFetch("/api/local/settings/pick-folder", { method: "POST" });
      if (!result.supported) {
        setPickerSupported(false);
        toast.error(t("watchDirPickerUnsupported"));
      } else if (result.path) {
        setWatchDir(result.path);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPicking(false);
    }
  };

  const test = async () => {
    setIsTesting(true);
    try {
      const result = await zFetch("/api/local/settings/test", { method: "POST" });
      if (result.ok) toast.success(t("testOk", { model: result.model, ms: result.ms }));
      else toast.error(t("testFailed", { error: result.error }));
    } catch (error) {
      toast.error(t("testFailed", { error: error instanceof Error ? error.message : String(error) }));
    } finally {
      setIsTesting(false);
    }
  };

  if (!settings) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="processing-settings-loading">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}
      </div>
    );
  }

  const savedModels = modelMap(settings);
  const dirty =
    watchDir !== (settings.watchDir ?? "") ||
    dataDir !== settings.dataDirNext ||
    provider !== settings.provider ||
    settings.models.some((m) => models[m.action] !== savedModels[m.action]) ||
    gatewayApiKey.trim() !== "" ||
    ollamaBaseUrl !== settings.ollamaBaseUrl ||
    ollamaModel !== settings.ollamaModel;

  return (
    <div className="space-y-6 max-w-2xl" data-testid="processing-settings">
      <div>
        <h3 className="text-base font-semibold">{t("title")}</h3>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="watch-dir">{t("watchDir")}</Label>
        <div className="flex gap-2">
          <Input
            id="watch-dir"
            value={watchDir}
            onChange={(e) => setWatchDir(e.target.value)}
            onClick={() => pickerSupported && !isPicking && pickWatchDir()}
            readOnly={pickerSupported}
            placeholder={pickerSupported ? t("watchDirNone") : "~/Documents/doc-ai/docs"}
            className={`font-mono text-sm ${pickerSupported ? "cursor-pointer" : ""}`}
            data-testid="watch-dir-input"
          />
          {pickerSupported && (
            <Button
              type="button"
              variant="outline"
              onClick={pickWatchDir}
              disabled={isPicking}
              data-testid="watch-dir-pick-btn"
            >
              {isPicking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderOpen className="mr-2 h-4 w-4" />}
              {t("watchDirChoose")}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("watchDirHint")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="data-dir">{t("dataDir")}</Label>
        <Input
          id="data-dir"
          value={dataDir}
          onChange={(e) => setDataDir(e.target.value)}
          placeholder="~/.doc-ai"
          disabled={settings.dataDirSource === "env"}
          className="font-mono text-sm"
          data-testid="data-dir-input"
        />
        <p className="text-xs text-muted-foreground">
          {settings.dataDirSource === "env" ? t("dataDirEnv") : t("dataDirHint")}
        </p>
        {settings.dataDirNext !== settings.dataDir && (
          <p className="text-xs text-amber-600" data-testid="data-dir-restart">
            {t("dataDirRestart", { current: settings.dataDir })}
          </p>
        )}
      </div>

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="provider">{t("provider")}</Label>
        <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
          <SelectTrigger id="provider" data-testid="provider-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gateway">{t("providerGateway")}</SelectItem>
            <SelectItem value="ollama">{t("providerOllama")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {provider === "gateway" ? (
        <>
          <div className="space-y-2">
            <Label>{t("models")}</Label>
            <p className="text-xs text-muted-foreground">{t("modelsHint")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] sm:items-center gap-x-4 gap-y-2">
              {settings.models.map((m) => {
                const value = models[m.action] ?? m.model;
                // Keep a saved model selectable even if it isn't in the known list
                const options = settings.modelOptions.includes(value)
                  ? settings.modelOptions
                  : [value, ...settings.modelOptions];
                return (
                  <div key={m.action} className="contents">
                    <Label htmlFor={`model-${m.action}`} className="text-sm font-normal">
                      {t(`actions.${m.action}`)}
                    </Label>
                    <Select
                      value={value}
                      onValueChange={(v) => setModels((prev) => ({ ...prev, [m.action]: v }))}
                    >
                      <SelectTrigger
                        id={`model-${m.action}`}
                        className="font-mono text-sm"
                        data-testid={`model-select-${m.action}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((option) => (
                          <SelectItem key={option} value={option} className="font-mono text-sm">
                            {option}
                            {option === m.defaultModel && ` (${t("modelDefault")})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gateway-key">{t("gatewayKey")}</Label>
            <Input
              id="gateway-key"
              type="password"
              autoComplete="off"
              value={gatewayApiKey}
              onChange={(e) => setGatewayApiKey(e.target.value)}
              placeholder={
                settings.gatewayApiKeySet
                  ? t("gatewayKeySet", {
                      last4: settings.gatewayApiKeyLast4 ?? "",
                      source: settings.gatewayApiKeySource === "env" ? ".env" : "settings",
                    })
                  : t("gatewayKeyMissing")
              }
              data-testid="gateway-key-input"
            />
            <p className="text-xs text-muted-foreground">{t("gatewayKeyHint")}</p>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ollama-url">{t("ollamaUrl")}</Label>
            <Input
              id="ollama-url"
              value={ollamaBaseUrl}
              onChange={(e) => setOllamaBaseUrl(e.target.value)}
              className="font-mono text-sm"
              data-testid="ollama-url-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ollama-model">{t("ollamaModel")}</Label>
            <Input
              id="ollama-model"
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              className="font-mono text-sm"
              data-testid="ollama-model-input"
            />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">{t("ollamaHint")}</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={isSaving || !dirty} data-testid="processing-save-btn">
          {isSaving ? t("saving") : t("save")}
        </Button>
        <Button variant="outline" onClick={test} disabled={isTesting || dirty} data-testid="processing-test-btn">
          {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("test")}
        </Button>
        {dirty && <span className="text-xs text-muted-foreground">{t("saveBeforeTest")}</span>}
      </div>
    </div>
  );
}
