"use client";

import { createContext, useContext, useEffect, useCallback, ReactNode } from "react";
import type { Organization } from "@zdocs/types";
import { buildInboundEmailAddress } from "@zdocs/util";
import { zFetch } from "../../../lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useOrganizationSettingsStore } from "./organizationSettingsStore";

export type SettingsSection =
  | "basic"
  | "sharing"
  | "outbound-webhooks"
  | "processing"; // doc-ai

interface OrganizationSettingsContextValue {
  // State
  editName: string;
  editDescription: string;
  editBaseCurrency: string;
  editTimezone: string;
  editSharedEmails: string[];
  editWebhookSecret: string;
  editWebhookCallbackUrl: string;
  webhookSigningSecret: string | null;
  editEmailForwardAddress: string;
  editEmailForwardEnabled: boolean;
  editEmailNotifyOnUpload: boolean;
  editColor: string;
  webhookUrl: string | null;
  emailAddress: string | null;
  isSaving: boolean;
  isCopied: boolean;
  isEmailCopied: boolean;
  isWebhookSigningSecretCopied: boolean;
  isGeneratingWebhook: boolean;
  isGeneratingEmail: boolean;
  isGeneratingSigningSecret: boolean;
  isTestingWebhook: boolean;
  showWebhookSecret: boolean;
  showWebhookSigningSecret: boolean;
  webhookTestResult: { success: boolean; statusCode?: number; error?: string } | null;
  webhookId: string | null;
  selectedSection: SettingsSection;

  // Setters
  setEditName: (value: string) => void;
  setEditDescription: (value: string) => void;
  setEditBaseCurrency: (value: string) => void;
  setEditTimezone: (value: string) => void;
  setEditSharedEmails: (value: string[]) => void;
  setEditWebhookSecret: (value: string) => void;
  setEditWebhookCallbackUrl: (value: string) => void;
  setWebhookSigningSecret: (value: string | null) => void;
  setEditEmailForwardAddress: (value: string) => void;
  setEditEmailForwardEnabled: (value: boolean) => void;
  setEditEmailNotifyOnUpload: (value: boolean) => void;
  setEditColor: (value: string) => void;
  setIsCopied: (value: boolean) => void;
  setIsEmailCopied: (value: boolean) => void;
  setIsWebhookSigningSecretCopied: (value: boolean) => void;
  setIsGeneratingSigningSecret: (value: boolean) => void;
  setIsTestingWebhook: (value: boolean) => void;
  setShowWebhookSecret: (value: boolean) => void;
  setShowWebhookSigningSecret: (value: boolean) => void;
  setWebhookTestResult: (value: { success: boolean; statusCode?: number; error?: string } | null) => void;
  setSelectedSection: (section: SettingsSection) => void;

  // Actions
  handleUpdateOrg: (onClose: () => void) => Promise<void>;
  saveOrg: () => Promise<void>;
  copyWebhookUrl: () => Promise<void>;
  copyEmailAddress: () => Promise<void>;
  copyWebhookSigningSecret: () => Promise<void>;
  generateSigningSecret: () => Promise<void>;
  testWebhook: () => Promise<void>;
}

const OrganizationSettingsContext = createContext<OrganizationSettingsContextValue | undefined>(undefined);

interface OrganizationSettingsProviderProps {
  children: ReactNode;
  organization: Organization | null;
  isOpen: boolean;
  onSuccess: (organization: Organization) => void;
}

export function OrganizationSettingsProvider({
  children,
  organization,
  isOpen,
  onSuccess,
}: OrganizationSettingsProviderProps) {
  const tOrgs = useTranslations("organizations");

  const {
    editName, editDescription, editBaseCurrency, editTimezone,
    editSharedEmails, editWebhookSecret, editWebhookCallbackUrl, webhookSigningSecret,
    editEmailForwardAddress, editEmailForwardEnabled, editEmailNotifyOnUpload, editColor, webhookUrl, emailAddress,
    isSaving, isCopied, isEmailCopied, isWebhookSigningSecretCopied,
    isGeneratingWebhook, isGeneratingEmail, isGeneratingSigningSecret, isTestingWebhook,
    showWebhookSecret, showWebhookSigningSecret, webhookTestResult, selectedSection,
    setEditName, setEditDescription, setEditBaseCurrency, setEditTimezone,
    setEditSharedEmails, setEditWebhookSecret, setEditWebhookCallbackUrl, setWebhookSigningSecret,
    setEditEmailForwardAddress, setEditEmailForwardEnabled, setEditEmailNotifyOnUpload, setEditColor,
    setWebhookUrl, setEmailAddress, setIsSaving, setIsCopied, setIsEmailCopied,
    setIsWebhookSigningSecretCopied, setIsGeneratingWebhook, setIsGeneratingEmail,
    setIsGeneratingSigningSecret, setIsTestingWebhook, setShowWebhookSecret,
    setShowWebhookSigningSecret, setWebhookTestResult, setSelectedSection,
    initializeFromOrganization,
  } = useOrganizationSettingsStore();

  const generateWebhookUrl = useCallback((webhookId: string) => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `${baseUrl}/api/webhook/${webhookId}`;
  }, []);

  const generateEmailAddress = useCallback((emailId: string) => {
    return buildInboundEmailAddress(emailId);
  }, []);

  // Initialize form fields when organization changes
  useEffect(() => {
    if (organization) {
      initializeFromOrganization(organization, generateWebhookUrl, generateEmailAddress);
    }
  }, [organization, generateWebhookUrl, generateEmailAddress, initializeFromOrganization]);

  // Auto-generate webhook ID when dialog opens if not present
  useEffect(() => {
    if (isOpen && organization && !organization.webhookId) {
      setIsGeneratingWebhook(true);
      zFetch(`/api/org/${organization.id}/webhook/generate`, { method: "POST" })
        .then((data) => {
          if (data.organization?.webhookId) {
            setWebhookUrl(generateWebhookUrl(data.organization.webhookId));
            onSuccess(data.organization);
          }
        })
        .catch((error) => {
          console.error("Failed to generate webhook ID:", error);
        })
        .finally(() => {
          setIsGeneratingWebhook(false);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, organization?.id, organization?.webhookId, generateWebhookUrl, onSuccess, setIsGeneratingWebhook, setWebhookUrl]);

  // Auto-generate email ID when dialog opens if not present
  useEffect(() => {
    if (isOpen && organization && !organization.emailId) {
      setIsGeneratingEmail(true);
      zFetch(`/api/org/${organization.id}/email/generate`, { method: "POST" })
        .then((data) => {
          if (data.organization?.emailId) {
            setEmailAddress(generateEmailAddress(data.organization.emailId));
            onSuccess(data.organization);
          }
        })
        .catch((error) => {
          console.error("Failed to generate email ID:", error);
        })
        .finally(() => {
          setIsGeneratingEmail(false);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, organization?.id, organization?.emailId, generateEmailAddress, onSuccess, setIsGeneratingEmail, setEmailAddress]);

  const buildOrgPayload = () => {
    const state = useOrganizationSettingsStore.getState();
    return {
      name: state.editName.trim(),
      description: state.editDescription.trim(),
      baseCurrency: state.editBaseCurrency.trim(),
      timezone: state.editTimezone,
      sharedWithEmails: state.editSharedEmails,
      webhookSecret: state.editWebhookSecret.trim() || null,
      webhookCallbackUrl: state.editWebhookCallbackUrl.trim() || null,
      webhookSigningSecret: state.webhookSigningSecret || null,
      emailForwardAddress: state.editEmailForwardAddress.trim() || null,
      emailForwardEnabled: state.editEmailForwardEnabled,
      emailNotifyOnUpload: state.editEmailNotifyOnUpload,
      color: state.editColor.trim() || null,
    };
  };

  const handleUpdateOrg = async (onClose: () => void) => {
    if (!organization) return;
    if (!editName.trim()) {
      toast.error(tOrgs("nameRequired"));
      return;
    }

    setIsSaving(true);
    try {
      const data = await zFetch(`/api/org/${organization.id}`, {
        method: "POST",
        body: buildOrgPayload(),
      });
      onSuccess(data.organization);
      onClose();
      toast.success(tOrgs("updateSuccess"));
    } catch (error) {
      console.error("Failed to update organization:", error);
      toast.error(tOrgs("updateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const saveOrg = async () => {
    if (!organization) return;
    if (!editName.trim()) {
      toast.error(tOrgs("nameRequired"));
      return;
    }

    setIsSaving(true);
    try {
      const data = await zFetch(`/api/org/${organization.id}`, {
        method: "POST",
        body: buildOrgPayload(),
      });
      onSuccess(data.organization);
      // Note: onSuccess handler in the page component shows success toast
    } catch (error) {
      console.error("Failed to update organization:", error);
      toast.error(tOrgs("updateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const copyWebhookUrl = useCallback(async () => {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setIsCopied(true);
      toast.success(tOrgs("webhookUrlCopied"));
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error(tOrgs("webhookUrlCopyFailed"));
    }
  }, [webhookUrl, tOrgs, setIsCopied]);

  const copyEmailAddress = useCallback(async () => {
    if (!emailAddress) return;
    try {
      await navigator.clipboard.writeText(emailAddress);
      setIsEmailCopied(true);
      toast.success(tOrgs("emailAddressCopied"));
      setTimeout(() => setIsEmailCopied(false), 2000);
    } catch {
      toast.error(tOrgs("emailAddressCopyFailed"));
    }
  }, [emailAddress, tOrgs, setIsEmailCopied]);

  const copyWebhookSigningSecret = useCallback(async () => {
    if (!webhookSigningSecret) return;
    try {
      await navigator.clipboard.writeText(webhookSigningSecret);
      setIsWebhookSigningSecretCopied(true);
      toast.success(tOrgs("webhookSigningSecretCopied"));
      setTimeout(() => setIsWebhookSigningSecretCopied(false), 2000);
    } catch {
      toast.error(tOrgs("webhookSigningSecretCopyFailed"));
    }
  }, [webhookSigningSecret, tOrgs, setIsWebhookSigningSecretCopied]);

  const generateSigningSecret = useCallback(async () => {
    if (!organization) return;
    setIsGeneratingSigningSecret(true);
    try {
      const data = await zFetch(`/api/org/${organization.id}/webhook/generate-signing-secret`, {
        method: "POST",
      });
      if (data.signingSecret) {
        setWebhookSigningSecret(data.signingSecret);
        onSuccess(data.organization);
        toast.success(tOrgs("webhookSigningSecretGenerated"));
      }
    } catch (error) {
      console.error("Failed to generate signing secret:", error);
      toast.error(tOrgs("webhookSigningSecretGenerateFailed"));
    } finally {
      setIsGeneratingSigningSecret(false);
    }
  }, [organization, tOrgs, setIsGeneratingSigningSecret, setWebhookSigningSecret, onSuccess]);

  const testWebhook = useCallback(async () => {
    if (!organization) return;
    setIsTestingWebhook(true);
    setWebhookTestResult(null);
    try {
      // First save the webhook settings
      await saveOrg();
      
      // Then test the webhook
      const data = await zFetch(`/api/org/${organization.id}/webhook/test`, {
        method: "POST",
      });
      if (data.success) {
        setWebhookTestResult({ success: true, statusCode: data.statusCode });
        toast.success(tOrgs("testWebhookSuccess"));
      } else {
        setWebhookTestResult({
          success: false,
          statusCode: data.statusCode,
          error: data.error,
        });
        toast.error(tOrgs("testWebhookFailed"));
      }
    } catch (error: any) {
      const errorMessage = error?.message || "Unknown error";
      setWebhookTestResult({ success: false, error: errorMessage });
      toast.error(tOrgs("testWebhookFailed"));
    } finally {
      setIsTestingWebhook(false);
    }
  }, [organization, tOrgs, setIsTestingWebhook, setWebhookTestResult, saveOrg]);

  const value: OrganizationSettingsContextValue = {
    editName, editDescription, editBaseCurrency, editTimezone,
    editSharedEmails, editWebhookSecret, editWebhookCallbackUrl, webhookSigningSecret,
    editEmailForwardAddress, editEmailForwardEnabled, editEmailNotifyOnUpload, editColor, webhookUrl, emailAddress,
    isSaving, isCopied, isEmailCopied, isWebhookSigningSecretCopied,
    isGeneratingWebhook, isGeneratingEmail, isGeneratingSigningSecret, isTestingWebhook,
    showWebhookSecret, showWebhookSigningSecret, webhookTestResult, selectedSection,
    setEditName, setEditDescription, setEditBaseCurrency, setEditTimezone,
    setEditSharedEmails, setEditWebhookSecret, setEditWebhookCallbackUrl, setWebhookSigningSecret,
    setEditEmailForwardAddress, setEditEmailForwardEnabled, setEditEmailNotifyOnUpload, setEditColor,
    setIsCopied, setIsEmailCopied, setIsWebhookSigningSecretCopied,
    setIsGeneratingSigningSecret, setIsTestingWebhook, setShowWebhookSecret,
    setShowWebhookSigningSecret, setWebhookTestResult, setSelectedSection,
    handleUpdateOrg, saveOrg, copyWebhookUrl, copyEmailAddress,
    copyWebhookSigningSecret, generateSigningSecret, testWebhook, webhookId: organization?.webhookId || null
  };

  return (
    <OrganizationSettingsContext.Provider value={value}>
      {children}
    </OrganizationSettingsContext.Provider>
  );
}

export function useOrganizationSettings() {
  const context = useContext(OrganizationSettingsContext);
  if (context === undefined) {
    throw new Error("useOrganizationSettings must be used within OrganizationSettingsProvider");
  }
  return context;
}
