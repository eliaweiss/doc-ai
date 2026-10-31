"use client";

/**
 * doc-ai: local processing settings (watch folder, data folder) and the AI setup (AiSetupWizard).
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
} from "@zdocs/client-component";
import { zFetch } from "../../../../lib/utils";
import { AiSetupWizard, type LocalSettings } from "./AiSetupWizard";

export function ProcessingSection() {
  const t = useTranslations("localSettings");
  const tSetup = useTranslations("aiSetup");
  const [settings, setSettings] = useState<LocalSettings | null>(null);
  const [watchDir, setWatchDir] = useState("");
  const [dataDir, setDataDir] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  // Typing a path is only offered when the server can't open a folder dialog
  const [pickerSupported, setPickerSupported] = useState(true);

  const apply = useCallback((s: LocalSettings) => {
    setSettings(s);
    setWatchDir(s.watchDir ?? "");
    setDataDir(s.dataDirNext);
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
        body: { watchDir, dataDir },
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

  const dirty = watchDir !== (settings.watchDir ?? "") || dataDir !== settings.dataDirNext;

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

      <div className="space-y-2" data-testid="ai-setup-summary">
        <Label>{t("aiTitle")}</Label>
        <p className="text-sm">
          {settings.setupNeeded
            ? t("aiSetupNeeded")
            : t("aiCurrent", { setup: tSetup(`providers.${settings.provider}.name`) })}
        </p>
        <Button variant="outline" onClick={() => setWizardOpen(true)} data-testid="ai-setup-open-btn">
          {t("aiChange")}
        </Button>
        {wizardOpen && (
          <AiSetupWizard open={wizardOpen} onOpenChange={setWizardOpen} settings={settings} onDone={apply} />
        )}
      </div>

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
