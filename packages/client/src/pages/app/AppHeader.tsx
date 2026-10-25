"use client";

import { Moon, Sun } from "lucide-react";
import { Button, cn, LoadingDots } from "@zdocs/client-component";
import { useAppStore } from "../../context-providers/appStore";
import { useTheme } from "../../hooks/useTheme";
import { NotificationBell } from "./NotificationBell";
import { AppSelector } from "./components/AppSelector";
import { AppLogoHeader } from "../../components/icons/AppLogoHeader";
import { UserMenu } from "../../components/UserMenu";
import { IS_DOC_VISION } from "@zdocs/util";
import { useLogUserJourneyEvent } from "../../utilities/api/logUserJourneyEventApi";


// doc-ai: the avatar menu only holds account, contact and docs items, none of which apply locally
const SHOW_USER_MENU = false;

export function AppHeader() {
  const { isLoading } = useAppStore();
  const { isDark, toggleTheme } = useTheme();
  const { logEvent } = useLogUserJourneyEvent();

  const handleToggleTheme = () => {
    toggleTheme();
    logEvent({
      eventType: "browse_header_theme_toggled",
      eventData: {
        theme: isDark ? "light" : "dark",
      },
    });
  };


  // doc-ai: no organizations in the UI, so no org-colored header border
  const headerStyle = {};



  return (
    <>
      <header
        className="bg-card border-b border-border px-6 py-3 flex-shrink-0"
        style={headerStyle}
        data-testid="app-page-header"
      >
        <div className="flex items-center justify-between">
          {/* Left side - Logo and Mode Switcher */}
          <div className="flex items-center gap-4" data-testid="app-header-left">
            <div className="flex items-center gap-2">
              <AppLogoHeader />
            </div>

            {/* Mode Switcher */}
            <AppSelector />
            {isLoading > 0 && <LoadingDots />}
          </div>

          {/* Right side - user */}
          <div className="flex items-center gap-4" data-testid="app-header-right">
            {/* doc-ai: no organization switcher, and no user menu (single local user:
                no account, logout, contact form or hosted docs). Kept behind a flag. */}
            {SHOW_USER_MENU && <UserMenu />}

            {/* Theme toggle (doc-ai: on mobile too, since the user menu that held the mobile toggle is hidden) */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex"
              onClick={handleToggleTheme}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              data-testid="app-theme-toggle"
            >
              {isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            {/* Notification Bell */}
            <NotificationBell />
          </div>
        </div>

        {/* doc-ai: Create Organization / Organization Settings dialogs removed */}

        {/* Quick Access Bar */}

      </header>
    </>
  );
}
