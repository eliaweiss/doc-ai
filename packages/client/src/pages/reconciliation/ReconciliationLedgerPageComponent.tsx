"use client";

import { Button } from "@zdocs/client-component";
import { useTranslations } from "next-intl";
import { TraceModeView } from "./components/TraceModeView";
import { SavedLedgerTraceSessionsSidebar } from "./components/SavedLedgerTraceSessionsSidebar";
import {
  LedgerTraceProvider,
  useLedgerTrace,
} from "./context/LedgerTraceContext";
import { Menu } from "lucide-react";

function ReconciliationLedgerContent() {
  const t = useTranslations("reconciliation");
  const { showSidebar, setShowSidebar } = useLedgerTrace();

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="p-4 border-b flex-shrink-0 flex justify-between items-center bg-background">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSidebar(!showSidebar)}
            className="md:hidden"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">{t("ledger.title")}</h1>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Saved Trace Sessions (only in trace mode) */}
        <div
          className={`border-r border-border flex flex-col transition-all duration-200 ${showSidebar ? "w-[280px]" : "w-[0px] overflow-hidden"
            }`}
          data-testid="ledger-trace-sidebar"
        >
          <div className="flex justify-between items-center p-4 border-b border-border min-w-[280px]">
            <h2 className="text-lg font-semibold text-foreground">
              {t("ledger.sessions.title")}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSidebar(false)}
              className="hidden md:flex"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto min-w-[280px]">
            <SavedLedgerTraceSessionsSidebar />
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden p-6">
          <TraceModeView data-testid="ledger-trace-view" />
        </main>
      </div>
    </div>
  );
}

export default function ReconciliationLedgerPageComponent() {

  return (
    <LedgerTraceProvider>
      <ReconciliationLedgerContent />
    </LedgerTraceProvider>
  );
}
