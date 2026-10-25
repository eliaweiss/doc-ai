"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Landmark, Loader2 } from "lucide-react";
import type { DriverManifest, MockBankLinkSetupOptions } from "@zdocs/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
} from "@zdocs/client-component";
import { useDataSources } from "../context/DataSourcesProvider";
import { fetchDriverSetupConfig } from "../../../utilities/api/dataSourceApi";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

interface MockDatasourceLinkDialogProps {
  driver: DriverManifest;
  open: boolean;
  onClose: () => void;
}

type Step = "loading" | "pick" | "connecting" | "error";

interface BankOption {
  bankId: string;
  bankName: string;
}

/**
 * Simulates a bank-link setup experience for the mock datasource driver.
 * 1. Fetches the list of fake banks via the driver's getSetupConfig.
 * 2. User picks a bank.
 * 3. Show fake "connecting" animation.
 * 4. Calls /create endpoint with the chosen bank as setupData.
 */
export function MockDatasourceLinkDialog({
  driver,
  open,
  onClose,
}: MockDatasourceLinkDialogProps) {
  const t = useTranslations("dataSources");
  const { orgId, createNewDataSource } = useDataSources();
  const { logEvent } = useLogUserJourneyEvent();
  const [step, setStep] = useState<Step>("loading");
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("loading");
      setBanks([]);
      setError(null);
      setSelectedBank(null);
      return;
    }

    logEvent({
      eventType: "data_sources_mock_link_dialog_opened",
      eventData: { driverType: driver.driverType },
    });
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchDriverSetupConfig(orgId, driver.driverType);
        if (cancelled) return;
        const opts = (res.setupConfig.options ??
          {}) as MockBankLinkSetupOptions;
        setBanks(opts.banks ?? []);
        logEvent({
          eventType: "data_sources_mock_link_config_loaded",
          eventData: {
            driverType: driver.driverType,
            bankCount: opts.banks?.length ?? 0,
          },
        });
        setStep("pick");
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error ? err.message : "Failed to load setup config";
        logEvent({
          eventType: "data_sources_mock_link_config_error",
          eventData: {
            driverType: driver.driverType,
            errorType: err instanceof Error ? err.name : "unknown",
          },
        });
        setError(msg);
        setStep("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, orgId, driver.driverType, logEvent]);

  const handlePick = async (bank: BankOption) => {
    logEvent({
      eventType: "data_sources_mock_bank_selected",
      eventData: {
        driverType: driver.driverType,
        bankId: bank.bankId,
        bankName: bank.bankName,
      },
    });
    setSelectedBank(bank);
    setStep("connecting");

    await new Promise((r) => setTimeout(r, 900));

    const result = await createNewDataSource(driver.driverType, {
      bankId: bank.bankId,
    });

    if (result) {
      logEvent({
        eventType: "data_sources_mock_bank_connected",
        eventData: {
          driverType: driver.driverType,
          bankId: bank.bankId,
          dataSourceId: result.id,
        },
      });
      onClose();
    } else {
      logEvent({
        eventType: "data_sources_mock_bank_connect_error",
        eventData: { driverType: driver.driverType, bankId: bank.bankId },
      });
      setStep("pick");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md"
        data-testid="mock-datasource-link-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t("mockLinkTitle")}</DialogTitle>
          <DialogDescription>{t("mockLinkDescription")}</DialogDescription>
        </DialogHeader>

        {step === "loading" && (
          <div
            className="flex items-center justify-center py-12"
            data-testid="mock-datasource-link-loading"
          >
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {step === "error" && (
          <div
            className="py-6 text-center"
            data-testid="mock-datasource-link-error"
          >
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button variant="outline" onClick={onClose}>
              {t("close")}
            </Button>
          </div>
        )}

        {step === "pick" && (
          <div
            className="space-y-2 py-2 max-h-96 overflow-y-auto"
            data-testid="mock-datasource-bank-list"
          >
            {banks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("noBanksAvailable")}
              </p>
            ) : (
              banks.map((bank) => (
                <button
                  key={bank.bankId}
                  type="button"
                  onClick={() => handlePick(bank)}
                  className="w-full flex items-center gap-3 p-3 border border-border rounded-md bg-card hover:border-primary hover:bg-accent/30 transition-colors text-left"
                  data-testid={`mock-datasource-bank-${bank.bankId}`}
                >
                  <div
                    className="rounded-md p-2 bg-primary/10 text-primary"
                    data-testid={`mock-datasource-bank-icon-${bank.bankId}`}
                  >
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div
                    className="font-medium text-foreground flex-1"
                    data-testid={`mock-datasource-bank-name-${bank.bankId}`}
                  >
                    {bank.bankName}
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {step === "connecting" && (
          <div
            className="flex flex-col items-center justify-center py-12 gap-4"
            data-testid="mock-datasource-link-connecting"
          >
            <div
              className="rounded-full bg-primary/10 p-4"
              data-testid="mock-datasource-connecting-icon"
            >
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
            <div
              className="text-center"
              data-testid="mock-datasource-connecting-copy"
            >
              <p className="font-semibold text-foreground">
                {t("connectingTo", { bank: selectedBank?.bankName ?? "" })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("mockLinkSimulationNotice")}
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
