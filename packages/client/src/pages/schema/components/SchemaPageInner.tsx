"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { LoadingDots } from "@zdocs/client-component";
import { useSchemaPage } from "../context/SchemaPageProvider";
import { SchemaSidebar } from "./SchemaSidebar";
import { SchemaDetails } from "./SchemaDetails";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

export function SchemaPageInner() {
  const { isLoading, error } = useSchemaPage();
  const [showSidebar, setShowSidebar] = useState(true);
  const t = useTranslations("schema");
  const { logEvent } = useLogUserJourneyEvent();

  const handleToggleSidebar = () => {
    const newValue = !showSidebar;
    setShowSidebar(newValue);
    logEvent({
      eventType: "schema_sidebar_toggled",
      eventData: { visible: newValue },
    });
  };

  if (isLoading) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        data-testid="schema-loading"
      >
        <LoadingDots message="Loading Schemas..." />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        data-testid="schema-error"
      >
        <div className="text-center text-destructive">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Sidebar */}
      <div
        className={`border-r border-border flex flex-col transition-all duration-200 ${showSidebar ? "w-[280px]" : "w-[50px]"
          }`}
        data-testid="schema-sidebar-container"
      >
        <div className="flex justify-between items-center p-4 border-b border-border">
          {showSidebar && (
            <h2 className="text-lg font-semibold text-foreground">
              {t("sidebarTitle")}
            </h2>
          )}
          <button
            onClick={handleToggleSidebar}
            className="p-1 hover:bg-accent rounded transition-colors"
            data-testid="toggle-sidebar-btn"
          >
            <Menu className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        {showSidebar && (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <SchemaSidebar onSchemaSelect={() => setShowSidebar(false)} />
          </div>
        )}
      </div>

      {/* Main Details Area */}
      <div
        className="flex-1 flex flex-col overflow-hidden bg-background"
        data-testid="schema-main"
      >
        <SchemaDetails />
      </div>
    </div>
  );
}

