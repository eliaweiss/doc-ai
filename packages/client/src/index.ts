// @zdocs/client exports
export { default as AppProvider } from "./context-providers/app-context";
export { LocaleProvider } from "./context-providers/LocaleContext";

// pages
export { default as ProfilePage } from "./pages/profile/profile-page";
export { default as AppHomePage } from "./pages/app/AppHomePage";
export { BrowsePage } from "./pages/apps/BrowsePage";

// Drive page and components
export { DrivePageComponent } from "./pages/drive";
export { default as DriveProvider } from "./context-providers/DriveProvider";

// Search page and components
export { SearchPageComponent, SearchPage } from "./pages/search";

// Reconciliation pages and components
export { ReconciliationLedgerPage } from "./pages/reconciliation/ReconciliationLedgerPage";
export { ReconciliationWorkbenchPage } from "./pages/reconciliation/ReconciliationWorkbenchPage";

// Document page and components
export { DocumentViewPage } from "./pages/document";

// Schema page and components
export { SchemaPage } from "./pages/schema";

// Tasks page and components
export {
  TasksPage,
  TaskDetailPage,
  TasksPageProvider,
  useTasksPage,
} from "./pages/tasks";

// Data Sources page and components
export {
  DataSourcesPage,
  BankLinksPage,
  DataSourcesProvider,
  useDataSources,
} from "./pages/data-sources";

// Integrations (QuickBooks, etc.)
export { IntegrationsPage } from "./pages/integrations";



// Organization settings page
export { OrganizationSettingsPage } from "./pages/app/org-admin/OrganizationSettingsPage";
export { OrganizationApiSettingsPage } from "./pages/app/org-admin/OrganizationApiSettingsPage";

// AI Builder
export {
  AiBuilderPage,
  AiBuilderInteractionLogPage,
  MiniAppProvider,
  useMiniApp,
  AiBuilderProvider,
  useAiBuilder,
} from "./pages/ai-builder";

// Apps
export { AppsPage } from "./pages/apps";

export { Collapsible, CollapsibleTrigger, CollapsibleContent, Button, Alert, AlertDescription, AlertTitle } from "@zdocs/client-component";
export { ResizableSplitPane } from "./components/ui/resizable-split-pane";
export { ImageCanvas, ImageCanvasToolbar } from "./components/ui/image-canvas";
export { FilePicker, type UploadResult } from "./components/ui/file-picker/FilePicker";
export { cn } from "@zdocs/client-component";
export { UserMenu } from "./components/UserMenu";

// Stores
export { useAppStore } from "./context-providers/appStore";
export { useDocsStore } from "./context-providers/docsStore";
export { useSearchStore } from "./context-providers/searchStore";

// uiTx SDK components
export { MiniAppViewer } from "./components/ui-tx/MiniAppViewer";
export { useUiTxMessageHandler } from "./hooks/useUiTxMessageHandler";

// Utilities
export { zFetch } from "./lib/utils";

// API utilities
export { fetchFolders } from "./utilities/api/fetchFolders";
export { fetchDocuments } from "./utilities/api/fetchDocuments";
export {
  fetchDocument,
  type FetchDocumentResponse,
  type DocumentDataResponse,
  type DocumentTypeResponse,
} from "./utilities/api/fetchDocument";
export { fetchCreateFolder } from "./utilities/api/fetchCreateFolder";
export { fetchDeleteFolder } from "./utilities/api/fetchDeleteFolder";
export { fetchRenameFolder } from "./utilities/api/fetchRenameFolder";
export { fetchMoveFolder } from "./utilities/api/fetchMoveFolder";
export { fetchDeleteDocument } from "./utilities/api/fetchDeleteDocument";
export { fetchRenameDocument } from "./utilities/api/fetchRenameDocument";
export { fetchMoveDocument } from "./utilities/api/fetchMoveDocument";
export {
  extractDocumentData,
  type ExtractDocumentDataResponse,
} from "./utilities/api/extractDocumentData";
export {
  updateDocumentData,
  type UpdateDocumentDataRequest,
  type UpdateDocumentDataResponse,
} from "./utilities/api/updateDocumentData";
export { fetchSearchableEntities } from "./utilities/api/fetchSearchableEntities";
export { searchByEntityApi as searchByEntity } from "./utilities/api/searchByEntity";
export {
  ConfirmProvider,
  useConfirm,
} from "./context-providers/confirm-provider/ConfirmProvider";

// AI Desk API utilities
export { createAiDeskChat, loadAiDeskChat } from "./utilities/api/aiDeskApi";

// User Journey API utilities
export { useLogUserJourneyEvent } from "./utilities/api/logUserJourneyEventApi";

// UI Components
export { LoadingDots } from "@zdocs/client-component";

export { DynamicFavicon } from "./components/DynamicFavicon";
export { DocVisionFavicon } from "./components/DocVisionFavicon";

// Icons
export { OneFlowLogo } from "@zdocs/client-component";
export { OneFlowLogoHeader } from "./components/icons";

// Re-export stores for direct usage
export { default as useOrgStore } from "./context-providers/orgStore";

