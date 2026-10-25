"use client";
import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { formatCurrency, formatDate, isMobileWidth } from "@zdocs/util";
import {
  FileText,
  Calendar,
  Activity,
  Table,
  FolderIcon,
  Edit2,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  ColDef,
  CellContextMenuEvent,
  ICellRendererParams,
  RowClickedEvent,
  GridApi,
  GridReadyEvent,
  RowSelectionOptions,
} from "ag-grid-community";
import { Document, ExtractionStatus } from "@zdocs/types";
import {
  DataGrid,
  createSelectionTheme,
} from "@zdocs/client-component";

// Light blue-purple selection theme for documents grid
const documentsGridTheme = createSelectionTheme("rgba(165, 180, 252, 0.35)");
import { ContextMenu } from "@zdocs/client-component";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { RenameDocumentModal } from "./RenameDocumentModal";
import { MoveDocumentModal } from "./MoveDocumentModal";
import { fetchDeleteDocument } from "../../../utilities/api/fetchDeleteDocument";
import { fetchDocumentStatuses } from "../../../utilities/api/fetchDocumentStatuses";
import {
  DOCUMENTS_PAGE_SIZE,
  fetchDocuments,
} from "../../../utilities/api/fetchDocuments";
import { DocumentsCardView } from "./DocumentsCardView";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

interface DocumentsGridProps {
  documents: Document[];
}

// Custom cell renderer for the description column with icon (fallback to filename)
function DescriptionCellRenderer(params: ICellRendererParams<Document>) {
  const text = params.data?.description || params.data?.fileName || "Untitled";
  const isDataset = false; // Dataset pipeline disabled

  return (
    <div className="flex items-center h-full" data-testid="description-cell">
      {isDataset ? (
        <Table className="w-5 h-5 mr-2 text-primary flex-shrink-0" />
      ) : (
        <FileText className="w-5 h-5 mr-2 text-muted-foreground flex-shrink-0" />
      )}
      <span className="text-sm font-medium text-foreground truncate">
        {text}
      </span>
      {isDataset && (
        <span className="ml-2 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider flex-shrink-0">
          DATASET
        </span>
      )}
    </div>
  );
}

// Custom cell renderer for the document date column with icon
function DocumentDateCellRenderer(params: ICellRendererParams<Document>) {
  const formattedDate = formatDate(params.data?.documentDate || null);

  return (
    <div className="flex items-center h-full" data-testid="document-date-cell">
      <Calendar className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
      <span className="text-sm text-muted-foreground">{formattedDate}</span>
    </div>
  );
}

// Custom cell renderer for the status column
function StatusCellRenderer(params: ICellRendererParams<Document>) {
  const status = params.data?.extractionStatus;
  if (!status) return <span className="text-muted-foreground">-</span>;

  return (
    <div className="flex items-center h-full" data-testid="status-cell">
      <Activity className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
      <span className="text-sm capitalize text-muted-foreground">
        {status.toLowerCase()}
      </span>
    </div>
  );
}

// Custom cell renderer for the amount column
function AmountCellRenderer(params: ICellRendererParams<Document>) {
  const metadata = params.data?.metadata as Record<string, any> | null;
  const amount = metadata?.totalAmount; // Assuming totalAmount is in metadata for now
  const currency = params.data?.currency || "USD";

  if (amount === undefined || amount === null) {
    return (
      <div className="flex items-center h-full justify-end w-full">
        <span className="text-muted-foreground">-</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center h-full justify-end w-full"
      data-testid="amount-cell"
    >
      <span className="text-sm font-mono">
        {formatCurrency(Number(amount), currency)}
      </span>
    </div>
  );
}

export function DocumentsGrid({ documents }: DocumentsGridProps) {
  const t = useTranslations("drive");
  const router = useRouter();
  const { logEvent } = useLogUserJourneyEvent();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gridApiRef = useRef<GridApi<Document> | null>(null);
  const lastSelectedRowIndexRef = useRef<number | null>(null);
  const [isMobile, setIsMobile] = useState(() => isMobileWidth());
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(
    new Set()
  );

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    document: Document | null;
  }>({ show: false, x: 0, y: 0, document: null });

  // Modal states
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(
    null
  );

  const getDocumentTypeLabel = useCallback((type: string | null) => {
    if (!type) return "Unknown";
    return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }, []);

  // Disable AG Grid click selection so Ctrl/Cmd+click can toggle without
  // the grid deselecting first and our handler immediately re-selecting.
  const rowSelection = useMemo<RowSelectionOptions<Document>>(
    () => ({
      mode: "multiRow",
      checkboxes: false,
      headerCheckbox: false,
      enableClickSelection: false,
    }),
    []
  );

  const columnDefs = useMemo<ColDef<Document>[]>(
    () => [
      {
        field: "description",
        headerName: t("name"), // Still using "Name" header but showing description
        flex: 1,
        minWidth: 250,
        cellRenderer: DescriptionCellRenderer,
        valueGetter: (params) =>
          params.data?.description || params.data?.fileName || "",
      },
      {
        field: "documentDate",
        headerName: t("date"),
        width: 150,
        cellRenderer: DocumentDateCellRenderer,
        comparator: (a, b) => {
          if (!a && !b) return 0;
          if (!a) return -1;
          if (!b) return 1;
          return new Date(a).getTime() - new Date(b).getTime();
        },
      },
      {
        field: "docType",
        headerName: t("type"),
        width: 200,
        valueFormatter: (params) => {
          const type = params.data?.docType as string;
          return getDocumentTypeLabel(type);
        },
        cellClass: "text-muted-foreground text-sm",
      },
      {
        field: "extractionStatus",
        headerName: "Status", // Hardcoded for now, or use t("status") if sure
        width: 100,
        cellRenderer: StatusCellRenderer,
      },
      {
        colId: "amount", // No direct field on Document, derived
        headerName: "Amount",
        width: 140,
        cellRenderer: AmountCellRenderer,
        headerClass: "ag-right-aligned-header",
        cellClass: "ag-right-aligned-cell", // Ensure alignment
        valueGetter: (params) => {
          const metadata = params.data?.metadata as Record<string, any> | null;
          return metadata?.totalAmount ? Number(metadata.totalAmount) : null;
        },
        comparator: (a, b) => {
          if (a === null && b === null) return 0;
          if (a === null) return -1;
          if (b === null) return 1;
          return a - b;
        },
      },
    ],
    [t, getDocumentTypeLabel]
  );

  // Handle row double-click to navigate to document
  const handleRowDoubleClicked = useCallback(
    (event: { data: Document | undefined }) => {
      if (event.data) {
        logEvent({
          eventType: "browse_document_opened",
          eventData: {
            documentId: event.data.id,
            docType: event.data.docType,
            method: "double_click",
          },
        });
        router.push(`/document/${event.data.id}`);
      }
    },
    [router, logEvent]
  );

  // Handle row click for selection (single click, Shift+click, Ctrl/Cmd+click)
  const handleRowClicked = useCallback((event: RowClickedEvent<Document>) => {
    if (!event.data || !gridApiRef.current) return;

    const gridApi = gridApiRef.current;
    const node = event.node;
    const rowIndex = node.rowIndex ?? -1;
    const mouseEvent = event.event as MouseEvent | undefined;
    const isShiftPressed = mouseEvent?.shiftKey || false;
    const isCtrlPressed = mouseEvent?.ctrlKey || mouseEvent?.metaKey || false;

    if (isShiftPressed && lastSelectedRowIndexRef.current !== null) {
      // Range selection with Shift+click
      const startIndex = Math.min(lastSelectedRowIndexRef.current, rowIndex);
      const endIndex = Math.max(lastSelectedRowIndexRef.current, rowIndex);

      // Select all rows in range
      gridApi.forEachNode((n) => {
        if (
          n.rowIndex !== null &&
          n.rowIndex >= startIndex &&
          n.rowIndex <= endIndex
        ) {
          n.setSelected(true);
        }
      });
      logEvent({
        eventType: "browse_document_selected",
        eventData: {
          documentId: event.data.id,
          method: "shift_click",
          selectionCount: endIndex - startIndex + 1,
        },
      });
    } else if (isCtrlPressed) {
      // Toggle selection with Ctrl/Cmd+click
      const wasSelected = !!node.isSelected();
      node.setSelected(!wasSelected);
      lastSelectedRowIndexRef.current = rowIndex;
      logEvent({
        eventType: "browse_document_selected",
        eventData: {
          documentId: event.data.id,
          method: "ctrl_click",
          action: wasSelected ? "deselected" : "selected",
        },
      });
    } else {
      // Single click - select only this row
      gridApi.deselectAll();
      node.setSelected(true);
      lastSelectedRowIndexRef.current = rowIndex;
      logEvent({
        eventType: "browse_document_selected",
        eventData: {
          documentId: event.data.id,
          method: "single_click",
        },
      });
    }
  }, [logEvent]);

  // Handle grid ready to store API reference and set up row drag
  const handleGridReady = useCallback((event: GridReadyEvent<Document>) => {
    gridApiRef.current = event.api;

    // Set up drag handlers for rows using event delegation
    const setupRowDrag = () => {
      // Find grid container by looking for the data-grid-container
      const gridContainer = document.querySelector(
        '[data-testid="documents-grid-container"] [data-testid="data-grid-container"]'
      ) as HTMLElement | null;
      if (!gridContainer) return;

      const handleRowDragStart = (e: DragEvent) => {
        const target = e.target as HTMLElement;
        const rowElement = target.closest(".ag-row") as HTMLElement | null;
        if (!rowElement) return;

        const rowId = rowElement.getAttribute("row-id");
        if (!rowId || !event.api) return;

        const node = event.api.getRowNode(rowId);
        if (!node?.data) return;

        // Get selected documents
        const selectedNodes = event.api.getSelectedNodes();
        const documentsToMove = (
          selectedNodes.length > 0
            ? selectedNodes.map((n) => n.data).filter((d): d is Document => !!d)
            : node.data
              ? [node.data]
              : []
        ) as Document[];

        if (documentsToMove.length > 0) {
          e.dataTransfer!.effectAllowed = "move";
          e.dataTransfer!.setData(
            "application/json",
            JSON.stringify({
              documentIds: documentsToMove.map((d) => d.id),
              documentNames: documentsToMove.map(
                (d) => d.description || d.fileName || "Untitled"
              ),
            })
          );
          // Add visual feedback
          rowElement.style.opacity = "0.5";
        }
      };

      const handleRowDragEnd = (e: DragEvent) => {
        const target = e.target as HTMLElement;
        const rowElement = target.closest(".ag-row") as HTMLElement | null;
        if (rowElement) {
          rowElement.style.opacity = "1";
        }
      };

      // Attach drag handlers to grid container (event delegation)
      gridContainer.addEventListener("dragstart", handleRowDragStart);
      gridContainer.addEventListener("dragend", handleRowDragEnd);

      // Make all rows draggable
      const rows = gridContainer.querySelectorAll(".ag-row");
      rows.forEach((row: Element) => {
        (row as HTMLElement).setAttribute("draggable", "true");
      });
    };

    // Set up drag after a short delay to ensure rows are rendered
    setTimeout(setupRowDrag, 100);

    // Also set up drag when rows are updated
    event.api.addEventListener("modelUpdated", () => {
      setTimeout(setupRowDrag, 100);
    });
  }, []);

  // Get selected documents
  const getSelectedDocuments = useCallback((): Document[] => {
    if (!gridApiRef.current) return [];
    const selectedNodes = gridApiRef.current.getSelectedRows();
    return selectedNodes || [];
  }, []);

  // Add draggable class to rows
  const getRowClass = useCallback(() => {
    return "draggable-row";
  }, []);

  // Handle right-click context menu
  const handleCellContextMenu = useCallback(
    (event: CellContextMenuEvent<Document>) => {
      event.event?.preventDefault();
      const mouseEvent = event.event as MouseEvent;
      if (event.data) {
        logEvent({
          eventType: "browse_document_context_menu_opened",
          eventData: {
            documentId: event.data.id,
          },
        });
        setContextMenu({
          show: true,
          x: mouseEvent.pageX,
          y: mouseEvent.pageY,
          document: event.data,
        });
      }
    },
    [logEvent]
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu({ show: false, x: 0, y: 0, document: null });
  }, []);

  const handleDeleteClick = useCallback(() => {
    if (contextMenu.document) {
      logEvent({
        eventType: "browse_document_delete_opened",
        eventData: {
          documentId: contextMenu.document.id,
        },
      });
      setSelectedDocument(contextMenu.document);
      setShowDeleteConfirmation(true);
    }
    closeContextMenu();
  }, [contextMenu.document, closeContextMenu, logEvent]);

  const handleOpenInNewTabClick = useCallback(() => {
    if (contextMenu.document) {
      logEvent({
        eventType: "browse_document_opened",
        eventData: {
          documentId: contextMenu.document.id,
          docType: contextMenu.document.docType,
          method: "new_tab",
        },
      });
      window.open(`/document/${contextMenu.document.id}`, "_blank");
    }
    closeContextMenu();
  }, [contextMenu.document, closeContextMenu, logEvent]);

  // const handleRenameClick = useCallback(() => {
  //   if (contextMenu.document) {
  //     setSelectedDocument(contextMenu.document);
  //     setShowRenameModal(true);
  //   }
  //   closeContextMenu();
  // }, [contextMenu.document, closeContextMenu]);

  const handleMoveClick = useCallback(() => {
    if (contextMenu.document) {
      logEvent({
        eventType: "browse_document_move_opened",
        eventData: {
          documentId: contextMenu.document.id,
        },
      });
      setSelectedDocument(contextMenu.document);
      setShowMoveModal(true);
    }
    closeContextMenu();
  }, [contextMenu.document, closeContextMenu, logEvent]);

  const handleDeleteConfirm = useCallback(async () => {
    if (selectedDocument) {
      try {
        await fetchDeleteDocument(selectedDocument.id);
        logEvent({
          eventType: "browse_document_deleted",
          eventData: {
            documentId: selectedDocument.id,
            docType: selectedDocument.docType,
          },
        });
        setShowDeleteConfirmation(false);
        setSelectedDocument(null);
      } catch (error) {
        console.error("Error deleting document:", error);
      }
    }
  }, [selectedDocument, logEvent]);

  // Prevent browser context menu on the grid container
  const handleContainerContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Poll for document statuses every 5 seconds for non-INDEXED documents
  useEffect(() => {
    // Get pending documents (not yet INDEXED)
    const pendingDocs = documents.filter(
      (doc) => doc.extractionStatus !== "INDEXED"
    );

    // If no pending documents, clear any existing interval
    if (pendingDocs.length === 0) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // Store pending IDs and their initial statuses in refs to track across renders
    const pendingStatusesRef = {
      current: new Map<string, ExtractionStatus>(
        pendingDocs.map((doc) => [doc.id, doc.extractionStatus])
      ),
    };

    // Poll function
    const pollStatuses = async () => {
      // Check if we still have pending documents
      if (pendingStatusesRef.current.size === 0) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        return;
      }

      try {
        const statuses = await fetchDocumentStatuses(
          Array.from(pendingStatusesRef.current.keys())
        );

        if (statuses.length > 0) {
          // Check if any status has changed from what we last knew
          let hasChanges = false;
          statuses.forEach((status) => {
            const lastKnownStatus = pendingStatusesRef.current.get(status.id);
            if (
              lastKnownStatus &&
              lastKnownStatus !== status.extractionStatus
            ) {
              hasChanges = true;
            }
            // Remove from pending if INDEXED
            if (status.extractionStatus === "INDEXED") {
              pendingStatusesRef.current.delete(status.id);
            } else {
              // Update tracked status
              pendingStatusesRef.current.set(
                status.id,
                status.extractionStatus as ExtractionStatus
              );
            }
          });

          // If any status changed, refetch all documents to get full data
          if (hasChanges) {
            // Stop polling before refetching (effect will restart if still pending)
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            // Refetch full documents list
            await fetchDocuments({
              limit: Math.max(documents.length, DOCUMENTS_PAGE_SIZE),
            });
            return;
          }

          // Stop polling if all documents are now INDEXED
          if (pendingStatusesRef.current.size === 0) {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
          }
        }
      } catch (error) {
        console.error("Error polling document statuses:", error);
      }
    };

    // Start polling every 5 seconds (not immediately to avoid double-fetch on mount)
    pollingIntervalRef.current = setInterval(pollStatuses, 5000);

    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
    // Re-run when document IDs or pending statuses change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    documents
      .map((d) => `${d.id}:${d.extractionStatus}`)
      .sort()
      .join(","),
  ]);

  // Handle resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(isMobileWidth());
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);


  return (
    <>
      <style>{`
        .draggable-row {
          cursor: grab;
        }
        .draggable-row:active {
          cursor: grabbing;
        }
      `}</style>
      {isMobile ? (
        <DocumentsCardView
          documents={documents}
          selectedDocumentIds={selectedDocumentIds}
          lastSelectedRowIndexRef={lastSelectedRowIndexRef}
          getDocumentTypeLabel={getDocumentTypeLabel}
          setSelectedDocumentIds={setSelectedDocumentIds}
          setContextMenu={setContextMenu}
          onContainerContextMenu={handleContainerContextMenu}
          isMobile={isMobile}
        />
      ) : (
        <div
          className="border border-border rounded-lg flex-1 overflow-hidden flex flex-col min-h-0"
          data-testid="documents-grid-container"
          onContextMenu={handleContainerContextMenu}
        >
          <DataGrid<Document>
            rowData={documents}
            columnDefs={columnDefs}
            getRowId={(params) => params.data.id}
            getRowClass={getRowClass}
            onRowDoubleClicked={handleRowDoubleClicked}
            onRowClicked={handleRowClicked}
            onCellContextMenu={handleCellContextMenu}
            onGridReady={handleGridReady}
            rowSelection={rowSelection}
            defaultColDef={{
              sortable: true,
              sortingOrder: ["desc", "asc"],
            }}
            domLayout="normal"
            containerClassName="flex-1 min-h-0"
            customTheme={documentsGridTheme}
          />
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.show && contextMenu.document && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent flex items-center"
            onClick={handleMoveClick}
            data-testid="document-context-move"
          >
            <FolderIcon className="w-4 h-4 mr-2" />
            {t('move')}
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent flex items-center"
            onClick={handleOpenInNewTabClick}
            data-testid="document-context-open-in-new-tab"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {t('openInNewTab')}
          </button>
          {/* <button
            className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent flex items-center"
            onClick={handleRenameClick}
            data-testid="document-context-rename"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Rename
          </button>  */}
          <button
            className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-accent flex items-center"
            onClick={handleDeleteClick}
            data-testid="document-context-delete"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {t('delete')}
          </button>
        </ContextMenu>
      )}

      {/* Modals */}
      {selectedDocument && (
        <>
          <DeleteConfirmationModal
            isOpen={showDeleteConfirmation}
            itemId={selectedDocument.id}
            itemName={selectedDocument.fileName || ""}
            onClose={() => {
              setShowDeleteConfirmation(false);
              setSelectedDocument(null);
            }}
            onConfirm={handleDeleteConfirm}
          />

          <RenameDocumentModal
            isOpen={showRenameModal}
            documentId={selectedDocument.id}
            documentName={selectedDocument.fileName || ""}
            onClose={() => {
              setShowRenameModal(false);
              setSelectedDocument(null);
            }}
          />

          <MoveDocumentModal
            isOpen={showMoveModal}
            documentId={selectedDocument.id}
            documentName={selectedDocument.fileName || ""}
            onClose={() => {
              setShowMoveModal(false);
              setSelectedDocument(null);
            }}
          />
        </>
      )}
    </>
  );
}
