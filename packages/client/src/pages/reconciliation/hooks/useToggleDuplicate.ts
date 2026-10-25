"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import useOrgStore from "../../../context-providers/orgStore";
import { toggleLineItemDuplicateApi } from "../../../utilities/api/toggleLineItemDuplicate";
import { useReconciliation } from "../context/ReconciliationContext";

interface UseToggleDuplicateParams {
  /** Update isDuplicate in the open context menu state (so the label flips). Optional. */
  updateContextMenuDuplicate?: (isDuplicate: boolean) => void;
}

/**
 * Provides a handler that toggles the user-set duplicate flag on a line item.
 * Optimistically patches the local source/target results in the reconciliation
 * context so the UI reflects the change immediately, then calls the API.
 * Reverts on failure.
 */
export function useToggleDuplicate({
  updateContextMenuDuplicate,
}: UseToggleDuplicateParams = {}) {
  const { org } = useOrgStore();
  const { setEntityIsDuplicate } = useReconciliation();
  const tReconciliation = useTranslations("reconciliation");

  const toggleDuplicate = useCallback(
    async (
      documentId: string,
      entityId: string,
      currentIsDuplicate: boolean
    ) => {
      if (!org?.id) return;
      const next = !currentIsDuplicate;
      try {
        setEntityIsDuplicate(entityId, next);
        updateContextMenuDuplicate?.(next);
        await toggleLineItemDuplicateApi(org.id, documentId, entityId, next);
        toast.success(
          next
            ? tReconciliation("markedAsDuplicate")
            : tReconciliation("unmarkedDuplicate")
        );
      } catch (error) {
        console.error("Failed to toggle duplicate:", error);
        setEntityIsDuplicate(entityId, currentIsDuplicate);
        updateContextMenuDuplicate?.(currentIsDuplicate);
        toast.error(tReconciliation("toggleDuplicateFailed"));
      }
    },
    [org?.id, setEntityIsDuplicate, updateContextMenuDuplicate, tReconciliation]
  );

  return { toggleDuplicate };
}
