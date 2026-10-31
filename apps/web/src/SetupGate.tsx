/**
 * doc-ai: opens the setup wizard on first run (no AI provider set up yet).
 * Skipping closes it until the next page load.
 */
import { useEffect, useState } from "react";
import {
  AiSetupWizard,
  type LocalSettings,
} from "@zdocs/client/src/pages/app/org-admin/components/AiSetupWizard";
import { zFetch } from "@zdocs/client/src/lib/utils";

export function SetupGate() {
  const [settings, setSettings] = useState<LocalSettings | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    zFetch("/api/local/settings", { method: "GET" })
      .then((s: LocalSettings) => {
        setSettings(s);
        setOpen(s.setupNeeded);
      })
      .catch(() => {});
  }, []);

  if (!settings?.setupNeeded) return null;
  return (
    <AiSetupWizard
      open={open}
      onOpenChange={setOpen}
      settings={settings}
      onboarding
      // The watch folder may have changed: reload so every page sees it
      onDone={() => window.location.reload()}
    />
  );
}
