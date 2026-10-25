/**
 * doc-ai web: the zdocs client (packages/client) on Vite + react-router.
 * Replaces zdocs' Next.js shell: src/app/layout.tsx, (pages)/layout.tsx, (pages)/app.tsx
 * and the thin (pages)/.../page.tsx wrappers, which become the routes below.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import "react18-json-view/src/style.css";
import "katex/dist/katex.min.css";
import "./globals.css";
import AppProvider from "@zdocs/client/src/context-providers/app-context";
import { LocaleProvider } from "@zdocs/client/src/context-providers/LocaleContext";
import { DynamicFavicon } from "@zdocs/client/src/components/DynamicFavicon";
import { DrivePage, DriveFolderPage, DocumentPage, SchemaRoute, SearchRoute, SettingsRoute, MiniAppsRoute, MiniAppRoute, ReconciliationWorkbenchRoute } from "./routes";

function App({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen overflow-hidden">
      <Toaster
        position="bottom-right"
        closeButton={true}
        toastOptions={{
          duration: 5000,
          classNames: {
            success: "bg-green-50 border-green-500 text-green-900",
            error: "bg-red-50 border-red-500 text-red-900",
            toast: "border-l-4 p-3",
          },
        }}
      />
      <AppProvider>
        <DynamicFavicon />
        <div className="flex h-full flex-col overflow-hidden">
          <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
        </div>
      </AppProvider>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LocaleProvider defaultLocale="en">
        <App>
          <Routes>
            <Route path="/" element={<Navigate to="/folder" replace />} />
            <Route path="/folder" element={<DrivePage />} />
            <Route path="/folder/:folderId" element={<DriveFolderPage />} />
            <Route path="/document/:documentId" element={<DocumentPage />} />
            <Route path="/schema" element={<SchemaRoute />} />
            <Route path="/search" element={<SearchRoute />} />
            <Route path="/settings" element={<SettingsRoute />} />
            <Route path="/reconciliation/workbench" element={<ReconciliationWorkbenchRoute />} />
            <Route path="/apps" element={<MiniAppsRoute />} />
            <Route path="/app/:miniAppId" element={<MiniAppRoute />} />
            <Route path="*" element={<Navigate to="/folder" replace />} />
          </Routes>
        </App>
      </LocaleProvider>
    </BrowserRouter>
  </React.StrictMode>
);
