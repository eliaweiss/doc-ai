"use client";
import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { isMobileWidth, cn } from "@zdocs/util";
import FoldersComponent from "./Folders";
import FileDetails from "./FileDetails";
import RecentButton from "./RecentButton";
import { UploadProgressPanel } from "./UploadProgressPanel";
import GlobalDropZone from "./GlobalDropZone";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

export default function DrivePageComponent() {
  // Default to false to avoid SSR hydration mismatch, will be set correctly after mount
  const [showFolders, setShowFolders] = useState(false);
  const [isMobile, setIsMobile] = useState(() => isMobileWidth());
  const t = useTranslations("drive");
  const { logEvent } = useLogUserJourneyEvent();

  useEffect(() => {
    const mobile = isMobileWidth();
    setIsMobile(mobile);
    setShowFolders(!mobile);

    logEvent({
      eventType: "browse_drive_page_viewed",
      eventData: {
        isMobile: mobile,
        showFolders: !mobile,
      },
    });

    const handleResize = () => {
      const mobile = isMobileWidth();
      setIsMobile(mobile);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [logEvent]);

  const isMobileOverlay = isMobile && showFolders;

  return (
    <GlobalDropZone>
      <div className="h-full min-h-0 bg-background overflow-hidden flex flex-col" data-testid="drive-page">
        <div className="flex flex-1 min-h-0 relative">
          {/* Mobile backdrop overlay - only show when sidebar is open on mobile */}
          {isMobileOverlay && (
            <div
              className="absolute inset-0 bg-black/50 z-40"
              onClick={() => setShowFolders(false)}
              data-testid="mobile-sidebar-backdrop"
            />
          )}

          {/* Left Sidebar - Folders */}
          {/* On mobile when closed, hide completely. On desktop when closed, show minimized pane */}
          <div
            className={cn(
              "border-r border-border flex flex-col transition-all duration-200",
              isMobile && !showFolders && "hidden",
              isMobileOverlay
                ? "absolute inset-y-0 left-0 z-50 w-[280px] bg-background shadow-lg"
                : showFolders
                ? "w-[280px]"
                : "w-[50px]"
            )}
            data-testid="drive-sidebar"
          >
              <div className="flex justify-between items-center p-4 border-b border-border">
                {showFolders && (
                  <h2 className="text-lg font-semibold text-foreground">
                    {t("folders")}
                  </h2>
                )}
                <button
                  onClick={() => {
                    const newState = !showFolders;
                    setShowFolders(newState);
                    logEvent({
                      eventType: "browse_drive_sidebar_toggled",
                      eventData: {
                        showFolders: newState,
                        isMobile,
                      },
                    });
                  }}
                  className="p-1 hover:bg-accent rounded transition-colors"
                  data-testid="toggle-sidebar-btn"
                >
                  <Menu className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              <div
                className={cn(
                  "flex-1 overflow-y-auto p-4",
                  !showFolders && "hidden"
                )}
              >
                <FoldersComponent />
              </div>
              {showFolders && (
                <div className="border-t border-border p-4" data-testid="sidebar-recent">
                  <RecentButton />
                </div>
              )}
            </div>

          {/* Right Content - Document List */}
          <div className="flex-1 min-h-0 overflow-hidden relative" data-testid="drive-content">
            {/* Mobile hamburger button - only show when sidebar is closed on mobile */}
            {isMobile && !showFolders && (
              <button
                onClick={() => {
                  setShowFolders(true);
                  logEvent({
                    eventType: "browse_drive_sidebar_toggled",
                    eventData: {
                      showFolders: true,
                      isMobile: true,
                      source: "mobile_hamburger",
                    },
                  });
                }}
                className="absolute top-4 left-4 z-40 p-2 border border-border rounded-md shadow-sm hover:bg-accent transition-colors"
                data-testid="mobile-hamburger-btn"
              >
                <Menu className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
            <FileDetails />
          </div>
        </div>

        {/* Upload Progress Panel - Fixed bottom right */}
        <UploadProgressPanel />
      </div>
    </GlobalDropZone>
  );
}

