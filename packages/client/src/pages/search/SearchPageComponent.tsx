"use client";

import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { isMobileWidth, cn } from "@zdocs/util";
import { SavedQueriesSidebar } from "./components/SavedQueriesSidebar";
import { SearchContent } from "./components/SearchContent";
import { SearchPageProvider } from "./context/SearchPageProvider";

export default function SearchPageComponent() {
  // Default to false to avoid SSR hydration mismatch, will be set correctly after mount
  const [showSidebar, setShowSidebar] = useState(false);
  const [isMobile, setIsMobile] = useState(() => isMobileWidth());
  const t = useTranslations("search");

  useEffect(() => {
    // Set initial state after mount to avoid SSR issues
    const mobile = isMobileWidth();
    setIsMobile(mobile);
    setShowSidebar(false);

    const handleResize = () => {
      const mobile = isMobileWidth();
      setIsMobile(mobile);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobileOverlay = isMobile && showSidebar;

  return (
    <SearchPageProvider>
      <div
        className="h-full bg-background overflow-hidden"
        data-testid="search-page"
      >
        <div className="flex h-full relative">
          {/* Mobile backdrop overlay - only show when sidebar is open on mobile */}
          {isMobileOverlay && (
            <div
              className="absolute inset-0 bg-black/50 z-40"
              onClick={() => setShowSidebar(false)}
              data-testid="mobile-sidebar-backdrop"
            />
          )}

          {/* Left Sidebar - Saved Queries */}
          {/* On mobile when closed, hide completely. On desktop when closed, show minimized pane */}
          <div
            className={cn(
              "border-r border-border flex flex-col transition-all duration-200",
              isMobile && !showSidebar && "hidden",
              isMobileOverlay
                ? "absolute inset-y-0 left-0 z-50 w-[280px] bg-background shadow-lg"
                : showSidebar
                ? "w-[280px]"
                : "w-[50px]"
            )}
            data-testid="search-sidebar"
          >
            <div className="flex justify-between items-center p-4 border-b border-border">
              {showSidebar && (
                <h2 className="text-lg font-semibold text-foreground">
                  {t("savedQueries")}
                </h2>
              )}
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="p-1 hover:bg-accent rounded transition-colors"
                data-testid="toggle-sidebar-btn"
              >
                <Menu className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div
              className={cn(
                "flex-1 overflow-y-auto p-4",
                !showSidebar && "hidden"
              )}
            >
              <SavedQueriesSidebar />
            </div>
          </div>

          {/* Right Content - Search Interface */}
          <div className="flex-1 overflow-hidden relative" data-testid="search-main">
            {/* Mobile hamburger button - only show when sidebar is closed on mobile */}
            {isMobile && !showSidebar && (
              <button
                onClick={() => setShowSidebar(true)}
                className="absolute top-4 left-4 z-40 p-2 border border-border rounded-md shadow-sm hover:bg-accent transition-colors"
                data-testid="mobile-hamburger-btn"
              >
                <Menu className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
            <SearchContent />
          </div>
        </div>
      </div>
    </SearchPageProvider>
  );
}
