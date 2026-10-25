"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Database, Download, ExternalLink, Loader2 } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zdocs/client-component";
import { toast } from "sonner";
import { fetchDataSources } from "../../../utilities/api/dataSourceApi";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";
import { YouTube } from "../../apps/components/YouTube";
import type { IntegrationDefinition } from "./IntegrationDefinition";

const ACTION_BUTTON_CLASS = "min-w-0 w-full md:w-auto";
const DATA_SOURCES_PATH = "/data-sources";

interface IntegrationCardProps {
  definition: IntegrationDefinition;
  orgId: string;
}

export function IntegrationCard({ definition, orgId }: IntegrationCardProps) {
  const t = useTranslations("apps.integrations");
  const router = useRouter();
  const { logEvent } = useLogUserJourneyEvent();
  const [statusLoading, setStatusLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [accountDataSourceCount, setAccountDataSourceCount] = useState(0);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const { id, i18n, logo, video, ImportDialog } = definition;

  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const data = await definition.fetchStatus(orgId);
      setConnectionId(data.connectionId);
      setDisplayName(data.displayName);
      setConnected(data.connected);
      logEvent({
        eventType: `integrations_${id}_status_loaded`,
        eventData: {
          orgId,
          connected: data.connected,
          hasDisplayName: Boolean(data.displayName),
        },
      });
    } catch {
      toast.error(t(i18n.connectFailed));
      setConnected(false);
      setConnectionId(null);
      setDisplayName(null);
    } finally {
      setStatusLoading(false);
    }
  }, [orgId, definition, id, i18n.connectFailed, t, logEvent]);

  const refreshAccountDataSources = useCallback(async () => {
    try {
      const dataSources = await fetchDataSources(orgId);
      setAccountDataSourceCount(
        dataSources.filter(
          (ds) => ds.driverType === definition.accountDriverType
        ).length
      );
    } catch {
      setAccountDataSourceCount(0);
    }
  }, [orgId, definition.accountDriverType]);

  useEffect(() => {
    void refreshStatus();
    void refreshAccountDataSources();
  }, [refreshStatus, refreshAccountDataSources]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const flag = params.get(definition.queryParam);
    if (!flag) return;

    window.history.replaceState({}, "", window.location.pathname);

    if (flag === "connected") {
      toast.success(t(i18n.connectedToast));
      logEvent({
        eventType: `integrations_${id}_connected`,
        eventData: { orgId },
      });
      void refreshStatus();
      return;
    }

    const oauthKey = i18n.oauthErrors[flag];
    if (oauthKey) {
      logEvent({
        eventType: `integrations_${id}_oauth_error`,
        eventData: { orgId, errorFlag: flag },
      });
      toast.error(t(oauthKey));
    }
  }, [definition.queryParam, i18n, id, logEvent, orgId, refreshStatus, t]);

  const handleConnect = async () => {
    setActionLoading(true);
    try {
      logEvent({
        eventType: `integrations_${id}_connect_clicked`,
        eventData: { orgId },
      });
      const { authorizationUrl } = await definition.startOAuth(orgId);
      toast.info(t(i18n.connectStarted));
      window.open(authorizationUrl, "_blank", "noopener");
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : "";
      const notConfigured =
        rawMessage.includes("503") ||
        rawMessage.toLowerCase().includes("not configured");
      toast.error(notConfigured ? t(i18n.notConfigured) : t(i18n.connectFailed));
      logEvent({
        eventType: `integrations_${id}_connect_error`,
        eventData: { orgId, message: rawMessage || "unknown" },
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setActionLoading(true);
    try {
      await definition.disconnect(orgId);
      toast.success(t(i18n.disconnectedToast));
      logEvent({
        eventType: `integrations_${id}_disconnected`,
        eventData: { orgId },
      });
      setConnected(false);
      setConnectionId(null);
      setDisplayName(null);
    } catch {
      toast.error(t(i18n.disconnectFailed));
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDataSources = () => {
    logEvent({
      eventType: `integrations_${id}_view_imported_accounts_clicked`,
      eventData: { orgId, dataSourceCount: accountDataSourceCount },
    });
    router.push(DATA_SOURCES_PATH);
  };

  return (
    <>
      <Card data-testid={`integrations-${id}-card`}>
        <div
          className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between"
          data-testid={`integrations-${id}-card-layout`}
        >
          <div
            className="flex min-w-0 flex-1 flex-col gap-6"
            data-testid={`integrations-${id}-main`}
          >
            <CardHeader
              className="p-0"
              data-testid={`integrations-${id}-card-header`}
            >
              <div
                className="flex items-center gap-3"
                data-testid={`integrations-${id}-card-title-row`}
              >
                <div
                  className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white p-1.5 shadow-sm ${id === "quickbooks" ? "h-20" : "h-14 w-14"
                    }`}
                  data-testid={`integrations-${id}-icon-wrap`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logo.src}
                    alt=""
                    className="h-full w-full object-contain"
                    aria-hidden="true"
                  />
                </div>
                <div
                  className="min-w-0 flex-1 flex flex-col"
                  data-testid={`integrations-${id}-title-copy`}
                >
                  <CardTitle className="text-lg">{t(i18n.title)}</CardTitle>
                  <CardDescription className="mt-1">
                    {t(i18n.description)}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent
              className="flex flex-col gap-4 p-0"
              data-testid={`integrations-${id}-card-content`}
            >
              {statusLoading ? (
                <div
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  data-testid={`integrations-${id}-status-loading`}
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("statusLoading")}
                </div>
              ) : connected && connectionId ? (
                <div
                  className="flex min-w-0 flex-1 flex-col gap-0.5"
                  data-testid={`integrations-${id}-connected-label`}
                >
                  {displayName && (
                    <p className="truncate text-sm font-medium text-foreground">
                      {displayName}
                    </p>
                  )}
                  <p className="break-words text-sm text-muted-foreground">
                    {t(i18n.connectedDescription, { connectionId })}
                  </p>
                </div>
              ) : (
                <p
                  className="text-sm text-muted-foreground"
                  data-testid={`integrations-${id}-disconnected-label`}
                >
                  {t(i18n.idle)}
                </p>
              )}

              <div
                className="flex w-full flex-wrap gap-2"
                data-testid={`integrations-${id}-actions`}
              >
                {connected ? (
                  <>
                    {ImportDialog && (
                      <Button
                        type="button"
                        variant="outline"
                        className={ACTION_BUTTON_CLASS}
                        onClick={() => {
                          logEvent({
                            eventType: `integrations_${id}_import_accounts_clicked`,
                            eventData: { orgId },
                          });
                          setImportDialogOpen(true);
                        }}
                        data-testid={`integrations-${id}-import-accounts-btn`}
                      >
                        <Download className="h-4 w-4 mr-1.5" />
                        {t("importAccountsBtn")}
                      </Button>
                    )}
                    {accountDataSourceCount > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        className={ACTION_BUTTON_CLASS}
                        onClick={handleOpenDataSources}
                        data-testid={`integrations-${id}-view-accounts-btn`}
                      >
                        <Database className="h-4 w-4 mr-1.5" />
                        {t("viewImportedAccounts", {
                          count: accountDataSourceCount,
                        })}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      className={ACTION_BUTTON_CLASS}
                      asChild
                      data-testid={`integrations-${id}-open-btn`}
                    >
                      <a
                        href={definition.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          logEvent({
                            eventType: `integrations_${id}_open_clicked`,
                            eventData: { orgId },
                          });
                        }}
                      >
                        <ExternalLink className="h-4 w-4 mr-1.5" />
                        {t(i18n.openExternal)}
                      </a>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={ACTION_BUTTON_CLASS}
                      disabled={actionLoading}
                      onClick={() => {
                        logEvent({
                          eventType: `integrations_${id}_disconnect_clicked`,
                          eventData: { orgId },
                        });
                        void handleDisconnect();
                      }}
                      data-testid={`integrations-${id}-disconnect-btn`}
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        t(i18n.disconnect)
                      )}
                    </Button>
                  </>
                ) : definition.connectButton ? (
                  <div
                    className="flex items-center gap-2"
                    data-testid={`integrations-${id}-connect-wrap`}
                  >
                    <button
                      type="button"
                      disabled={actionLoading || statusLoading}
                      onClick={() => void handleConnect()}
                      data-testid={`integrations-${id}-connect-btn`}
                      aria-label={t(i18n.connect)}
                      className="group relative inline-flex shrink-0 cursor-pointer items-center rounded transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ height: definition.connectButton.height }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={definition.connectButton.defaultSrc}
                        alt={t(i18n.connect)}
                        width={definition.connectButton.width}
                        height={definition.connectButton.height}
                        className="block h-full w-auto group-hover:hidden"
                        data-testid={`integrations-${id}-connect-btn-img`}
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={definition.connectButton.hoverSrc}
                        alt=""
                        aria-hidden="true"
                        width={definition.connectButton.width}
                        height={definition.connectButton.height}
                        className="hidden h-full w-auto group-hover:block"
                      />
                    </button>
                    {actionLoading && (
                      <Loader2
                        className="h-4 w-4 animate-spin text-muted-foreground"
                        data-testid={`integrations-${id}-connect-loading`}
                      />
                    )}
                  </div>
                ) : (
                  <Button
                    type="button"
                    className={ACTION_BUTTON_CLASS}
                    disabled={actionLoading || statusLoading}
                    onClick={() => void handleConnect()}
                    data-testid={`integrations-${id}-connect-btn`}
                  >
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      t(i18n.connect)
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </div>

          {video && (
            <div
              className="w-full shrink-0 md:w-[300px]"
              data-testid={`integrations-${id}-video`}
            >
              <YouTube
                src={video.src}
                title={video.title}
                thumbnail={video.thumbnail}
                size="sm"
                dataTestid={`integrations-${id}-youtube`}
                onPlay={() => {
                  logEvent({
                    eventType: `integrations_${id}_video_played`,
                    eventData: { orgId },
                  });
                }}
              />
            </div>
          )}
        </div>
      </Card>

      {ImportDialog && (
        <ImportDialog
          orgId={orgId}
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onImportComplete={() => {
            void refreshAccountDataSources();
            router.push(DATA_SOURCES_PATH);
          }}
        />
      )}
    </>
  );
}
