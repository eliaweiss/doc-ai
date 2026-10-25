"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { useTranslations } from "next-intl";
import { Database } from "lucide-react";
import type { DriverManifest, DriverSetupType } from "@zdocs/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@zdocs/client-component";
import { useDataSources } from "../context/DataSourcesProvider";
import { MockDatasourceLinkDialog } from "./MockDatasourceLinkDialog";
import { FileDatasetSetupDialog } from "./FileDatasetSetupDialog";
import { PlaidLinkSetupDialog } from "./PlaidLinkSetupDialog";
import { QbAccountsImportDialog } from "../../integrations/components/QbAccountsImportDialog";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

/**
 * Props every driver setup dialog must accept.
 * The dialog reads `driver.driverType` to know what to setup, and the
 * setup config / setup data shape via `getSetupConfig` / `completeSetup`.
 */
interface SetupDialogProps {
  driver: DriverManifest;
  open: boolean;
  onClose: () => void;
}

/**
 * Setup dialogs are dispatched by `manifest.setupType`, NOT by `driverType`.
 * This means a new driver that reuses an existing setup style (e.g. another
 * `mock_bank_link` or `file_upload` driver) gets the dialog for free.
 *
 * To wire a new setup style (e.g. `oauth`), add a component here and a
 * matching `setupType` in `@zdocs/types`.
 */
const SETUP_DIALOG_BY_TYPE: Partial<
  Record<DriverSetupType, ComponentType<SetupDialogProps>>
> = {
  mock_bank_link: MockDatasourceLinkDialog,
  file_upload: FileDatasetSetupDialog,
  plaid_link: PlaidLinkSetupDialog,
};

const PLAID_DRIVER_TYPE = "PLAID_TRANSACTIONS";
const QB_ACCOUNT_DRIVER_TYPE = "QB_ACCOUNT";
const SHOW_PLAID_UNAVAILABLE =
  process.env.NEXT_PUBLIC_SHOW_PLAID_UNAVAILABLE === "true";

export function AddDataSourceDialog() {
  const t = useTranslations("dataSources");
  const { orgId, isAddDialogOpen, setAddDialogOpen, drivers, refreshDataSources } = useDataSources();
  const [activeDriver, setActiveDriver] = useState<DriverManifest | null>(null);
  const [qbImportOpen, setQbImportOpen] = useState(false);
  const { logEvent } = useLogUserJourneyEvent();
  const previousOpenRef = useRef(false);

  useEffect(() => {
    if (isAddDialogOpen && !previousOpenRef.current) {
      logEvent({
        eventType: "data_sources_add_dialog_opened",
        eventData: {
          driverCount: drivers.length,
          availableDriverTypes: drivers.map((driver) => driver.driverType),
          plaidUnavailable: SHOW_PLAID_UNAVAILABLE,
        },
      });
    }

    if (!isAddDialogOpen && previousOpenRef.current) {
      logEvent({
        eventType: "data_sources_add_dialog_closed",
        eventData: { activeDriverType: activeDriver?.driverType ?? null },
      });
    }

    previousOpenRef.current = isAddDialogOpen;
  }, [activeDriver?.driverType, drivers, isAddDialogOpen, logEvent]);

  const handlePickDriver = (driver: DriverManifest) => {
    logEvent({
      eventType: "data_sources_driver_selected",
      eventData: {
        driverType: driver.driverType,
        setupType: driver.setupType,
        displayName: driver.displayName,
      },
    });
    setAddDialogOpen(false);

    if (driver.driverType === QB_ACCOUNT_DRIVER_TYPE) {
      setQbImportOpen(true);
      return;
    }

    setActiveDriver(driver);
  };

  const handleSetupClose = () => {
    logEvent({
      eventType: "data_sources_driver_setup_closed",
      eventData: { driverType: activeDriver?.driverType ?? null },
    });
    setActiveDriver(null);
  };

  const ActiveSetupDialog = activeDriver
    ? SETUP_DIALOG_BY_TYPE[activeDriver.setupType]
    : null;

  return (
    <>
      <Dialog
        open={isAddDialogOpen}
        onOpenChange={setAddDialogOpen}
      >
        <DialogContent
          className="max-w-2xl"
          data-testid="add-data-source-dialog"
        >
          <DialogHeader>
            <DialogTitle>{t("addDataSource")}</DialogTitle>
            <DialogDescription>{t("pickDriverDescription")}</DialogDescription>
          </DialogHeader>

          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4"
            data-testid="data-source-driver-grid"
          >
            {drivers.length === 0 && (
              <div
                className="col-span-full text-center text-sm text-muted-foreground py-8"
                data-testid="no-drivers-available"
              >
                {t("noDriversAvailable")}
              </div>
            )}
            {drivers.map((driver) => (
              <DriverOption
                key={driver.driverType}
                driver={driver}
                isUnavailable={
                  SHOW_PLAID_UNAVAILABLE &&
                  driver.driverType === PLAID_DRIVER_TYPE
                }
                onUnavailableViewed={(unavailableDriver) => {
                  logEvent({
                    eventType: "data_sources_driver_unavailable_viewed",
                    eventData: {
                      driverType: unavailableDriver.driverType,
                      reason: "region_unavailable",
                    },
                  });
                }}
                onSelect={() => handlePickDriver(driver)}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {activeDriver && ActiveSetupDialog && (
        <ActiveSetupDialog
          driver={activeDriver}
          open={!!activeDriver}
          onClose={handleSetupClose}
        />
      )}

      <QbAccountsImportDialog
        orgId={orgId}
        open={qbImportOpen}
        onOpenChange={setQbImportOpen}
        onImportComplete={refreshDataSources}
      />
    </>
  );
}

function DriverOption({
  driver,
  isUnavailable,
  onUnavailableViewed,
  onSelect,
}: {
  driver: DriverManifest;
  isUnavailable?: boolean;
  onUnavailableViewed?: (driver: DriverManifest) => void;
  onSelect: () => void;
}) {
  const accentColor = driver.color || "#10b981";
  const t = useTranslations("dataSources");
  const didLogUnavailableViewed = useRef(false);

  useEffect(() => {
    if (!isUnavailable || didLogUnavailableViewed.current) {
      return;
    }

    didLogUnavailableViewed.current = true;
    onUnavailableViewed?.(driver);
  }, [driver, isUnavailable, onUnavailableViewed]);

  if (isUnavailable) {
    return (
      <div
        className="p-4 border border-border rounded-lg bg-card sm:col-span-2"
        data-testid={`driver-option-unavailable-${driver.driverType}`}
      >
        <div
          className="flex items-start gap-3"
          data-testid={`driver-option-unavailable-content-${driver.driverType}`}
        >
          <div
            className="rounded-md p-2 flex-shrink-0 bg-muted text-muted-foreground"
            data-testid={`driver-option-unavailable-icon-${driver.driverType}`}
          >
            <Database className="w-5 h-5" />
          </div>
          <div
            className="min-w-0 flex-1"
            data-testid={`driver-option-unavailable-copy-${driver.driverType}`}
          >
            <div
              className="font-semibold text-foreground"
              data-testid={`driver-option-unavailable-title-${driver.driverType}`}
            >
              {t("plaidUnavailableTitle")}
            </div>
            <div
              className="text-xs text-muted-foreground mt-1"
              data-testid={`driver-option-unavailable-description-${driver.driverType}`}
            >
              {t("plaidUnavailableMessage")}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className="text-left p-4 border border-border rounded-lg bg-card hover:border-primary hover:bg-accent/30 transition-colors"
      data-testid={`driver-option-${driver.driverType}`}
    >
      <div
        className="flex items-start gap-3"
        data-testid={`driver-option-content-${driver.driverType}`}
      >
        <div
          className="rounded-md p-2 flex-shrink-0"
          style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
          data-testid={`driver-option-icon-${driver.driverType}`}
        >
          <Database className="w-5 h-5" />
        </div>
        <div
          className="min-w-0 flex-1"
          data-testid={`driver-option-copy-${driver.driverType}`}
        >
          <div
            className="font-semibold text-foreground"
            data-testid={`driver-option-title-${driver.driverType}`}
          >
            {driver.displayName}
          </div>
          <div
            className="text-xs text-muted-foreground mt-1 line-clamp-2"
            data-testid={`driver-option-description-${driver.driverType}`}
          >
            {driver.description}
          </div>
        </div>
      </div>
    </button>
  );
}
