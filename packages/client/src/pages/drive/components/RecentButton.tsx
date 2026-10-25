"use client";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDocsStore, RECENT_FOLDER_ID } from "../../../context-providers/docsStore";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

export default function RecentButton() {
  const t = useTranslations("drive");
  const { currentFolderId, setCurrentFolderId } = useDocsStore();
  const { logEvent } = useLogUserJourneyEvent();
  const isSelected = currentFolderId === RECENT_FOLDER_ID;

  const handleClick = () => {
    setCurrentFolderId(RECENT_FOLDER_ID);
    logEvent({
      eventType: "browse_recent_selected",
      eventData: {},
    });
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors ${
        isSelected
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      }`}
      data-testid="sidebar-recent-button"
    >
      <Clock className="w-4 h-4 flex-shrink-0" />
      <span>{t("recent")}</span>
    </button>
  );
}
