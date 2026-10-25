"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Document,
  FieldDefinition,
  getLineItemsForCollection,
  ExtractionStatus,
  DocumentTypeRecord,
} from "@zdocs/types";
import { formatDate, exportDocumentToCSV } from "@zdocs/util";
import {
  FileText,
  Calendar,
  Tag,
  Info,
  Loader2,
  Plus,
  Sparkles,
  Search,
  Trash,
  Download,
  FileDown,
  FolderInput,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@zdocs/client-component";
import { Checkbox } from "@zdocs/client-component";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@zdocs/client-component";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@zdocs/client-component";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@zdocs/client-component";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@zdocs/client-component";
import { extractDocumentData } from "../../../utilities/api/extractDocumentData";
import {
  updateDocumentData,
  UpdateDocumentDataRequest,
  UpdateDocumentDataResponse,
} from "../../../utilities/api/updateDocumentData";
import { LineItemsGrid, LineItemEdit } from "./LineItemsGrid";
import { updateDocument } from "../../../utilities/api/updateDocument";
import { indexDocumentApi } from "../../../utilities/api/indexDocument";
import { toast } from "sonner";
import { EditableField } from "./EditableField";
import { SchemaFieldRenderer } from "./SchemaFieldRenderer";
import { ColumnState, GridApi } from "ag-grid-community";
import { useConfirm } from "packages/client/src/context-providers/confirm-provider/ConfirmProvider";
import { fetchDeleteDocument } from "packages/client/src/utilities/api/fetchDeleteDocument";
import { fetchReconciliationLinksForDocument } from "packages/client/src/utilities/api/fetchReconciliationLinksForDocument";
import { useRouter } from "next/navigation";
import { useDocumentViewStore } from "../../../context-providers/documentViewStore";
import { fetchDocumentTypes } from "../../../utilities/api/fetchDocumentTypes";
import { changeDocumentType } from "../../../utilities/api/changeDocumentType";
import { fetchDocumentStatuses } from "../../../utilities/api/fetchDocumentStatuses";
import { updateDocumentType } from "../../../utilities/api/updateDocumentType";
import { NotificationBanner } from "./NotificationBanner";
import useOrgStore from "../../../context-providers/orgStore";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";
import { MoveDocumentModal } from "../../drive/components/MoveDocumentModal";
import { QuickBooksPushDialog } from "./QuickBooksPushDialog";
import { QuickBooksManageDialog } from "./QuickBooksManageDialog";
import {
  fetchQbDocumentStatus,
  type QbDocumentStatus,
} from "../../../utilities/api/quickbooksDocumentApi";
import { QB_ACCOUNT_DOC_TYPE_PREFIX, XERO_ACCOUNT_DOC_TYPE_PREFIX } from "@zdocs/types";
import { XeroPushDialog } from "./xero-push/XeroPushDialog";
import { XeroManageDialog } from "./XeroManageDialog";
import {
  fetchXeroDocumentStatus,
  type XeroDocumentStatus,
} from "../../../utilities/api/xeroDocumentApi";
import { AddLineItemDialog } from "./AddLineItemDialog";
import { RemoveLineItemsDialog } from "./RemoveLineItemsDialog";

export function DocumentDataPane() {
  const router = useRouter();
  const { org } = useOrgStore();
  const { logEvent } = useLogUserJourneyEvent();
  const {
    document,
    documentData,
    documentType,
    setDocument,
    setDocumentData,
    setDocumentType,
    getFolderId,
    loadDocument,
  } = useDocumentViewStore();

  const t = useTranslations("documentPage");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState("fields");
  const [availableDocTypes, setAvailableDocTypes] = useState<
    DocumentTypeRecord[]
  >([]);
  const [isChangingType, setIsChangingType] = useState(false);
  const [showForceExtractDialog, setShowForceExtractDialog] = useState(false);
  const [forceExtract, setForceExtract] = useState(true);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [qbStatus, setQbStatus] = useState<QbDocumentStatus | null>(null);
  const [xeroStatus, setXeroStatus] = useState<XeroDocumentStatus | null>(null);
  const [showQbPushDialog, setShowQbPushDialog] = useState(false);
  const [showQbManageDialog, setShowQbManageDialog] = useState(false);
  const [showXeroPushDialog, setShowXeroPushDialog] = useState(false);
  const [showXeroManageDialog, setShowXeroManageDialog] = useState(false);
  const [addLineItemCollectionKey, setAddLineItemCollectionKey] = useState<
    string | null
  >(null);
  const [removeLineItemCollectionKey, setRemoveLineItemCollectionKey] =
    useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Local state for editing
  const [localDocument, setLocalDocument] = useState<Document | null>(document);
  const [localHeaderData, setLocalHeaderData] = useState<Record<
    string,
    unknown
  > | null>(documentData?.headerData || null);
  const [localLineItems, setLocalLineItems] = useState<Record<
    string,
    Record<string, unknown>[]
  > | null>(() => {
    if (!documentData?.lineItems) return null;
    if (Array.isArray(documentData.lineItems)) return null;
    return documentData.lineItems;
  });
  const [visibleHeaderSchema, setVisibleHeaderSchema] = useState<
    FieldDefinition[]
  >(() => documentType?.headerSchema?.filter((field) => !field.hidden) || []);
  const [lineItemColumnStates, setLineItemColumnStates] = useState<
    Record<string, ColumnState[]>
  >({});
  const isDatasetDocument = document?.isDataset === true;

  // Fetch available document types on mount
  useEffect(() => {
    fetchDocumentTypes()
      .then(setAvailableDocTypes)
      .catch((error) => {
        console.error("Error fetching document types:", error);
      });
  }, []);

  const refreshQbStatus = useCallback(() => {
    const orgId = org?.id;
    const docId = document?.id;
    if (!orgId || !docId || isDatasetDocument) {
      setQbStatus(null);
      return;
    }
    fetchQbDocumentStatus(orgId, docId)
      .then(setQbStatus)
      .catch(() => setQbStatus(null));
  }, [org?.id, document?.id, isDatasetDocument]);

  useEffect(() => {
    refreshQbStatus();
  }, [refreshQbStatus]);

  const refreshXeroStatus = useCallback(() => {
    const orgId = org?.id;
    const docId = document?.id;
    if (!orgId || !docId || isDatasetDocument) {
      setXeroStatus(null);
      return;
    }
    fetchXeroDocumentStatus(orgId, docId)
      .then(setXeroStatus)
      .catch(() => setXeroStatus(null));
  }, [org?.id, document?.id, isDatasetDocument]);

  useEffect(() => {
    refreshXeroStatus();
  }, [refreshXeroStatus]);

  // Poll for document status every 5 seconds if not INDEXED
  useEffect(() => {
    // Only poll if document exists and is not INDEXED
    if (!document || document.extractionStatus === "INDEXED") {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    const documentId = document.id;
    const currentStatus = document.extractionStatus;

    // Poll function
    const pollStatus = async () => {
      try {
        const statuses = await fetchDocumentStatuses([documentId]);
        if (statuses.length > 0 && statuses[0].extractionStatus) {
          const newStatus = statuses[0].extractionStatus as ExtractionStatus;

          // If status changed, reload the full document
          if (newStatus !== currentStatus) {
            // Stop polling before reloading
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }

            // Reload full document data from the store
            await loadDocument(documentId);
          }
        }
      } catch (error) {
        console.error("Error polling document status:", error);
      }
    };

    // Start polling every 5 seconds (not immediately to avoid double-fetch on mount)
    pollingIntervalRef.current = setInterval(pollStatus, 5000);

    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
    // Use document.id and extractionStatus to control when effect re-runs
  }, [document, document?.id, document?.extractionStatus, loadDocument]);


  // Sync local state when document/data changes from store
  useEffect(() => {
    if (document) {
      setLocalDocument(document);
    }
  }, [document]);

  useEffect(() => {
    const filteredSchema =
      documentType?.headerSchema?.filter((field) => !field.hidden) || [];
    setVisibleHeaderSchema((prev) => {
      const isSameOrder =
        prev.length === filteredSchema.length &&
        prev.every((field, index) => field.name === filteredSchema[index].name);
      return isSameOrder ? prev : filteredSchema;
    });
  }, [documentType?.headerSchema]);

  useEffect(() => {
    setLocalHeaderData(documentData?.headerData || null);
    savedHeaderDataRef.current = documentData?.headerData || null;
    // Clear edits when data is updated from props
    setHeaderDataEdits({});
    headerDataEditsRef.current = {};
  }, [documentData?.headerData]);

  useEffect(() => {
    if (documentData?.lineItems) {
      // Handle both array and object formats
      if (Array.isArray(documentData.lineItems)) {
        // If it's an array, we need to convert it to the expected format
        // This shouldn't happen in normal flow, but handle it gracefully
        setLocalLineItems(null);
      } else {
        setLocalLineItems(documentData.lineItems);
      }
    } else {
      setLocalLineItems(null);
    }
  }, [documentData?.lineItems]);

  useEffect(() => {
    setLineItemColumnStates({});
  }, [document?.id, documentType?.id]);


  // Track edits
  const [documentEdits, setDocumentEdits] = useState<
    Record<string, string | null>
  >({});
  const [headerDataEdits, setHeaderDataEdits] = useState<
    Record<string, unknown>
  >({});
  const headerDataEditsRef = useRef<Record<string, unknown>>({});
  const savedHeaderDataRef = useRef<Record<string, unknown> | null>(
    documentData?.headerData || null
  );

  // Refs for line item edits
  const lineItemEditsRef = useRef<Map<string, LineItemEdit>>(new Map());
  const gridApiRef = useRef<GridApi<Record<string, unknown>> | null>(null);



  const getExtractionStatusLabel = (status: string) => {
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "EXTRACTED":
      case "INDEXED":
        return "text-green-500 bg-green-500/20";
      case "PARTIAL":
        return "text-yellow-500 bg-yellow-500/20";
      case "RETRYING":
        return "text-yellow-500 bg-yellow-500/20";
      case "FAILED":
        return "text-red-500 bg-red-500/20";
      case "PENDING":
      default:
        return "text-blue-500 bg-blue-500/20";
    }
  };

  const handleForceReExtract = async () => {
    logEvent({
      eventType: "document_force_extract_opened",
      eventData: {
        documentId: document?.id,
      },
    });
    setShowForceExtractDialog(true);
  };

  const handleForceExtractConfirm = async () => {
    if (!document) return;
    logEvent({
      eventType: "document_force_extract_confirmed",
      eventData: {
        documentId: document.id,
        forceExtract,
      },
    });
    setShowForceExtractDialog(false);
    setIsExtracting(true);
    setLocalHeaderData(null);
    setLocalLineItems(null);
    setDocumentData(null);
    savedHeaderDataRef.current = null;
    setDocumentEdits({});
    setHeaderDataEdits({});
    headerDataEditsRef.current = {};
    lineItemEditsRef.current = new Map();
    setHasUnsavedChanges(false);
    setDocument({
      ...document,
      extractionStatus: "PARTIAL",
    });
    try {
      const response = await extractDocumentData(document.id, forceExtract);
      if (!response.success) {
        toast.error(t("extractionFailed"));
        return;
      }
      if (response.mode === "lambda") {
        toast.success(t("extractionQueued"));
        return;
      }
      setLocalHeaderData(response.headerData);
      savedHeaderDataRef.current = response.headerData;
      // Handle lineItems type conversion
      if (response.lineItems && !Array.isArray(response.lineItems)) {
        setLocalLineItems(response.lineItems);
      } else {
        setLocalLineItems(null);
      }
      setDocumentData({
        headerData: response.headerData,
        lineItems: response.lineItems,
        totalAmount: response.denormalized.amount
          ? String(response.denormalized.amount)
          : null,
        documentDate: response.denormalized.date
          ? String(response.denormalized.date)
          : null,
        dueDate: response.denormalized.dueDate
          ? String(response.denormalized.dueDate)
          : null,
      });
      logEvent({
        eventType: "document_force_extract_success",
        eventData: {
          documentId: document.id,
          mode: response.mode,
        },
      });
      toast.success(t("extractionComplete"));
    } catch (error) {
      console.error("Error extracting data:", error);
      logEvent({
        eventType: "document_force_extract_error",
        eventData: {
          documentId: document.id,
        },
      });
      toast.error(t("extractionFailed"));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleForceExtractCancel = () => {
    logEvent({
      eventType: "document_force_extract_cancelled",
      eventData: {
        documentId: document?.id,
      },
    });
    setShowForceExtractDialog(false);
    setForceExtract(true); // Reset to default
  };



  const handleIndex = async () => {
    if (!document) return;
    logEvent({
      eventType: "document_index_clicked",
      eventData: {
        documentId: document.id,
      },
    });
    setIsIndexing(true);
    try {
      const response = await indexDocumentApi(document.id);
      logEvent({
        eventType: "document_index_success",
        eventData: {
          documentId: document.id,
          indexedCount: response.indexed,
        },
      });
      toast.success(t("indexingComplete", { count: response.indexed }));
    } catch (error) {
      console.error("Error indexing document:", error);
      logEvent({
        eventType: "document_index_error",
        eventData: {
          documentId: document.id,
        },
      });
      toast.error(t("indexingFailed"));
    } finally {
      setIsIndexing(false);
    }
  };

  const handleDownload = async () => {
    if (!document) return;
    logEvent({
      eventType: "document_download_csv_clicked",
      eventData: {
        documentId: document.id,
      },
    });
    setIsDownloading(true);
    try {
      // Use latest local state for export if available, otherwise fallback to store
      const exportDoc = localDocument || document;
      const exportData = {
        ...documentData,
        headerData: localHeaderData || documentData?.headerData || null,
        lineItems: localLineItems || documentData?.lineItems || null,
      } as any;

      exportDocumentToCSV(exportDoc, exportData, documentType);
      logEvent({
        eventType: "document_download_csv_success",
        eventData: {
          documentId: document.id,
        },
      });
      toast.success(t("downloadComplete"));
    } catch (error) {
      console.error("Error exporting CSV:", error);
      logEvent({
        eventType: "document_download_csv_error",
        eventData: {
          documentId: document.id,
        },
      });
      toast.error(t("downloadFailed"));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadOriginal = async () => {
    if (!document) return;
    logEvent({
      eventType: "document_download_original_clicked",
      eventData: {
        documentId: document.id,
      },
    });
    setIsDownloading(true);
    try {
      const fileName = document.fileName || "document";
      const url = `/api/uploads/${document.id}/${encodeURIComponent(fileName)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const a = window.document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
      logEvent({
        eventType: "document_download_original_success",
        eventData: {
          documentId: document.id,
        },
      });
      toast.success(t("downloadOriginalComplete"));
    } catch (error) {
      console.error("Error downloading original document:", error);
      logEvent({
        eventType: "document_download_original_error",
        eventData: {
          documentId: document.id,
        },
      });
      toast.error(t("downloadOriginalFailed"));
    } finally {
      setIsDownloading(false);
    }
  };

  const confirm = useConfirm();

  const handleDelete = async () => {
    if (!document) return;
    const reconciliationLinks = await fetchReconciliationLinksForDocument(
      document.id
    );

    const ok = await confirm({
      title: `Delete this item?`,
      message:
        reconciliationLinks?.length > 0
          ? `This will remove ${reconciliationLinks.length} reconciliation links.`
          : "",
    });

    if (ok) {
      logEvent({
        eventType: "document_delete_confirmed",
        eventData: {
          documentId: document.id,
          reconciliationLinksCount: reconciliationLinks?.length || 0,
        },
      });
      setIsDeleting(true);
      try {
        const response = await fetchDeleteDocument(document.id);
        console.log("handleDelete response", response);
        logEvent({
          eventType: "document_delete_success",
          eventData: {
            documentId: document.id,
          },
        });
        toast.success(t("deletionComplete"));
        const folderId = getFolderId();
        if (folderId) {
          router.push(`/folder/${folderId}`);
        } else {
          router.push("/folder");
        }
      } catch (error) {
        console.error("Error deleting document:", error);
        logEvent({
          eventType: "document_delete_error",
          eventData: {
            documentId: document.id,
          },
        });
        toast.error(t("deletionFailed"));
      } finally {
        setIsDeleting(false);
      }
    } else {
      logEvent({
        eventType: "document_delete_cancelled",
        eventData: {
          documentId: document.id,
        },
      });
    }
  };

  const handleLineItemEditChange = useCallback(
    (edits: Map<string, LineItemEdit>) => {
      const hasLineItemEdits = edits.size > 0;
      const hasHeaderEdits = Object.keys(headerDataEditsRef.current).length > 0;
      const hasDocumentEdits = Object.keys(documentEdits).length > 0;
      setHasUnsavedChanges(
        hasLineItemEdits || hasHeaderEdits || hasDocumentEdits
      );
    },
    [documentEdits]
  );

  const applySavedDocumentData = useCallback(
    (savedDocumentData: UpdateDocumentDataResponse["documentData"]) => {
      if (savedDocumentData.headerData) {
        setLocalHeaderData(savedDocumentData.headerData);
        savedHeaderDataRef.current = savedDocumentData.headerData;
      }

      if (savedDocumentData.lineItems) {
        if (Array.isArray(savedDocumentData.lineItems)) {
          setLocalLineItems(null);
        } else {
          setLocalLineItems(savedDocumentData.lineItems);
        }
      }

      setDocumentData({
        headerData: savedDocumentData.headerData,
        lineItems: savedDocumentData.lineItems,
        totalAmount: savedDocumentData.totalAmount,
        documentDate: savedDocumentData.documentDate
          ? String(savedDocumentData.documentDate)
          : null,
        dueDate: savedDocumentData.dueDate
          ? String(savedDocumentData.dueDate)
          : null,
      });
    },
    [setDocumentData]
  );

  const getLineItemsWithPendingEdits = useCallback(() => {
    if (!localLineItems) return null;

    const updatedLineItems: Record<string, Record<string, unknown>[]> = {};
    for (const collectionKey of Object.keys(localLineItems)) {
      const collectionItems = getLineItemsForCollection(
        localLineItems,
        collectionKey
      );
      updatedLineItems[collectionKey] = collectionItems.map((item) => {
        const itemId = item.id as string | undefined;
        const edit = itemId ? lineItemEditsRef.current.get(itemId) : undefined;
        return edit ? { ...item, ...edit.editedData } : item;
      });
    }

    return updatedLineItems;
  }, [localLineItems]);

  const persistLineItems = useCallback(
    async (nextLineItems: Record<string, Record<string, unknown>[]>) => {
      if (!document) return;

      setIsSaving(true);
      try {
        const response = await updateDocumentData(document.id, {
          lineItems: nextLineItems,
        });

        applySavedDocumentData(response.documentData);
        lineItemEditsRef.current = new Map();
        setHasUnsavedChanges(
          Object.keys(headerDataEditsRef.current).length > 0 ||
            Object.keys(documentEdits).length > 0
        );
      } catch (error) {
        console.error("Error saving line item changes:", error);
        logEvent({
          eventType: "document_line_items_save_error",
          eventData: {
            documentId: document.id,
          },
        });
        toast.error(t("changesSaveFailed"));
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [applySavedDocumentData, document, documentEdits, logEvent, t]
  );

  const handleAddLineItem = useCallback(
    async (collectionKey: string, lineItem: Record<string, unknown>) => {
      const currentLineItems = getLineItemsWithPendingEdits();
      if (!currentLineItems) return;

      const nextLineItems = {
        ...currentLineItems,
        [collectionKey]: [
          ...(currentLineItems[collectionKey] || []),
          lineItem,
        ],
      };

      await persistLineItems(nextLineItems);
      setAddLineItemCollectionKey(null);
      logEvent({
        eventType: "document_line_item_added",
        eventData: {
          documentId: document?.id,
          collectionKey,
        },
      });
      toast.success(t("lineItemAdded"));
    },
    [document?.id, getLineItemsWithPendingEdits, logEvent, persistLineItems, t]
  );

  const handleRemoveLineItems = useCallback(
    async (collectionKey: string, rowIds: string[]) => {
      const currentLineItems = getLineItemsWithPendingEdits();
      if (!currentLineItems) return;

      const rowIdSet = new Set(rowIds);
      const nextLineItems = {
        ...currentLineItems,
        [collectionKey]: (currentLineItems[collectionKey] || []).filter(
          (item, index) => {
            const rowId =
              typeof item.id === "string" ? item.id : `line-item-${index}`;
            return !rowIdSet.has(rowId);
          }
        ),
      };

      await persistLineItems(nextLineItems);
      setRemoveLineItemCollectionKey(null);
      logEvent({
        eventType: "document_line_items_removed",
        eventData: {
          documentId: document?.id,
          collectionKey,
          count: rowIds.length,
        },
      });
      toast.success(t("lineItemsRemoved", { count: rowIds.length }));
    },
    [document?.id, getLineItemsWithPendingEdits, logEvent, persistLineItems, t]
  );

  const handleLineItemColumnStateChange = useCallback(
    async (collectionKey: string, columnState: ColumnState[]) => {
      setLineItemColumnStates((prev) => {
        const previousState = prev[collectionKey];
        const hasChanged =
          !previousState ||
          previousState.length !== columnState.length ||
          previousState.some((column, index) => {
            const next = columnState[index];
            return (
              column.colId !== next.colId ||
              column.width !== next.width ||
              column.hide !== next.hide ||
              column.pinned !== next.pinned
            );
          });

        if (!hasChanged) {
          return prev;
        }

        logEvent({
          eventType: "document_line_item_column_changed",
          eventData: {
            documentId: document?.id,
            collectionKey,
          },
        });

        return {
          ...prev,
          [collectionKey]: columnState,
        };
      });

      if (!documentType?.id || !documentType.lineItemSchemas?.[collectionKey]) {
        return;
      }

      const collection = documentType.lineItemSchemas[collectionKey];
      const fieldMap = new Map(collection.fields.map((field) => [field.name, field]));
      const stateByColumnId = new Map(
        columnState
          .filter((column) => column.colId)
          .map((column) => [column.colId as string, column])
      );
      const updatedFields: FieldDefinition[] = [];

      for (const column of columnState) {
        const field = fieldMap.get(column.colId || "");
        if (!field) {
          continue;
        }

        updatedFields.push({
          ...field,
          width: column.width ?? field.width,
          pinned:
            column.pinned === "left" || column.pinned === "right"
              ? column.pinned
              : undefined,
        });
      }

      const missingFields: FieldDefinition[] = collection.fields
        .filter((field) => !stateByColumnId.has(field.name))
        .map((field) => ({
          ...field,
        }));
      const nextFields = [...updatedFields, ...missingFields];

      const hasSameSchemaState =
        nextFields.length === collection.fields.length &&
        nextFields.every((field, index) => {
          const currentField = collection.fields[index];
          return (
            field.name === currentField?.name &&
            field.width === currentField?.width &&
            field.pinned === currentField?.pinned
          );
        });

      if (hasSameSchemaState) {
        return;
      }

      try {
        const updatedDocumentType = await updateDocumentType(documentType.id, {
          lineItemSchemas: {
            ...documentType.lineItemSchemas,
            [collectionKey]: {
              ...collection,
              fields: nextFields,
            },
          },
        });

        setDocumentType(updatedDocumentType);
        logEvent({
          eventType: "document_line_item_column_saved",
          eventData: {
            documentId: document?.id,
            collectionKey,
          },
        });
      } catch (error) {
        console.error("Error saving line item column order:", error);
        logEvent({
          eventType: "document_line_item_column_save_error",
          eventData: {
            documentId: document?.id,
            collectionKey,
          },
        });
        toast.error(t("changesSaveFailed"));
      }
    },
    [documentType, setDocumentType, t, document?.id, logEvent]
  );

  const handleHeaderFieldChange = useCallback(
    (fieldName: string, value: unknown) => {
      // Update local state immediately
      setLocalHeaderData((prev) => ({
        ...(prev || {}),
        [fieldName]: value,
      }));

      // Track the edit in both state and ref
      setHeaderDataEdits((prev) => {
        const updated = {
          ...prev,
          [fieldName]: value,
        };
        headerDataEditsRef.current = updated;
        return updated;
      });

      logEvent({
        eventType: "document_header_field_edited",
        eventData: {
          documentId: document?.id,
          fieldName,
        },
      });
      setHasUnsavedChanges(true);
    },
    [document?.id, logEvent]
  );

  const handleDocumentFieldChange = useCallback(
    (field: keyof Document, value: string) => {
      if (!localDocument) return;
      logEvent({
        eventType: "document_field_edited",
        eventData: {
          documentId: localDocument.id,
          fieldName: field,
        },
      });
      setLocalDocument((prev) => {
        if (!prev) return prev;
        return { ...prev, [field]: value || null };
      });
      setDocumentEdits((prev) => ({
        ...prev,
        [field]: value || null,
      }));
      setHasUnsavedChanges(true);
    },
    [localDocument, logEvent]
  );

  const handleDocTypeChange = useCallback(
    async (docType: string) => {
      if (!document || isChangingType) return;

      const newDocType = docType || null;
      // Don't do anything if the type hasn't changed
      if (document.docType === newDocType) return;

      const currentType = documentType?.displayName;
      const newDocumentType = availableDocTypes.find(
        (type) => type.name === newDocType
      );
      const newType = newDocumentType?.displayName;

      const ok = await confirm({
        title: `Change document type?`,
        message: `This will clear all extracted data and start over. ${currentType} -> ${newType}`,
      });

      if (ok) {
        logEvent({
          eventType: "document_type_change_confirmed",
          eventData: {
            documentId: document.id,
            fromType: document.docType,
            toType: newDocType,
          },
        });
        setIsChangingType(true);
        try {
          const response = await changeDocumentType(document.id, newDocType);

          // Update store with new data
          setDocument(response.document);
          setDocumentType(response.documentType);
          setDocumentData(response.documentData);

          // Update local state
          setLocalDocument(response.document);
          setLocalHeaderData(response.documentData?.headerData || null);
          savedHeaderDataRef.current =
            response.documentData?.headerData || null;

          // Handle lineItems type conversion
          if (
            response.documentData?.lineItems &&
            !Array.isArray(response.documentData.lineItems)
          ) {
            setLocalLineItems(response.documentData.lineItems);
          } else {
            setLocalLineItems(null);
          }

          // Clear any pending edits since we've reset the data
          setDocumentEdits({});
          setHeaderDataEdits({});
          headerDataEditsRef.current = {};
          lineItemEditsRef.current = new Map();
          setHasUnsavedChanges(false);

          logEvent({
            eventType: "document_type_change_success",
            eventData: {
              documentId: document.id,
              fromType: document.docType,
              toType: newDocType,
            },
          });
          toast.success(
            t("changesSaved") || "Document type changed successfully"
          );
        } catch (error) {
          console.error("Error changing document type:", error);
          logEvent({
            eventType: "document_type_change_error",
            eventData: {
              documentId: document.id,
              fromType: document.docType,
              toType: newDocType,
            },
          });
          toast.error(
            t("extractionFailed") || "Failed to change document type"
          );
        } finally {
          setIsChangingType(false);
        }
      } else {
        logEvent({
          eventType: "document_type_change_cancelled",
          eventData: {
            documentId: document.id,
            fromType: document.docType,
            toType: newDocType,
          },
        });
      }
    },
    [
      availableDocTypes,
      confirm,
      document,
      documentType?.displayName,
      isChangingType,
      setDocument,
      setDocumentType,
      setDocumentData,
      t,
      logEvent,
    ]
  );

  const handleSaveAll = useCallback(async () => {
    if (!document) return;
    setIsSaving(true);

    try {
      // Save document edits if any
      if (Object.keys(documentEdits).length > 0) {
        const response = await updateDocument(document.id, documentEdits);
        setLocalDocument(response.document);
        setDocument(response.document);
        setDocumentEdits({});
      }

      // Save header data and line item edits
      const hasHeaderEdits = Object.keys(headerDataEditsRef.current).length > 0;
      const hasLineItemEdits = lineItemEditsRef.current.size > 0;

      if (hasHeaderEdits || hasLineItemEdits) {
        const updateRequest: UpdateDocumentDataRequest = {};

        if (hasHeaderEdits) {
          // Merge edits with current data
          updateRequest.headerData = {
            ...(localHeaderData || {}),
            ...headerDataEditsRef.current,
          };
        }

        if (hasLineItemEdits && localLineItems) {
          // Apply line item edits across all collections
          const updatedLineItems: Record<string, Record<string, unknown>[]> =
            {};
          for (const collectionKey of Object.keys(localLineItems)) {
            const collectionItems = getLineItemsForCollection(
              localLineItems,
              collectionKey
            );
            updatedLineItems[collectionKey] = collectionItems.map((item) => {
              const edit = lineItemEditsRef.current.get(item.id as string);
              return edit ? { ...item, ...edit.editedData } : item;
            });
          }
          updateRequest.lineItems = updatedLineItems;
        }

        const response = await updateDocumentData(document.id, updateRequest);

        // Update local state with saved data
        if (response.documentData.headerData) {
          setLocalHeaderData(response.documentData.headerData);
          savedHeaderDataRef.current = response.documentData.headerData;
        }
        if (response.documentData.lineItems) {
          if (Array.isArray(response.documentData.lineItems)) {
            setLocalLineItems(null);
          } else {
            setLocalLineItems(response.documentData.lineItems);
          }
        }

        setHeaderDataEdits({});
        headerDataEditsRef.current = {};
        lineItemEditsRef.current = new Map();

        // Update store with saved data
        setDocumentData({
          headerData: response.documentData.headerData,
          lineItems: response.documentData.lineItems,
          totalAmount: response.documentData.totalAmount,
          documentDate: response.documentData.documentDate
            ? String(response.documentData.documentDate)
            : null,
          dueDate: response.documentData.dueDate
            ? String(response.documentData.dueDate)
            : null,
        });
      }

      setHasUnsavedChanges(false);
      logEvent({
        eventType: "document_save_success",
        eventData: {
          documentId: document.id,
          hasHeaderEdits,
          hasLineItemEdits,
          hasDocumentEdits: Object.keys(documentEdits).length > 0,
        },
      });
      toast.success(t("changesSaved"));
    } catch (error) {
      console.error("Error saving changes:", error);
      logEvent({
        eventType: "document_save_error",
        eventData: {
          documentId: document.id,
        },
      });
      toast.error(t("changesSaveFailed"));
    } finally {
      setIsSaving(false);
    }
  }, [
    document,
    documentEdits,
    localHeaderData,
    localLineItems,
    setDocument,
    setDocumentData,
    t,
    logEvent,
  ]);

  // Autosave: whenever hasUnsavedChanges becomes true, trigger save
  useEffect(() => {
    if (hasUnsavedChanges && !isSaving) {
      handleSaveAll();
    }
  }, [hasUnsavedChanges, isSaving, handleSaveAll]);

  // Render schema-driven header fields
  const renderHeaderFields = () => {
    if (!visibleHeaderSchema.length || !localHeaderData) return null;

    return (
      <div
        className="space-y-2 text-sm"
        data-testid="header-fields"
      >
        {visibleHeaderSchema.map((field) => (
          <div
            key={field.name}
            className="flex items-center gap-2"
            data-testid={`header-field-${field.name}`}
          >
            <span className="text-xs text-muted-foreground w-28 shrink-0">
              {field.displayName}
            </span>
            <SchemaFieldRenderer
              field={field}
              value={localHeaderData[field.name]}
              onChange={(value) => handleHeaderFieldChange(field.name, value)}
              currency={localDocument?.currency}
              className="text-foreground"
              data-testid={`header-field-${field.name}-value`}
            />
          </div>
        ))}
      </div>
    );
  };

  const hasExtractedData = localHeaderData !== null;
  const lineItemTabCollections = useMemo(
    () =>
      hasExtractedData && localLineItems && documentType?.lineItemSchemas
        ? Object.keys(localLineItems).flatMap((collectionKey) => {
          const lineItems = getLineItemsForCollection(
            localLineItems,
            collectionKey
          );
          const schema =
            documentType.lineItemSchemas?.[collectionKey]?.fields || null;
          const collectionDisplayName =
            documentType.lineItemSchemas?.[collectionKey]?.displayName ||
            collectionKey;

          if (!schema) {
            return [];
          }

          return [
            {
              key: collectionKey,
              tabValue: `table-${collectionKey}`,
              displayName: collectionDisplayName,
              lineItems,
              schema,
            },
          ];
        })
        : [],
    [documentType?.lineItemSchemas, hasExtractedData, localLineItems]
  );

  useEffect(() => {
    const availableTabs = new Set([
      "fields",
      ...lineItemTabCollections.map((collection) => collection.tabValue),
    ]);

    if (!availableTabs.has(activeTab)) {
      setActiveTab("fields");
    }
  }, [activeTab, lineItemTabCollections]);

  const isExtractionInProgress =
    document?.extractionStatus === "PENDING" ||
    document?.extractionStatus === "PARTIAL" ||
    document?.extractionStatus === "RETRYING";

  const isExtractionBusy = isExtractionInProgress || isExtracting;

  // Asymptotic progress bar state
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [showProgressBar, setShowProgressBar] = useState(false);
  const progressStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (isExtractionBusy) {
      setShowProgressBar(true);
      progressStartRef.current = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - (progressStartRef.current ?? Date.now());
        setExtractionProgress(90 * (1 - Math.exp(-elapsed / 25000)));
      }, 100);
      return () => clearInterval(interval);
    } else if (showProgressBar) {
      setExtractionProgress(100);
      const timeout = setTimeout(() => {
        setShowProgressBar(false);
        setExtractionProgress(0);
        progressStartRef.current = null;
      }, 800);
      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExtractionBusy]);

  // Early return if no document
  if (!document) {
    return null;
  }

  return (
    <div
      className="h-full flex flex-col bg-card relative"
      data-testid="document-data-pane"
    >
      {/* Saving indicator */}
      {isSaving && (
        <div
          className="absolute top-3 right-4 z-10"
          data-testid="document-saving-indicator"
        >
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Header */}
      <div
        className="px-4 py-3 border-b border-border flex items-center justify-start gap-4"
        data-testid="document-data-header"
      >
        <h2 className="text-lg font-semibold text-foreground">
          {isDatasetDocument ? t("datasetInfo") : t("documentInfo")}
        </h2>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleIndex}
                  disabled={isIndexing || isExtractionBusy}
                  data-testid="index-document-btn"
                  title={isExtractionBusy ? undefined : t("indexDocument")}
                >
                  {isIndexing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </span>
            </TooltipTrigger>
            {isExtractionBusy && (
              <TooltipContent>
                <p>{t("extractionInProgressTooltip")}</p>
              </TooltipContent>
            )}
          </Tooltip>

          {!isDatasetDocument && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleForceReExtract}
                    disabled={isExtractionBusy}
                    data-testid="force-re-extract-document-btn"
                    title={isExtractionBusy ? undefined : t("extractData")}
                  >
                    {isExtracting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {isExtractionBusy && (
                <TooltipContent>
                  <p>{t("extractionInProgressTooltip")}</p>
                </TooltipContent>
              )}
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isDownloading || isExtractionBusy}
                      data-testid="download-document-btn"
                      title={isExtractionBusy ? undefined : t("downloadData")}
                    >
                      {isDownloading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" data-testid="download-dropdown-menu">
                    <DropdownMenuItem
                      onClick={handleDownload}
                      data-testid="download-csv-option"
                    >
                      <Download className="w-4 h-4" />
                      {t("downloadDataCSV")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleDownloadOriginal}
                      data-testid="download-original-option"
                    >
                      <FileDown className="w-4 h-4" />
                      {t("downloadOriginalDoc")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </span>
            </TooltipTrigger>
            {isExtractionBusy && (
              <TooltipContent>
                <p>{t("extractionInProgressTooltip")}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            logEvent({
              eventType: "document_move_button_clicked",
              eventData: { documentId: document?.id },
            });
            setShowMoveModal(true);
          }}
          data-testid="change-folder-btn"
          title={t("changeFolder")}
        >
          <FolderInput className="w-4 h-4" />
        </Button>
        {!isDatasetDocument && qbStatus?.connected && (() => {
          const isQbSourced = document?.docType?.startsWith(QB_ACCOUNT_DOC_TYPE_PREFIX) ?? false;
          const isXeroSourced = document?.docType?.startsWith(XERO_ACCOUNT_DOC_TYPE_PREFIX) ?? false;
          const isIntegrationSourced = isQbSourced || isXeroSourced;
          const alreadyInQb = qbStatus.synced || isIntegrationSourced;
          const tooltip = isIntegrationSourced
            ? t("quickbooks.alreadyInQbAccount")
            : alreadyInQb && qbStatus.entityType
              ? t("quickbooks.alreadySynced", { type: t(`quickbooks.entityType.${qbStatus.entityType}`) })
              : alreadyInQb
                ? t("quickbooks.alreadySyncedGeneric")
                : t("quickbooks.sendToQb");
          return (
            <Button
              variant={alreadyInQb ? "ghost" : "outline"}
              size="sm"
              onClick={() => {
                if (alreadyInQb && !isIntegrationSourced) {
                  logEvent({
                    eventType: "document_qb_manage_button_clicked",
                    eventData: { documentId: document?.id },
                  });
                  setShowQbManageDialog(true);
                } else if (!alreadyInQb) {
                  logEvent({
                    eventType: "document_qb_push_button_clicked",
                    eventData: { documentId: document?.id },
                  });
                  setShowQbPushDialog(true);
                }
              }}
              disabled={isIntegrationSourced}
              data-testid="quickbooks-push-btn"
              title={tooltip}
            >
              {alreadyInQb ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/svg/qbo_ball_logo.svg" alt="QuickBooks" className="w-4 h-4" />
              )}
            </Button>
          );
        })()}
        {!isDatasetDocument && xeroStatus?.connected && (() => {
          const isQbSourced = document?.docType?.startsWith(QB_ACCOUNT_DOC_TYPE_PREFIX) ?? false;
          const isXeroSourced = document?.docType?.startsWith(XERO_ACCOUNT_DOC_TYPE_PREFIX) ?? false;
          const isIntegrationSourced = isQbSourced || isXeroSourced;
          const alreadyInXero = xeroStatus.synced || isIntegrationSourced;
          const tooltip = isIntegrationSourced
            ? t("xero.alreadyInXeroAccount")
            : alreadyInXero && xeroStatus.entityType
              ? t("xero.alreadySynced", { type: t(`xero.entityType.${xeroStatus.entityType}`) })
              : alreadyInXero
                ? t("xero.alreadySyncedGeneric")
                : t("xero.sendToXero");
          return (
            <Button
              variant={alreadyInXero ? "ghost" : "outline"}
              size="sm"
              onClick={() => {
                if (alreadyInXero && !isIntegrationSourced) {
                  logEvent({
                    eventType: "document_xero_manage_button_clicked",
                    eventData: { documentId: document?.id },
                  });
                  setShowXeroManageDialog(true);
                } else if (!alreadyInXero) {
                  logEvent({
                    eventType: "document_xero_push_button_clicked",
                    eventData: { documentId: document?.id },
                  });
                  setShowXeroPushDialog(true);
                }
              }}
              disabled={isIntegrationSourced}
              data-testid="xero-push-btn"
              title={tooltip}
            >
              {alreadyInXero ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/svg/xero_logo.webp" alt="Xero" className="w-4 h-4" />
              )}
            </Button>
          );
        })()}
        {!isDatasetDocument && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            data-testid="delete-document-btn"
            title={t("deleteDocument")}
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>

      {/* Content */}
      <div
        className="flex-1 flex flex-col overflow-hidden p-4"
        data-testid="document-data-content"
      >
        {/* Extraction In Progress Banner + Progress Bar */}
        {showProgressBar && (
          <div
            className="mb-3 space-y-2"
            data-testid="extraction-in-progress-banner"
          >
            <div className="flex items-center gap-3">
              {isExtractionBusy && (
                <Loader2 className="w-4 h-4 animate-spin text-blue-500 shrink-0" />
              )}
              <span className="text-sm text-blue-500 font-medium">
                {t("extractionInProgress")}
              </span>
            </div>
            <div
              className="h-1.5 w-full rounded-full bg-blue-500/10 overflow-hidden"
              data-testid="extraction-progress-bar"
            >
              <div
                className="h-full rounded-full bg-blue-500 transition-[width] duration-700 ease-out"
                style={{ width: `${extractionProgress}%` }}
                data-testid="extraction-progress-fill"
              />
            </div>
          </div>
        )}

        {/* Notification Banner */}
        {documentData?.notifications &&
          documentData.notifications.length > 0 &&
          org?.id && (
            <NotificationBanner
              orgId={org.id}
              notifications={documentData.notifications}
              documentId={document?.id}
              onNotificationUpdate={() => {
                // Reload document data to get updated notifications
                if (document?.id) {
                  loadDocument(document.id);
                }
              }}
            />
          )}

        {/* Fields / Tables Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            logEvent({
              eventType: "document_tab_selected",
              eventData: {
                documentId: document?.id,
                tab: value,
                previousTab: activeTab,
              },
            });
            setActiveTab(value);
          }}
          data-testid="document-data-tabs"
          className="flex-1 flex flex-col overflow-hidden "
        >
          <TabsList
            data-testid="document-tabs-list"
            className="w-full shrink-0 justify-start overflow-x-auto overflow-y-hidden whitespace-nowrap rounded-none border-b border-border bg-transparent p-0 h-auto gap-1.5"
          >
            <TabsTrigger
              value="fields"
              data-testid="tab-fields"
              className="shrink-0 cursor-pointer rounded-t-md rounded-b-none border border-b-0 px-4 py-2 bg-gray-200 text-gray-600 border-gray-300 hover:bg-gray-300 hover:text-gray-800 data-[state=active]:border-blue-500 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-none data-[state=active]:mb-[-1px] data-[state=active]:font-semibold"
            >
              {t("fieldsTab")}
              {visibleHeaderSchema.length > 0 && (
                <span className="ml-1.5 text-xs text-blue-600 underline">
                  {visibleHeaderSchema.length}
                </span>
              )}
            </TabsTrigger>
            {lineItemTabCollections.map((collection) => (
              <TabsTrigger
                key={collection.key}
                value={collection.tabValue}
                data-testid={`tab-${collection.key}`}
                className="shrink-0 cursor-pointer rounded-t-md rounded-b-none border border-b-0 px-4 py-2 bg-gray-200 text-gray-600 border-gray-300 hover:bg-gray-300 hover:text-gray-800 data-[state=active]:border-blue-500 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-none data-[state=active]:mb-[-1px] data-[state=active]:font-semibold"
              >
                {collection.displayName}
                <span className="ml-1.5 text-xs text-blue-600 underline">
                  {collection.lineItems.length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Fields Tab - Document Info + Header Fields */}
          <TabsContent
            value="fields"
            data-testid="tab-content-fields"
            className="flex-1 overflow-auto mt-1 border-2 border-border rounded-md p-0"
          >
            <div
              data-testid="section-basic-info"
              className="divide-y divide-border/50 text-sm [&>div:nth-child(odd)]:bg-muted/40"
            >
              <div
                className="flex items-center gap-2 px-4 py-2.5"
                data-testid="field-filename"
                title={t("fileName")}
              >
                <span className="text-xs text-muted-foreground w-28 shrink-0">
                  {t("fileName")}
                </span>
                <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <EditableField
                  value={localDocument?.fileName || ""}
                  onChange={(value) =>
                    handleDocumentFieldChange("fileName", value)
                  }
                  className="text-foreground"
                  placeholder={t("untitled")}
                  data-testid="field-filename-value"
                />
              </div>

              <div
                className="flex items-center gap-2 px-4 py-2.5"
                data-testid="field-type"
                title={t("documentType")}
              >
                <span className="text-xs text-muted-foreground w-28 shrink-0">
                  {t("documentType")}
                </span>
                <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <select
                  value={localDocument?.docType || ""}
                  onChange={(e) => handleDocTypeChange(e.target.value)}
                  disabled={isChangingType}
                  className="bg-transparent border-none text-sm focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="field-type-select"
                >
                  <option value="">{t("unknownType")}</option>
                  {availableDocTypes.map((type) => (
                    <option key={type.name} value={type.name}>
                      {type.displayName ||
                        type.name
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className="flex items-center gap-2 px-4 py-2.5"
                data-testid="field-status"
                title={t("extractionStatus")}
              >
                <span className="text-xs text-muted-foreground w-28 shrink-0">
                  {t("extractionStatus")}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium text-xs ${getStatusColor(
                    document.extractionStatus
                  )}`}
                >
                  {isExtractionBusy ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Info className="w-3 h-3" />
                  )}
                  {isExtractionBusy
                    ? t("extractionInProgressLabel")
                    : getExtractionStatusLabel(document.extractionStatus)}
                </span>
              </div>

              <div
                className="flex items-center gap-2 px-4 py-2.5"
                data-testid="field-updated"
                title={t("updatedAt")}
              >
                <span className="text-xs text-muted-foreground w-28 shrink-0">
                  {t("updatedAt")}
                </span>
                <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-foreground text-sm">
                  {formatDate(document.updatedAt)}
                </span>
              </div>
              {localDocument?.description && (
                <div
                  className="flex items-start gap-2 px-4 py-2.5"
                  data-testid="field-description"
                >
                  <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">
                    {t("description")}
                  </span>
                  <EditableField
                    value={localDocument.description || ""}
                    onChange={(value) =>
                      handleDocumentFieldChange("description", value)
                    }
                    className="text-sm text-foreground"
                    placeholder={t("noDescription") || "No description"}
                    data-testid="field-description-value"
                  />
                </div>
              )}

              {hasExtractedData && visibleHeaderSchema.length > 0 && localHeaderData &&
                visibleHeaderSchema.map((field) => (
                  <div
                    key={field.name}
                    className="flex items-center gap-2 px-4 py-2.5"
                    data-testid={`header-field-${field.name}`}
                  >
                    <span className="text-xs text-muted-foreground w-28 shrink-0">
                      {field.displayName}
                    </span>
                    <SchemaFieldRenderer
                      field={field}
                      value={localHeaderData[field.name]}
                      onChange={(value) => handleHeaderFieldChange(field.name, value)}
                      currency={localDocument?.currency}
                      className="text-foreground"
                      data-testid={`header-field-${field.name}-value`}
                    />
                  </div>
                ))
              }
            </div>
          </TabsContent>

          {lineItemTabCollections.map((collection) => (
            <TabsContent
              key={collection.key}
              value={collection.tabValue}
              data-testid={`tab-content-${collection.key}`}
              className="mt-1 flex-1 min-h-0 overflow-hidden data-[state=active]:flex"
            >
              <div
                className="flex flex-1 min-h-0 flex-col gap-3"
                data-testid={`extracted-table-${collection.key}`}
              >
                <div
                  className="min-h-0 flex-1"
                  data-testid={`line-items-grid-wrapper-${collection.key}`}
                >
                  <LineItemsGrid
                    lineItems={collection.lineItems}
                    lineItemSchema={collection.schema}
                    currency={localDocument?.currency || null}
                    t={t}
                    onEditChange={handleLineItemEditChange}
                    editsRef={lineItemEditsRef}
                    gridApiRef={gridApiRef}
                    initialColumnState={lineItemColumnStates[collection.key]}
                    onColumnStateChange={(columnState) =>
                      handleLineItemColumnStateChange(
                        collection.key,
                        columnState
                      )
                    }
                    documentId={document?.id}
                  />
                </div>
                <div
                  className="flex shrink-0 justify-end gap-2"
                  data-testid={`line-item-actions-${collection.key}`}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAddLineItemCollectionKey(collection.key)}
                    disabled={isSaving || isExtractionBusy}
                    data-testid={`add-line-item-btn-${collection.key}`}
                  >
                    <Plus className="h-4 w-4" />
                    {t("addLineItem")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setRemoveLineItemCollectionKey(collection.key)
                    }
                    disabled={
                      isSaving ||
                      isExtractionBusy ||
                      collection.lineItems.length === 0
                    }
                    data-testid={`remove-line-items-btn-${collection.key}`}
                  >
                    <Trash className="h-4 w-4" />
                    {t("remove")}
                  </Button>
                </div>
                <AddLineItemDialog
                  open={addLineItemCollectionKey === collection.key}
                  collectionDisplayName={collection.displayName}
                  lineItemSchema={collection.schema}
                  isSaving={isSaving}
                  t={t}
                  onOpenChange={(open) =>
                    setAddLineItemCollectionKey(open ? collection.key : null)
                  }
                  onAdd={(lineItem) =>
                    handleAddLineItem(collection.key, lineItem)
                  }
                />
                <RemoveLineItemsDialog
                  open={removeLineItemCollectionKey === collection.key}
                  collectionDisplayName={collection.displayName}
                  lineItems={collection.lineItems}
                  lineItemSchema={collection.schema}
                  isSaving={isSaving}
                  t={t}
                  onOpenChange={(open) =>
                    setRemoveLineItemCollectionKey(open ? collection.key : null)
                  }
                  onRemove={(rowIds) =>
                    handleRemoveLineItems(collection.key, rowIds)
                  }
                />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Force Extract Dialog */}
      <AlertDialog
        open={showForceExtractDialog}
        onOpenChange={(open) => {
          if (!open) {
            handleForceExtractCancel();
          }
        }}
      >
        <AlertDialogContent data-testid="force-extract-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="force-extract-dialog-title">
              {t("forceReExtract") || "Force re-extract data?"}
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="force-extract-dialog-description">
              {t("forceReExtractMessage") || "This will re-extract the data for this document."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center space-x-2 py-4" data-testid="force-extract-checkbox-container">
            <Checkbox
              id="force-extract-checkbox"
              checked={forceExtract}
              onCheckedChange={(checked) => setForceExtract(checked === true)}
              data-testid="force-extract-checkbox"
            />
            <label
              htmlFor="force-extract-checkbox"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              data-testid="force-extract-checkbox-label"
            >
              {t("forceExtract") || "Force re-extract"}
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleForceExtractCancel} data-testid="force-extract-cancel-btn">
              {t("cancel") || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleForceExtractConfirm} data-testid="force-extract-confirm-btn">
              {t("confirm") || "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move Document Modal */}
      {document && (
        <MoveDocumentModal
          isOpen={showMoveModal}
          onClose={() => setShowMoveModal(false)}
          documentId={document.id}
          documentName={document.fileName || ""}
          onMoved={() => {
            loadDocument(document.id);
            toast.success(t("documentMoved"));
          }}
        />
      )}

      {/* QuickBooks Push Dialog */}
      {document && org?.id && qbStatus?.connected && (
        <QuickBooksPushDialog
          isOpen={showQbPushDialog}
          onClose={() => setShowQbPushDialog(false)}
          orgId={org.id}
          documentId={document.id}
          docType={document.docType}
          savedMapping={qbStatus.purchaseMapping ?? null}
          onPushed={refreshQbStatus}
        />
      )}

      {/* QuickBooks Manage Dialog (Update / Delete) */}
      {document && org?.id && qbStatus?.connected && qbStatus.synced && (
        <QuickBooksManageDialog
          isOpen={showQbManageDialog}
          onClose={() => setShowQbManageDialog(false)}
          orgId={org.id}
          documentId={document.id}
          qbStatus={qbStatus}
          onStatusChanged={refreshQbStatus}
        />
      )}

      {/* Xero Push Dialog */}
      {document && org?.id && xeroStatus?.connected && (
        <XeroPushDialog
          isOpen={showXeroPushDialog}
          onClose={() => setShowXeroPushDialog(false)}
          orgId={org.id}
          documentId={document.id}
          docType={document.docType}
          onPushed={refreshXeroStatus}
        />
      )}

      {/* Xero Manage Dialog (Update / Delete) */}
      {document && org?.id && xeroStatus?.connected && xeroStatus.synced && (
        <XeroManageDialog
          isOpen={showXeroManageDialog}
          onClose={() => setShowXeroManageDialog(false)}
          orgId={org.id}
          documentId={document.id}
          xeroStatus={xeroStatus}
          onStatusChanged={refreshXeroStatus}
        />
      )}
    </div>
  );
}
