"use client";
import { toast } from "sonner";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  ReactNode,
} from "react";
import type { GridApi } from "ag-grid-community";
import {
  type EntityResponse,
  type FieldDefinition,
  type SearchableEntityOption,
  type DateRangeShortcut,
  type ReconciliationPairWithTolerance,
  type ReconciliationPairRef,
  type ToleranceReconcileMapping,
  type ToleranceReconcilePair,
  ReconciliationObjRef,
} from "@zdocs/types";
import type { GridColumnState } from "../../../../../types/src/types/ReconciliationClientTypes";
import type { SavedReconciliationSession } from "../../../../../types/src/types/ReconciliationClientTypes";
import useOrgStore from "../../../context-providers/orgStore";
import { autoReconcile as autoReconcileFunction } from "./functions/autoReconcile";
import { useDuplicateFilter } from "../hooks/useDuplicateFilter";
import { getDayDrift } from "@zdocs/util";
import { ReconciliationContextType, ReconciliationPaneMode } from "./functions/ReconciliationContextType";
import { computeDateRangeFromShortcut } from "../../../utilities/computeDateRangeFromShortcut";


const ReconciliationContext = createContext<
  ReconciliationContextType | undefined
>(undefined);

export function ReconciliationProvider({ children }: { children: ReactNode }) {
  const { org } = useOrgStore();

  const [triggerLoadDocuments, _setTriggerLoadDocuments] = useState(0);
  const setTriggerLoadDocuments = useCallback(() => {
    _setTriggerLoadDocuments((prev) => prev + 1);
  }, []);

  // Filter state
  const [hideReconciled, setHideReconciled] = useState(false);
  const [hideDuplicates, setHideDuplicates] = useState(true);

  // Reconciled pairs state (moved up so duplicate filter can use it)
  const [allReconciledPairs, setAllReconciledPairs] = useState<
    ReconciliationPairRef[]
  >([]);
  const [reconciledPairs, setReconciledPairs] = useState<
    ReconciliationPairRef[]
  >([]);

  const linkedEntityIds = useMemo(() => {
    const ids = new Set<string>();
    for (const pair of reconciledPairs) {
      ids.add(pair.sourceRef.ref.entityId);
      ids.add(pair.targetRef.ref.entityId);
    }
    return ids;
  }, [reconciledPairs]);

  // Results state
  const [sourceResults, setSourceResults] = useState<EntityResponse[]>([]);
  const [sourceSchema, setSourceSchema] = useState<FieldDefinition[]>([]);
  const { filteredResults: sourceResultsFiltered } = useDuplicateFilter({
    unfilteredResults: sourceResults,
    hideDuplicates,
    linkedEntityIds,
  });

  const [targetResults, setTargetResults] = useState<EntityResponse[]>([]);
  const [targetSchema, setTargetSchema] = useState<FieldDefinition[]>([]);
  const { filteredResults: targetResultsFiltered } = useDuplicateFilter({
    unfilteredResults: targetResults,
    hideDuplicates,
    linkedEntityIds,
  });

  // Sidebar visibility state
  const [showSidebar, setShowSidebar] = useState(false);

  // Pane mode state (search or browse)
  const [sourcePaneMode, setSourcePaneMode] =
    useState<ReconciliationPaneMode>("search");
  const [targetPaneMode, setTargetPaneMode] =
    useState<ReconciliationPaneMode>("search");

  // Search parameters for source pane
  const [sourceEntity, setSourceEntity] =
    useState<SearchableEntityOption | null>(null);
  const [sourceEntities, setSourceEntities] = useState<SearchableEntityOption[]>(
    []
  );
  const [sourceEntityName, setSourceEntityName] = useState("");
  const [sourceQuery, setSourceQuery] = useState("");
  const [sourceDateFrom, setSourceDateFrom] = useState<string | undefined>();
  const [sourceDateTo, setSourceDateTo] = useState<string | undefined>();
  const [leftSelection, setLeftSelection] = useState<EntityResponse[]>([]);

  // Search parameters for target pane
  const [targetEntity, setTargetEntity] =
    useState<SearchableEntityOption | null>(null);
  const [targetEntities, setTargetEntities] = useState<SearchableEntityOption[]>(
    []
  );
  const [targetEntityName, setTargetEntityName] = useState("");
  const [targetQuery, setTargetQuery] = useState("");
  const [targetDateFrom, setTargetDateFrom] = useState<string | undefined>();
  const [targetDateTo, setTargetDateTo] = useState<string | undefined>();
  const [rightSelection, setRightSelection] = useState<EntityResponse[]>([]);

  // Data state for auto-populating amount
  const [leftData, setLeftData] = useState<EntityResponse[]>([]);
  const [rightData, setRightData] = useState<EntityResponse[]>([]);
  const [leftSchema, setLeftSchema] = useState<FieldDefinition[]>([]);
  const [rightSchema, setRightSchema] = useState<FieldDefinition[]>([]);

  const [amount, setAmount] = useState<number | null>(null);

  const [sourceFieldName, setSourceFieldName] = useState<string | null>(null);
  const [targetFieldName, setTargetFieldName] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(false);

  // Sign toggle state (for opposite sign values)
  const [hasOppositeSign, setHasOppositeSign] = useState(false);
  const [signChoiceMade, setSignChoiceMade] = useState(false);
  const [matchedLeftValue, setMatchedLeftValue] = useState<number | null>(null);
  const [matchedRightValue, setMatchedRightValue] = useState<number | null>(
    null
  );

  const setAmountToPositive = useCallback(() => {
    if (matchedLeftValue !== null && matchedLeftValue >= 0) {
      setAmount(matchedLeftValue);
    } else if (matchedRightValue !== null && matchedRightValue >= 0) {
      setAmount(matchedRightValue);
    }
    setSignChoiceMade(true);
  }, [matchedLeftValue, matchedRightValue]);

  const setAmountToNegative = useCallback(() => {
    if (matchedLeftValue !== null && matchedLeftValue < 0) {
      setAmount(matchedLeftValue);
    } else if (matchedRightValue !== null && matchedRightValue < 0) {
      setAmount(matchedRightValue);
    }
    setSignChoiceMade(true);
  }, [matchedLeftValue, matchedRightValue]);

  // Session tracking
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [selectedSessionName, setSelectedSessionName] = useState<string | null>(
    null
  );
  const [loadedSessionTrigger, setLoadedSessionTrigger] = useState(0);

  // Shared date filter state (applies to both panes)
  const [sharedDateFrom, setSharedDateFrom] = useState<Date | null>(null);
  const [sharedDateTo, setSharedDateTo] = useState<Date | null>(null);
  const [sharedDateRangeShortcut, setSharedDateRangeShortcut] =
    useState<DateRangeShortcut | null>(null);

  // Column state for restoration
  const [sourceColumnState, setSourceColumnState] = useState<
    GridColumnState[] | null
  >(null);
  const [targetColumnState, setTargetColumnState] = useState<
    GridColumnState[] | null
  >(null);

  // Refs for capturing current column state from grids
  const getSourceColumnStateRef = useRef<(() => GridColumnState[]) | null>(
    null
  );
  const getTargetColumnStateRef = useRef<(() => GridColumnState[]) | null>(
    null
  );

  // Grid API refs for scroll synchronization
  const sourceGridApiRef = useRef<GridApi | null>(null);
  const targetGridApiRef = useRef<GridApi | null>(null);

  // Suggested pairs state (for auto-reconcile detection)
  const [suggestedPairs, setSuggestedPairs] = useState<ReconciliationPairWithTolerance[]>(
    []
  );


  /*
  * Important note: because of a race condition (in ReconciliationSearchPane - calling checkReconciliationStatus in parallel)
  * we need to store all field reconcile mappings in a separate state and then filter out duplicates
  */
  const [allFieldReconcileMappings, setAllFieldReconcileMappings] =
    useState<{ sourceFieldName: string, targetFieldName: string, mapping: ToleranceReconcilePair }[]>([]);
  const [fieldReconcileMapping, setFieldReconcileMapping] =
    useState<ToleranceReconcileMapping>({});
  // Manual user overrides per (sourceField, targetField). Take precedence over auto-computed values.
  const [fieldMappingOverrides, setFieldMappingOverrides] =
    useState<ToleranceReconcileMapping>({});

  const resetReconciledPairs = () => {
    setReconciledPairs([]);
    setAllReconciledPairs([]);
  };

  const addToReconciledPairs = (pairs: ReconciliationPairRef[]) => {
    setAllReconciledPairs((prev) => [...prev, ...pairs]);
  };

  useEffect(() => {
    const reconciledPairs: ReconciliationPairRef[] = [];
    for (const pair of allReconciledPairs) {
      const alreadyReconciled = reconciledPairs.some(
        (p) => p.sourceRef.ref.entityId === pair.sourceRef.ref.entityId && p.targetRef.ref.entityId === pair.targetRef.ref.entityId
      );
      if (!alreadyReconciled) {
        reconciledPairs.push(pair);
      }
    }
    setReconciledPairs(reconciledPairs);
  }, [allReconciledPairs]);


  const resetFieldReconcileMapping = useCallback(() => {
    setAllFieldReconcileMappings([]);
    setFieldReconcileMapping({});
    setFieldMappingOverrides({});
  }, []);

  // Apply a manual tolerance override for a specific source/target field pair.
  // Overrides win over auto-computed values from past reconciled links.
  const updateFieldMappingOverride = useCallback(
    (
      sourceFieldName: string,
      targetFieldName: string,
      updates: Partial<ToleranceReconcilePair>
    ) => {
      setFieldMappingOverrides((prev) => {
        const existing = prev[sourceFieldName]?.[targetFieldName];
        const merged: ToleranceReconcilePair = {
          dayDrift: existing?.dayDrift ?? 0,
          sign: existing?.sign ?? "+",
          amountDrift: existing?.amountDrift ?? null,
          ...updates,
        };
        return {
          ...prev,
          [sourceFieldName]: {
            ...(prev[sourceFieldName] ?? {}),
            [targetFieldName]: merged,
          },
        };
      });
    },
    []
  );

  // Add a field sign mapping
  const addFieldReconcileMapping = useCallback(
    (
      sourceFieldName: string,
      targetFieldName: string,
      mapping: ToleranceReconcilePair
    ) => {

      setAllFieldReconcileMappings((prev) => [...prev, { sourceFieldName, targetFieldName, mapping }]);
    },
    []
  );

  useEffect(() => {
    const merged: ToleranceReconcileMapping = {};
    for (const mappingData of allFieldReconcileMappings) {
      const sourceFieldName = mappingData.sourceFieldName;
      const targetFieldName = mappingData.targetFieldName;
      const mapping = mappingData.mapping;
      const currentMapping = merged[sourceFieldName]?.[targetFieldName];
      if (currentMapping) {
        if (mapping.dayDrift > currentMapping.dayDrift) {
          currentMapping.dayDrift = mapping.dayDrift;
        }
        if (mapping.amountDrift && currentMapping.amountDrift && mapping.amountDrift > currentMapping.amountDrift) {
          currentMapping.amountDrift = mapping.amountDrift;
        }
      } else {
        merged[sourceFieldName] = {
          ...(merged[sourceFieldName] ?? {}),
          [targetFieldName]: { ...mapping },
        };
      }
    }

    // Apply manual overrides on top - these take precedence over auto-computed values.
    for (const sourceFieldName in fieldMappingOverrides) {
      const targets = fieldMappingOverrides[sourceFieldName];
      for (const targetFieldName in targets) {
        const override = targets[targetFieldName];
        const existing = merged[sourceFieldName]?.[targetFieldName];
        merged[sourceFieldName] = {
          ...(merged[sourceFieldName] ?? {}),
          [targetFieldName]: {
            dayDrift: override.dayDrift ?? existing?.dayDrift ?? 0,
            sign: override.sign ?? existing?.sign ?? "+",
            amountDrift:
              override.amountDrift !== undefined
                ? override.amountDrift
                : existing?.amountDrift ?? null,
          },
        };
      }
    }

    setFieldReconcileMapping(merged);
  }, [allFieldReconcileMappings, fieldMappingOverrides]);

  // Get a field sign mapping
  const getFieldReconcileMapping = useCallback(
    (
      sourceFieldName: string,
      targetFieldName: string
    ): ToleranceReconcilePair | undefined => {
      const fieldReconcilePair =
        fieldReconcileMapping[sourceFieldName]?.[targetFieldName];
      return fieldReconcilePair;
    },
    [fieldReconcileMapping]
  );

  // Auto-populate amount logic
  useEffect(() => {
    // Reset sign choice state when selection changes
    setSignChoiceMade(false);

    if (!leftData.length || !rightData.length) {
      // Reset opposite sign state when no data
      setHasOppositeSign(false);
      setMatchedLeftValue(null);
      setMatchedRightValue(null);
      return;
    }
    const left = leftData[0];
    const right = rightData[0];
    const columnSourceState = getSourceColumnStateRef.current?.();
    const columnTargetState = getTargetColumnStateRef.current?.();
    if (!columnSourceState || !columnTargetState) {
      console.log("no column source or target");
      return;
    }

    const columnSource = columnSourceState
      .filter((c) => {
        return c.colId.startsWith("data.");
      })
      .map((c) => c.colId.replace("data.", ""));
    const columnTarget = columnTargetState
      .filter((c) => {
        return c.colId.startsWith("data.");
      })
      .map((c) => c.colId.replace("data.", ""));

    for (const fieldLeft of columnSource) {
      const leftFieldSchema = leftSchema.find((f) => f.name === fieldLeft);
      if (!leftFieldSchema) continue;
      if (leftFieldSchema.type !== "currency") continue;
      const leftValue = left.data[fieldLeft] as number;
      if (!leftValue) continue;

      for (const fieldRight of columnTarget) {
        const rightFieldSchema = rightSchema.find((f) => f.name === fieldRight);
        if (!rightFieldSchema) continue;
        if (rightFieldSchema.type !== "currency") continue;
        const rightValue = right.data[fieldRight] as number;
        if (Math.abs(Math.abs(leftValue) - Math.abs(rightValue)) < 0.02) {
          // Store matched values for sign toggle
          setMatchedLeftValue(leftValue);
          setMatchedRightValue(rightValue);

          // Check if values have opposite signs
          const signsAreOpposite =
            (leftValue >= 0 && rightValue < 0) ||
            (leftValue < 0 && rightValue >= 0);
          setHasOppositeSign(signsAreOpposite);

          setAmount(leftValue);
          console.log("set amount", leftValue, typeof leftValue);
          setSourceFieldName(leftFieldSchema.name);
          setTargetFieldName(rightFieldSchema.name);
          const mapping = getFieldReconcileMapping(
            leftFieldSchema.name,
            rightFieldSchema.name
          );
          if (mapping && mapping.sign) {
            setAmount(leftValue * (mapping.sign === "-" ? -1 : 1));
            setSignChoiceMade(true);
          }
          if (leftFieldSchema.currencyField) {
            let currency = left.data[leftFieldSchema.currencyField] as string;
            if (!currency) {
              currency = left.preview.currency || "USD";
            }
            setCurrency(currency);
          } else {
          }
          return;
        }
      }
    }
  }, [leftData, rightData, leftSchema, rightSchema]);

  /**
   * Auto Reconcile
   * Search for pairs of source and target results that match on date,
   * and has a currency field that is the same for both source and target (amount and currency must be the same)
   * Add the pairs to the suggestedPairs state
   * The user can then review the pairs and create links for them
   */
  const autoReconcile = useCallback(() => {
    const suggestions = autoReconcileFunction(
      sourceResultsFiltered,
      targetResultsFiltered,
      sourceSchema,
      targetSchema,
      reconciledPairs,
      fieldReconcileMapping
    );
    setSuggestedPairs(suggestions);
  }, [
    sourceResults,
    targetResults,
    sourceSchema,
    targetSchema,
    reconciledPairs,
    fieldReconcileMapping,
    hideDuplicates,
  ]);

  // Auto Reconcile when sourceResults or targetResults change
  useEffect(() => {
    if (sourceResultsFiltered.length > 0 && targetResultsFiltered.length > 0) {
      autoReconcile();
    } else {
      setSuggestedPairs([]);
    }
  }, [sourceResultsFiltered, targetResultsFiltered, autoReconcile]);

  const handleSessionSelect = useCallback(
    (sessionId: string, session: SavedReconciliationSession) => {
      resetReconciledPairs();
      resetFieldReconcileMapping();
      setLeftData([]);
      setRightData([]);
      setLeftSelection([]);
      setRightSelection([]);
      setAmount(null);
      setSourceFieldName(null);
      setTargetFieldName(null);
      setCurrency("USD");
      setHasOppositeSign(false);
      setSignChoiceMade(false);
      setMatchedLeftValue(null);
      setMatchedRightValue(null);
      setSelectedSessionId(sessionId);
      setSelectedSessionName(session.name);

      // Set search parameters for source pane
      setSourceEntity(session.sourceEntity);
      setSourceEntities(session.sourceEntities || [session.sourceEntity]);
      setSourceEntityName(session.sourceEntity.displayName);
      setSourceQuery(session.sourceQuery);
      setSourceDateFrom(session.sourceDateFrom ?? undefined);
      setSourceDateTo(session.sourceDateTo ?? undefined);

      // Set search parameters for target pane
      setTargetEntity(session.targetEntity);
      setTargetEntities(session.targetEntities || [session.targetEntity]);
      setTargetEntityName(session.targetEntity.displayName);
      setTargetQuery(session.targetQuery);
      setTargetDateFrom(session.targetDateFrom ?? undefined);
      setTargetDateTo(session.targetDateTo ?? undefined);

      // Restore filter options
      setHideReconciled(session.options?.hideReconciled ?? false);
      setHideDuplicates(session.options?.hideDuplicates ?? false);

      // Restore manual tolerance overrides from session options.
      setFieldMappingOverrides(session.options?.fieldMappingOverrides ?? {});

      // Restore shared date filter
      // If dateRangeShortcut is set, recompute dates relative to today (ignore saved dates)
      if (session.options?.dateRangeShortcut) {
        setSharedDateRangeShortcut(session.options.dateRangeShortcut);
        const { from, to } = computeDateRangeFromShortcut(
          session.options.dateRangeShortcut
        );
        setSharedDateFrom(from);
        setSharedDateTo(to);
      } else {
        // No shortcut - use saved absolute dates
        setSharedDateRangeShortcut(null);
        if (session.options?.dateFrom) {
          setSharedDateFrom(new Date(session.options.dateFrom));
        } else {
          setSharedDateFrom(null);
        }
        if (session.options?.dateTo) {
          setSharedDateTo(new Date(session.options.dateTo));
        } else {
          setSharedDateTo(null);
        }
      }

      // Restore column states
      setSourceColumnState(session.options?.sourceColumnState ?? null);
      setTargetColumnState(session.options?.targetColumnState ?? null);

      // Trigger searches with the saved parameters
      setLoadedSessionTrigger((prev) => prev + 1);
    },
    []
  );

  useEffect(() => {
    setLoadedSessionTrigger((prev) => prev + 1);
  }, [hideReconciled]);

  const handleCreateLink = async () => {
    if (!org?.id) return;
    if (!canLink) return;

    setLoading(true);
    try {
      // Create links for all combinations (1:N, N:1, or N:N)
      const promises = leftSelection.flatMap((source) =>
        rightSelection.map((target) => {
          // Find the source data to extract the date
          const sourceData = leftData.find(
            (d) => d.ref.entityId === source.ref.entityId
          );
          const sourceDate = (sourceData?.data?.date ||
            sourceData?.ref.date) as string;
          const targetData = rightData.find(
            (d) => d.ref.entityId === target.ref.entityId
          );
          const targetDate = (targetData?.data?.date ||
            targetData?.ref.date) as string;
          let amountDrift = null;
          let sourceValue = null;
          let targetValue = null;
          if (sourceFieldName && targetFieldName) {
            sourceValue = source.data[sourceFieldName] as number;
            targetValue = target.data[targetFieldName] as number;
            amountDrift = Math.abs(sourceValue - targetValue);
          }

          const dayDrift = getDayDrift(sourceDate, targetDate);
          const sign = amount! < 0 ? "-" : "+";
          const fieldReconcilePair: ToleranceReconcilePair = {
            dayDrift,
            sign: sign,
            amountDrift,
          };
          if (sourceFieldName && targetFieldName) {
            addFieldReconcileMapping(
              sourceFieldName,
              targetFieldName,
              fieldReconcilePair
            );
          }

          if (
            reconciledPairs.some(
              (p) =>
                p.sourceRef.ref.entityId === source.ref.entityId &&
                p.targetRef.ref.entityId === target.ref.entityId
            )
          ) {
            toast.error("Link already exists");
            return;
          }


          const sourceRef: ReconciliationObjRef = {
            ref: source.ref,
            field: {
              name: sourceFieldName,
              value: sourceValue,
              description: source.preview.description,
            },
          };
          const targetRef: ReconciliationObjRef = {
            ref: target.ref,
            field: {
              name: targetFieldName,
              value: targetValue,
              description: target.preview.description,
            },
          };
          addToReconciledPairs([
            {
              sourceRef,
              targetRef,
              amount: Number(amount),
              currency,
              date: sourceDate,
            },
          ]);


          return fetch(`/api/org/${org.id}/reconciliation/create-link`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceRef,
              targetRef,
              amount: Number(amount),
              currency,
              date: sourceDate,
            }),
          }).then(response => {
            response.json();
            if (!response.ok) {
              throw new Error(response.statusText);
            }
            return response;
          });
        })
      );
      await Promise.all(promises);

    } catch (error) {
      console.error("Failed to create links:", error);
    } finally {
      setLoading(false);
    }
  };

  const createLinksFromPairs = async (pairs: ReconciliationPairWithTolerance[]) => {
    if (!org?.id) return;
    if (pairs.length === 0) return;

    setLoading(true);
    try {
      const promises = pairs.map((pair) => {

        // Skip if already reconciled
        if (
          reconciledPairs.some(
            (p) =>
              p.sourceRef.ref.entityId === pair.sourceRef.ref.entityId &&
              p.targetRef.ref.entityId === pair.targetRef.ref.entityId
          )
        ) {

          return Promise.resolve();
        }

        // Add to local state immediately for UI feedback
        addToReconciledPairs([
          pair,
        ]);

        if (pair.sourceRef.field.name && pair.targetRef.field.name && pair.sign) {
          const fieldReconcilePair: ToleranceReconcilePair = {
            dayDrift: getDayDrift(pair.sourceRef.ref.date, pair.targetRef.ref.date),
            sign: pair.sign,
            amountDrift: pair.sourceRef.field.value && pair.targetRef.field.value ? Math.abs(pair.sourceRef.field.value - pair.targetRef.field.value) : null,
          };

          addFieldReconcileMapping(
            pair.sourceRef.field.name,
            pair.targetRef.field.name,
            fieldReconcilePair
          );
        }

        if (!sourceEntity || !targetEntity) {
          throw new Error("Source or target entity not found");
        }


        return fetch(`/api/org/${org.id}/reconciliation/create-link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceRef: pair.sourceRef,
            targetRef: pair.targetRef,
            amount: pair.amount,
            currency: pair.currency,
            date: pair.date,
          }),
        });
      });

      await Promise.all(promises);
      toast.success(`Successfully created ${pairs.length} links`);
    } catch (error) {
      console.error("Failed to create links from pairs:", error);
      toast.error("Failed to create some links");
    } finally {
      setLoading(false);
    }
  };

  const canLink = !!(
    leftSelection.length > 0 &&
    rightSelection.length > 0 &&
    amount &&
    !loading &&
    // If opposite signs detected, user must make a choice
    (!hasOppositeSign || signChoiceMade)
  );

  // Check if the current selection (one source, one target) forms an existing link
  const isCurrentSelectionLinked =
    leftSelection.length === 1 &&
    rightSelection.length === 1 &&
    reconciledPairs.some(
      (p) =>
        p.sourceRef.ref.entityId === leftSelection[0].ref.entityId &&
        p.targetRef.ref.entityId === rightSelection[0].ref.entityId
    );

  // Remove a link from reconciledPairs
  const removeFromReconciledPairs = useCallback(
    (sourceId: string, targetId: string) => {
      setAllReconciledPairs((prev) =>
        prev.filter(
          (p) =>
            !(
              p.sourceRef.ref.entityId === sourceId &&
              p.targetRef.ref.entityId === targetId
            )
        )
      );
    },
    []
  );

  // Handle deleting a link
  const handleDeleteLink = async () => {
    if (!org?.id) return;
    if (leftSelection.length !== 1 || rightSelection.length !== 1) return;

    const sourceRef = leftSelection[0];
    const targetRef = rightSelection[0];

    setLoading(true);
    try {
      const response = await fetch(`/api/org/${org.id}/reconciliation/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceEntityId: sourceRef.ref.entityId,
          targetEntityId: targetRef.ref.entityId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete link");
      }

      // Remove from local state
      removeFromReconciledPairs(sourceRef.ref.entityId, targetRef.ref.entityId,);

      // Keep the rows selected - don't clear selections
      // This allows the user to immediately re-link if needed

      // toast.success("Link deleted successfully");
    } catch (error) {
      console.error("Failed to delete link:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete link"
      );
    } finally {
      setLoading(false);
    }
  };

  // Scroll both grids to align selected rows at the same visual position
  const scrollToAlignSelection = useCallback(() => {
    const sourceApi = sourceGridApiRef.current;
    const targetApi = targetGridApiRef.current;

    if (!sourceApi || !targetApi) return;

    // Get the selected nodes directly from the grids
    const sourceSelectedNodes = sourceApi.getSelectedNodes();
    const targetSelectedNodes = targetApi.getSelectedNodes();

    if (sourceSelectedNodes.length === 0 || targetSelectedNodes.length === 0)
      return;

    const sourceNode = sourceSelectedNodes[0];
    const targetNode = targetSelectedNodes[0];

    if (!sourceNode || !targetNode) return;

    // Get viewport elements
    const sourceGridBody = document.querySelector(
      '[data-side="source"] .ag-body-viewport'
    ) as HTMLElement;
    const targetGridBody = document.querySelector(
      '[data-side="target"] .ag-body-viewport'
    ) as HTMLElement;

    if (!sourceGridBody || !targetGridBody) return;

    const sourceRowTop = sourceNode.rowTop ?? 0;
    const targetRowTop = targetNode.rowTop ?? 0;

    // Get viewport height (assuming both are same height)
    const viewportHeight = sourceGridBody.clientHeight;

    // Position both rows at 1/3 from the top of their viewports
    // This ensures both are visible and aligned
    const targetPositionInViewport = viewportHeight / 3;

    // Use a small timeout to ensure the grid is ready
    setTimeout(() => {
      // Scroll source grid so source row is at 1/3 from top
      const newSourceScroll = Math.max(
        0,
        sourceRowTop - targetPositionInViewport
      );
      sourceGridBody.scrollTop = newSourceScroll;

      // Scroll target grid so target row is at 1/3 from top
      const newTargetScroll = Math.max(
        0,
        targetRowTop - targetPositionInViewport
      );
      targetGridBody.scrollTop = newTargetScroll;
    }, 50);
  }, []);

  const logDataToConsole = useCallback(() => {
    console.log({
      sourceSchema: sourceSchema,
      sourceResults: sourceResults,
      targetSchema: targetSchema,
      targetResults: targetResults,
      fieldReconcileMapping: fieldReconcileMapping,
      reconciledPairs: reconciledPairs,
    });
  }, [
    fieldReconcileMapping,
    sourceResults,
    sourceSchema,
    targetResults,
    targetSchema,
    reconciledPairs,
  ]);

  const setEntityIsDuplicate = useCallback(
    (entityId: string, isDuplicate: boolean) => {
      const patch = (results: EntityResponse[]) =>
        results.map((r) =>
          r.ref.entityId === entityId
            ? { ...r, data: { ...r.data, isDuplicate } }
            : r
        );

      setSourceResults((prev) =>
        prev.some((r) => r.ref.entityId === entityId) ? patch(prev) : prev
      );
      setTargetResults((prev) =>
        prev.some((r) => r.ref.entityId === entityId) ? patch(prev) : prev
      );
    },
    []
  );

  return (
    <ReconciliationContext.Provider
      value={{
        logDataToConsole,
        showSidebar,
        setShowSidebar,
        sourcePaneMode,
        setSourcePaneMode,
        targetPaneMode,
        setTargetPaneMode,
        sourceEntity,
        setSourceEntity,
        sourceEntities,
        setSourceEntities,
        sourceEntityName,
        setSourceEntityName,
        sourceQuery,
        setSourceQuery,
        sourceDateFrom,
        setSourceDateFrom,
        sourceDateTo,
        setSourceDateTo,
        leftSelection,
        setLeftSelection,
        targetEntity,
        setTargetEntity,
        targetEntities,
        setTargetEntities,
        targetEntityName,
        setTargetEntityName,
        targetQuery,
        setTargetQuery,
        targetDateFrom,
        setTargetDateFrom,
        targetDateTo,
        setTargetDateTo,
        rightSelection,
        setRightSelection,
        leftData,
        setLeftData,
        rightData,
        setRightData,
        leftSchema,
        setLeftSchema,
        rightSchema,
        setRightSchema,
        amount,
        setAmount,
        currency,
        setCurrency,
        loading,
        setLoading,
        hasOppositeSign,
        signChoiceMade,
        matchedLeftValue,
        matchedRightValue,
        setAmountToPositive,
        setAmountToNegative,
        selectedSessionId,
        setSelectedSessionId,
        selectedSessionName,
        setSelectedSessionName,
        loadedSessionTrigger,
        hideReconciled,
        setHideReconciled,
        handleSessionSelect,
        handleCreateLink,
        createLinksFromPairs,
        handleDeleteLink,
        canLink,
        isCurrentSelectionLinked,
        sourceResults: sourceResultsFiltered,
        setSourceResults,
        sourceSchema,
        setSourceSchema,
        targetResults: targetResultsFiltered,
        setTargetResults,
        targetSchema,
        setTargetSchema,
        reconciledPairs,
        resetReconciledPairs,
        addToReconciledPairs,
        suggestedPairs,
        setSuggestedPairs,
        fieldReconcileMapping: fieldReconcileMapping,
        resetFieldReconcileMapping,
        addFieldReconcileMapping,
        getFieldReconcileMapping,
        fieldMappingOverrides,
        updateFieldMappingOverride,
        hideDuplicates,
        setHideDuplicates,
        sharedDateFrom,
        setSharedDateFrom,
        sharedDateTo,
        setSharedDateTo,
        sharedDateRangeShortcut,
        setSharedDateRangeShortcut,
        sourceColumnState,
        targetColumnState,
        getSourceColumnStateRef,
        getTargetColumnStateRef,
        sourceGridApiRef,
        targetGridApiRef,
        scrollToAlignSelection,
        triggerLoadDocuments,
        setTriggerLoadDocuments,
        setEntityIsDuplicate,
      }}
    >
      {children}
    </ReconciliationContext.Provider>
  );
}

export function useReconciliation() {
  const context = useContext(ReconciliationContext);
  if (context === undefined) {
    throw new Error(
      "useReconciliation must be used within a ReconciliationProvider"
    );
  }
  return context;
}
