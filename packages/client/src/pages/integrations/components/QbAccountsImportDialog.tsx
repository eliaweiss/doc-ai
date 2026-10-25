"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Search, Check } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Checkbox,
  Label,
} from "@zdocs/client-component";
import { toast } from "sonner";
import {
  fetchQbAccountsForOrg,
  importQbAccounts,
  type QbAccountItem,
} from "../../../utilities/api/quickbooksIntegrationApi";
import { fetchDataSources } from "../../../utilities/api/dataSourceApi";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

const QB_ACCOUNT_DRIVER_TYPE = "QB_ACCOUNT";

interface QbAccountsImportDialogProps {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

export function QbAccountsImportDialog({
  orgId,
  open,
  onOpenChange,
  onImportComplete,
}: QbAccountsImportDialogProps) {
  const t = useTranslations("apps.integrations.importAccounts");
  const router = useRouter();
  const { logEvent } = useLogUserJourneyEvent();
  const [accounts, setAccounts] = useState<QbAccountItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [importedAccountIds, setImportedAccountIds] = useState<Set<string>>(new Set());

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [{ accounts: fetched }, dataSources] = await Promise.all([
        fetchQbAccountsForOrg(orgId),
        fetchDataSources(orgId),
      ]);
      setAccounts(fetched);
      setSelected(new Set());

      const alreadyImported = new Set(
        dataSources
          .filter((ds) => ds.driverType === QB_ACCOUNT_DRIVER_TYPE)
          .map((ds) => String(ds.config?.accountId ?? ""))
          .filter(Boolean)
      );
      setImportedAccountIds(alreadyImported);
      logEvent({
        eventType: "qb_accounts_import_loaded",
        eventData: {
          totalAccounts: fetched.length,
          alreadyImportedCount: alreadyImported.size,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("loadFailed");
      setFetchError(msg);
      logEvent({
        eventType: "qb_accounts_import_load_error",
        eventData: { errorType: err instanceof Error ? err.name : "unknown" },
      });
    } finally {
      setLoading(false);
    }
  }, [orgId, logEvent, t]);

  useEffect(() => {
    if (open) {
      logEvent({ eventType: "qb_accounts_import_dialog_opened" });
      void loadAccounts();
      setFilter("");
    }
  }, [open, loadAccounts, logEvent]);

  const filteredAccounts = accounts.filter((a) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.accountType.toLowerCase().includes(q) ||
      a.accountSubType.toLowerCase().includes(q)
    );
  });

  const selectableAccounts = useMemo(
    () => filteredAccounts.filter((a) => !importedAccountIds.has(a.id)),
    [filteredAccounts, importedAccountIds]
  );

  const toggleAccount = (id: string) => {
    if (importedAccountIds.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    const selectAll = selected.size !== selectableAccounts.length;
    logEvent({
      eventType: "qb_accounts_import_select_all_toggled",
      eventData: { selectAll, selectableCount: selectableAccounts.length },
    });
    if (selectAll) {
      setSelected(new Set(selectableAccounts.map((a) => a.id)));
    } else {
      setSelected(new Set());
    }
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    logEvent({
      eventType: "qb_accounts_import_submitted",
      eventData: { selectedCount: selected.size },
    });
    setImporting(true);
    try {
      const toImport = accounts
        .filter((a) => selected.has(a.id))
        .map((a) => ({
          id: a.id,
          name: a.name,
          accountType: a.accountType,
          accountSubType: a.accountSubType,
        }));

      const result = await importQbAccounts(orgId, toImport);

      logEvent({
        eventType: "qb_accounts_import_success",
        eventData: {
          createdCount: result.created.length,
          errorCount: result.errors.length,
        },
      });

      if (result.created.length > 0) {
        toast.success(t("importSuccess", { count: result.created.length }));
      }
      if (result.errors.length > 0) {
        toast.error(
          t("importPartialError", { count: result.errors.length })
        );
      }

      onOpenChange(false);

      if (result.created.length > 0) {
        if (onImportComplete) {
          onImportComplete();
        } else {
          router.push("/data-sources");
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("importFailed");
      logEvent({
        eventType: "qb_accounts_import_error",
        eventData: { errorType: err instanceof Error ? err.name : "unknown" },
      });
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg"
        data-testid="qb-accounts-import-dialog"
      >
        <DialogHeader data-testid="qb-accounts-import-dialog-header">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div
          className="flex flex-col gap-3"
          data-testid="qb-accounts-import-dialog-body"
        >
          {loading && (
            <div
              className="flex items-center justify-center py-8"
              data-testid="qb-accounts-import-loading"
            >
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {fetchError && (
            <div
              className="text-sm text-destructive py-4 text-center"
              data-testid="qb-accounts-import-error"
            >
              {fetchError}
            </div>
          )}

          {!loading && !fetchError && accounts.length === 0 && (
            <div
              className="text-sm text-muted-foreground py-4 text-center"
              data-testid="qb-accounts-import-empty"
            >
              {t("noAccounts")}
            </div>
          )}

          {!loading && !fetchError && accounts.length > 0 && (
            <>
              <div
                className="relative"
                data-testid="qb-accounts-import-filter"
              >
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("filterPlaceholder")}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="pl-9"
                  data-testid="qb-accounts-import-filter-input"
                />
              </div>

              <div
                className="flex items-center gap-2 px-1"
                data-testid="qb-accounts-import-select-all"
              >
                <Checkbox
                  id="qb-select-all"
                  checked={
                    selectableAccounts.length > 0 &&
                    selected.size === selectableAccounts.length
                  }
                  disabled={selectableAccounts.length === 0}
                  onCheckedChange={toggleAll}
                  data-testid="qb-accounts-import-select-all-checkbox"
                />
                <Label
                  htmlFor="qb-select-all"
                  className="text-xs text-muted-foreground cursor-pointer"
                >
                  {t("selectAll", { count: selectableAccounts.length })}
                </Label>
              </div>

              <div
                className="max-h-64 overflow-y-auto border rounded-md divide-y"
                data-testid="qb-accounts-import-list"
              >
                {filteredAccounts.map((account) => {
                  const isImported = importedAccountIds.has(account.id);
                  return (
                    <label
                      key={account.id}
                      className={`flex items-center gap-3 px-3 py-2 ${isImported ? "opacity-60 cursor-default" : "hover:bg-accent cursor-pointer"}`}
                      data-testid={`qb-accounts-import-item-${account.id}`}
                    >
                      {isImported ? (
                        <Check className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <Checkbox
                          checked={selected.has(account.id)}
                          onCheckedChange={() => toggleAccount(account.id)}
                          data-testid={`qb-accounts-import-checkbox-${account.id}`}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {account.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {account.accountType}
                          {account.accountSubType
                            ? ` - ${account.accountSubType}`
                            : ""}
                          {isImported && (
                            <span className="ml-2 text-green-500">
                              {t("alreadyImported")}
                            </span>
                          )}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <DialogFooter data-testid="qb-accounts-import-dialog-footer">
          <Button
            variant="outline"
            onClick={() => {
              logEvent({ eventType: "qb_accounts_import_cancelled" });
              onOpenChange(false);
            }}
            disabled={importing}
            data-testid="qb-accounts-import-cancel-btn"
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleImport}
            disabled={selected.size === 0 || importing}
            data-testid="qb-accounts-import-confirm-btn"
          >
            {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("importButton", { count: selected.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
