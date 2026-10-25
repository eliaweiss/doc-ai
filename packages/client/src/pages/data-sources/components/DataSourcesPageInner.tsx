"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@zdocs/client-component";
import { Plus, DatabaseZap, type LucideIcon } from "lucide-react";
import { useDataSources } from "../context/DataSourcesProvider";
import { DataSourcesList } from "./DataSourcesList";
import { AddDataSourceDialog } from "./AddDataSourceDialog";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

interface DataSourcesPageInnerProps {
  translationNamespace?: string;
  headerIcon?: LucideIcon;
}

export function DataSourcesPageInner({
  translationNamespace = "dataSources",
  headerIcon: HeaderIcon = DatabaseZap,
}: DataSourcesPageInnerProps) {
  const t = useTranslations(translationNamespace);
  const { setAddDialogOpen, dataSources, isLoading } = useDataSources();
  const { logEvent } = useLogUserJourneyEvent();
  const didAutoOpenAddDialog = useRef(false);
  const didLogLoaded = useRef(false);

  const pageName = translationNamespace === "bankLinks" ? "bank_links" : "data_sources";

  useEffect(() => {
    logEvent({
      eventType: "data_sources_page_viewed",
      eventData: { page: pageName },
    });
  }, [logEvent, pageName]);

  useEffect(() => {
    if (isLoading || didLogLoaded.current) {
      return;
    }

    didLogLoaded.current = true;
    logEvent({
      eventType: "data_sources_page_loaded",
      eventData: {
        page: pageName,
        dataSourceCount: dataSources.length,
        isEmpty: dataSources.length === 0,
      },
    });
  }, [dataSources.length, isLoading, logEvent, pageName]);

  useEffect(() => {
    if (isLoading || dataSources.length > 0 || didAutoOpenAddDialog.current) {
      return;
    }

    didAutoOpenAddDialog.current = true;
    logEvent({
      eventType: "data_sources_add_dialog_auto_opened",
      eventData: { page: pageName, reason: "empty_state" },
    });
    setAddDialogOpen(true);
  }, [dataSources.length, isLoading, logEvent, pageName, setAddDialogOpen]);

  const handleAddClick = () => {
    logEvent({
      eventType: "data_sources_add_button_clicked",
      eventData: { page: pageName, source: "header" },
    });
    setAddDialogOpen(true);
  };

  const handleEmptyAddClick = () => {
    logEvent({
      eventType: "data_sources_add_button_clicked",
      eventData: { page: pageName, source: "empty_state" },
    });
    setAddDialogOpen(true);
  };

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden bg-background"
      data-testid="data-sources-page-inner"
    >
      <div
        className="border-b border-border px-6 py-4 flex items-center justify-between"
        data-testid="data-sources-header"
      >
        <div
          className="flex items-center gap-3"
          data-testid="data-sources-header-title-row"
        >
          <HeaderIcon className="w-6 h-6 text-primary" />
          <div data-testid="data-sources-header-copy">
            <h1
              className="text-2xl font-bold text-foreground"
              data-testid="data-sources-title"
            >
              {t("title")}
            </h1>
            <p
              className="text-sm text-muted-foreground"
              data-testid="data-sources-subtitle"
            >
              {t("subtitle")}
            </p>
          </div>
        </div>
        <Button
          onClick={handleAddClick}
          data-testid="add-data-source-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t("addDataSource")}
        </Button>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        data-testid="data-sources-scroll-area"
      >
        {isLoading ? (
          <div
            className="flex items-center justify-center h-64 text-muted-foreground"
            data-testid="data-sources-loading"
          >
            {t("loading")}
          </div>
        ) : dataSources.length === 0 ? (
          <EmptyState onAdd={handleEmptyAddClick} translationNamespace={translationNamespace} icon={HeaderIcon} />
        ) : (
          <DataSourcesList />
        )}
      </div>

      <AddDataSourceDialog />
    </div>
  );
}

function EmptyState({ onAdd, translationNamespace, icon: Icon }: { onAdd: () => void; translationNamespace: string; icon: LucideIcon }) {
  const t = useTranslations(translationNamespace);
  return (
    <div
      className="flex flex-col items-center justify-center h-full px-6 py-16 text-center"
      data-testid="data-sources-empty-state"
    >
      <div
        className="rounded-full bg-primary/10 p-6 mb-4"
        data-testid="data-sources-empty-icon"
      >
        <Icon className="w-10 h-10 text-primary" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        {t("emptyTitle")}
      </h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        {t("emptyDescription")}
      </p>
      <Button onClick={onAdd} data-testid="add-data-source-empty-btn">
        <Plus className="w-4 h-4 mr-2" />
        {t("connectFirst")}
      </Button>
    </div>
  );
}
