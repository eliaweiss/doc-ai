"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  usePlaidLink,
  type PlaidLinkOnSuccessMetadata,
} from "react-plaid-link";
import type { DriverManifest } from "@zdocs/types";
import { toast } from "sonner";
import { useDataSources } from "../context/DataSourcesProvider";
import {
  createPlaidLinkToken,
  exchangePlaidPublicToken,
} from "../../../utilities/api/dataSourceApi";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

interface PlaidLinkSetupDialogProps {
  driver: DriverManifest;
  open: boolean;
  onClose: () => void;
}

export function PlaidLinkSetupDialog({
  driver,
  open,
  onClose,
}: PlaidLinkSetupDialogProps) {
  const t = useTranslations("dataSources");
  const { orgId, createNewDataSource } = useDataSources();
  const { logEvent } = useLogUserJourneyEvent();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isPlaidLaunching, setPlaidLaunching] = useState(false);
  const [isFinalizing, setFinalizing] = useState(false);
  const hasOpenedRef = useRef(false);
  const isCompletingRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setLinkToken(null);
      setPlaidLaunching(false);
      setFinalizing(false);
      hasOpenedRef.current = false;
      isCompletingRef.current = false;
      return;
    }

    setPlaidLaunching(true);
    logEvent({
      eventType: "data_sources_plaid_link_token_requested",
      eventData: { driverType: driver.driverType },
    });
    let cancelled = false;
    (async () => {
      try {
        const token = await createPlaidLinkToken(orgId);
        if (cancelled) return;
        logEvent({
          eventType: "data_sources_plaid_link_token_ready",
          eventData: { driverType: driver.driverType },
        });
        setLinkToken(token);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : t("plaidLinkTokenFailed");
        logEvent({
          eventType: "data_sources_plaid_link_token_error",
          eventData: {
            driverType: driver.driverType,
            errorType: err instanceof Error ? err.name : "unknown",
          },
        });
        toast.error(message);
        onClose();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [driver.driverType, logEvent, open, orgId, onClose, t]);

  const handleSuccess = useCallback(
    async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      isCompletingRef.current = true;
      setFinalizing(true);
      logEvent({
        eventType: "data_sources_plaid_link_success",
        eventData: {
          driverType: driver.driverType,
          institutionId: metadata.institution?.institution_id ?? null,
          institutionName: metadata.institution?.name ?? null,
          accountCount: metadata.accounts?.length ?? 0,
        },
      });
      try {
        const setupData = await exchangePlaidPublicToken(
          orgId,
          publicToken,
          metadata
        );
        logEvent({
          eventType: "data_sources_plaid_public_token_exchanged",
          eventData: {
            driverType: driver.driverType,
            institutionId: metadata.institution?.institution_id ?? null,
          },
        });
        await createNewDataSource(driver.driverType, setupData);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : t("plaidExchangeFailed");
        logEvent({
          eventType: "data_sources_plaid_setup_error",
          eventData: {
            driverType: driver.driverType,
            errorType: err instanceof Error ? err.name : "unknown",
          },
        });
        toast.error(message);
      } finally {
        isCompletingRef.current = false;
        setFinalizing(false);
        onClose();
      }
    },
    [createNewDataSource, driver.driverType, logEvent, onClose, orgId, t]
  );

  const { open: openPlaid, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: () => {
      logEvent({
        eventType: "data_sources_plaid_link_exited",
        eventData: {
          driverType: driver.driverType,
          isCompleting: isCompletingRef.current,
        },
      });
      if (!isCompletingRef.current) {
        onClose();
      }
    },
  });

  useEffect(() => {
    if (!open || !ready || hasOpenedRef.current) {
      return;
    }

    hasOpenedRef.current = true;
    setPlaidLaunching(false);
    logEvent({
      eventType: "data_sources_plaid_link_opened",
      eventData: { driverType: driver.driverType },
    });
    openPlaid();
  }, [driver.driverType, logEvent, open, openPlaid, ready]);

  if (!open || (!isPlaidLaunching && !isFinalizing)) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm"
      data-testid="plaid-link-loading-overlay"
    >
      <div
        className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-lg"
        data-testid="plaid-link-loading-card"
      >
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p
          className="text-sm font-medium text-foreground"
          data-testid="plaid-link-loading-message"
        >
          {isFinalizing ? t("plaidCreatingDataSource") : t("plaidOpeningLink")}
        </p>
      </div>
    </div>
  );
}
