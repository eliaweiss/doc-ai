"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import useOrgStore from "../../context-providers/orgStore";
import type { Organization, Document } from "@zdocs/types";

export function useAppPageData() {
  const { data: session, status } = useSession();
  const {
    org,
    setOrg,
    organizations,
    isLoadingOrgs,
    addOrganization: addOrgToStore,
    setOrganizations,
  } = useOrgStore();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const fetchDocuments = useCallback(async () => {
    if (!org?.id) return;
    setIsLoadingDocs(true);
    try {
      const response = await fetch(`/api/org/${org.id}/documents`, {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setIsLoadingDocs(false);
    }
  }, [org?.id]);

  const handleUploadComplete = useCallback(
    (url: string, file: File) => {
      setIsUploading(false);
      setUploadSuccess(true);
      fetchDocuments();
      setTimeout(() => setUploadSuccess(false), 3000);
    },
    [fetchDocuments]
  );

  const handleLogout = useCallback(async () => {
    await signOut({ redirect: false });
    setOrganizations([]);
    setDocuments([]);
  }, [setOrganizations]);

  const addOrganization = useCallback(
    (organization: Organization) => {
      addOrgToStore(organization);
      setOrg(organization);
    },
    [addOrgToStore, setOrg]
  );

  const deleteDocument = useCallback(
    async (documentId: string) => {
      if (!org?.id) return false;
      try {
        const response = await fetch(
          `/api/org/${org.id}/documents/${documentId}/delete`,
          { method: "POST" }
        );
        if (response.ok) {
          setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
          return true;
        }
        return false;
      } catch (error) {
        console.error("Failed to delete document:", error);
        return false;
      }
    },
    [org?.id]
  );

  // Fetch documents when org changes
  useEffect(() => {
    if (org?.id) {
      fetchDocuments();
    }
  }, [org?.id, fetchDocuments]);

  return {
    session,
    status,
    org,
    setOrg,
    organizations,
    documents,
    isLoadingOrgs,
    isLoadingDocs,
    isUploading,
    setIsUploading,
    uploadSuccess,
    fetchDocuments,
    handleUploadComplete,
    handleLogout,
    addOrganization,
    deleteDocument,
  };
}
