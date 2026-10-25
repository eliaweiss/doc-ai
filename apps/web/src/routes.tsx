/**
 * Route components, copied from zdocs src/app/(pages)/.../page.tsx with
 * next/navigation replaced by react-router (same hooks via the shim).
 */
import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { BrowsePage } from "@zdocs/client/src/pages/apps/BrowsePage";
import { useDocsStore } from "@zdocs/client/src/context-providers/docsStore";
import { DocumentViewPage } from "@zdocs/client/src/pages/document/DocumentViewPage";
import { SchemaPage } from "@zdocs/client/src/pages/schema/SchemaPage";
import SearchPage from "@zdocs/client/src/pages/search/SearchPage";
import { OrganizationSettingsPage } from "@zdocs/client/src/pages/app/org-admin/OrganizationSettingsPage";
import { MiniAppsPage } from "@zdocs/client/src/pages/mini-apps/MiniAppsPage";
import { MiniAppPage } from "@zdocs/client/src/pages/mini-apps/MiniAppPage";
import { ReconciliationWorkbenchPage } from "@zdocs/client/src/pages/reconciliation/ReconciliationWorkbenchPage";

// (pages)/folder/page.tsx
export function DrivePage() {
  const [searchParams] = useSearchParams();
  const showUploadOnInit = searchParams.get("showUpload") === "true";
  return <BrowsePage showUploadOnInit={showUploadOnInit} />;
}

// (pages)/folder/[folderId]/page.tsx
export function DriveFolderPage() {
  const { folderId } = useParams();
  const { setCurrentFolderId } = useDocsStore();
  const [searchParams] = useSearchParams();
  const showUploadOnInit = searchParams.get("showUpload") === "true";

  useEffect(() => {
    if (folderId) setCurrentFolderId(folderId);
  }, [folderId, setCurrentFolderId]);

  return <BrowsePage showUploadOnInit={showUploadOnInit} />;
}

// (pages)/document/[documentId]/page.tsx
export function DocumentPage() {
  const { documentId } = useParams();
  return <DocumentViewPage documentId={documentId as string} />;
}

// (pages)/schema/page.tsx
export function SchemaRoute() {
  return <SchemaPage />;
}

// (pages)/search/page.tsx
export function SearchRoute() {
  return <SearchPage />;
}

// (pages)/settings/page.tsx
export function SettingsRoute() {
  return <OrganizationSettingsPage />;
}

// (pages)/reconciliation/workbench/page.tsx
export function ReconciliationWorkbenchRoute() {
  return <ReconciliationWorkbenchPage />;
}

// doc-ai: mini app list (replaces (pages)/home)
export function MiniAppsRoute() {
  return <MiniAppsPage />;
}

// doc-ai: run one mini app, view only (replaces (pages)/ai-builder/[miniAppId])
export function MiniAppRoute() {
  const { miniAppId } = useParams();
  return <MiniAppPage miniAppId={miniAppId as string} />;
}
