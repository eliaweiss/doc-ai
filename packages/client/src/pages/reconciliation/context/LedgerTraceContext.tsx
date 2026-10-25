"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import type { DateRangeShortcut, SavedLedgerTraceSession } from "@zdocs/types";
import { computeDateRangeFromShortcut } from "../../../utilities/computeDateRangeFromShortcut";

interface LedgerTraceContextType {
  // Config state
  dateFrom: Date | null;
  setDateFrom: (date: Date | null) => void;
  dateTo: Date | null;
  setDateTo: (date: Date | null) => void;
  dateRangeShortcut: DateRangeShortcut | null;
  setDateRangeShortcut: (shortcut: DateRangeShortcut | null) => void;
  maxDepth: number;
  setMaxDepth: (depth: number) => void;
  limit: number;
  setLimit: (limit: number) => void;
  startSchemaTypes: string[];
  setStartSchemaTypes: (types: string[]) => void;
  endSchemaTypes: string[];
  setEndDocTypes: (types: string[]) => void;

  // Session state
  selectedSessionId: string | null;
  setSelectedSessionId: (id: string | null) => void;
  handleSessionSelect: (session: SavedLedgerTraceSession) => void;

  // UI state
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;
}

const LedgerTraceContext = createContext<LedgerTraceContextType | undefined>(
  undefined
);

export function LedgerTraceProvider({ children }: { children: ReactNode }) {
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [dateRangeShortcut, setDateRangeShortcut] =
    useState<DateRangeShortcut | null>(null);
  const [maxDepth, setMaxDepth] = useState(10);
  const [limit, setLimit] = useState(50);
  const [startSchemaTypes, setStartSchemaTypes] = useState<string[]>([]);
  const [endSchemaTypes, setEndDocTypes] = useState<string[]>([]);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [showSidebar, setShowSidebar] = useState(true);

  const handleSessionSelect = useCallback(
    (session: SavedLedgerTraceSession) => {
      setSelectedSessionId(session.id);
      const { options } = session;

      // If dateRangeShortcut is set, recompute dates relative to today (ignore saved dates)
      if (options.dateRangeShortcut) {
        setDateRangeShortcut(options.dateRangeShortcut);
        const { from, to } = computeDateRangeFromShortcut(
          options.dateRangeShortcut
        );
        setDateFrom(from);
        setDateTo(to);
      } else {
        // No shortcut - use saved absolute dates
        setDateRangeShortcut(null);
        if (options.dateFrom) setDateFrom(new Date(options.dateFrom));
        else setDateFrom(null);

        if (options.dateTo) setDateTo(new Date(options.dateTo));
        else setDateTo(null);
      }

      setMaxDepth(options.maxDepth ?? 10);
      setLimit(options.limit ?? 50);
      setStartSchemaTypes(options.startSchemaTypes ?? []);
      setEndDocTypes(options.endSchemaTypes ?? []);
    },
    []
  );

  return (
    <LedgerTraceContext.Provider
      value={{
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo,
        dateRangeShortcut,
        setDateRangeShortcut,
        maxDepth,
        setMaxDepth,
        limit,
        setLimit,
        startSchemaTypes,
        setStartSchemaTypes,
        endSchemaTypes,
        setEndDocTypes,
        selectedSessionId,
        setSelectedSessionId,
        handleSessionSelect,
        showSidebar,
        setShowSidebar,
      }}
    >
      {children}
    </LedgerTraceContext.Provider>
  );
}

export function useLedgerTrace() {
  const context = useContext(LedgerTraceContext);
  if (context === undefined) {
    throw new Error("useLedgerTrace must be used within a LedgerTraceProvider");
  }
  return context;
}
