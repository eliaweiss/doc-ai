import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { SettingsSection } from "./OrganizationSettingsProvider";
import type { Organization } from "@zdocs/types";

interface OrganizationSettingsState {
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
  selectedSection: SettingsSection;
}

interface OrganizationSettingsActions {
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
  setWebhookUrl: (value: string | null) => void;
  setEmailAddress: (value: string | null) => void;
  setIsSaving: (value: boolean) => void;
  setIsCopied: (value: boolean) => void;
  setIsEmailCopied: (value: boolean) => void;
  setIsWebhookSigningSecretCopied: (value: boolean) => void;
  setIsGeneratingWebhook: (value: boolean) => void;
  setIsGeneratingEmail: (value: boolean) => void;
  setIsGeneratingSigningSecret: (value: boolean) => void;
  setIsTestingWebhook: (value: boolean) => void;
  setShowWebhookSecret: (value: boolean) => void;
  setShowWebhookSigningSecret: (value: boolean) => void;
  setWebhookTestResult: (value: { success: boolean; statusCode?: number; error?: string } | null) => void;
  setSelectedSection: (section: SettingsSection) => void;
  initializeFromOrganization: (organization: Organization, generateWebhookUrl: (id: string) => string, generateEmailAddress: (id: string) => string) => void;
}

type OrganizationSettingsStore = OrganizationSettingsState & OrganizationSettingsActions;

const initialState: OrganizationSettingsState = {
  editName: "",
  editDescription: "",
  editBaseCurrency: "",
  editTimezone: "",
  editSharedEmails: [],
  editWebhookSecret: "",
  editWebhookCallbackUrl: "",
  webhookSigningSecret: null,
  editEmailForwardAddress: "",
  editEmailForwardEnabled: false,
  editEmailNotifyOnUpload: false,
  editColor: "",
  webhookUrl: null,
  emailAddress: null,
  isSaving: false,
  isCopied: false,
  isEmailCopied: false,
  isWebhookSigningSecretCopied: false,
  isGeneratingWebhook: false,
  isGeneratingEmail: false,
  isGeneratingSigningSecret: false,
  isTestingWebhook: false,
  showWebhookSecret: false,
  showWebhookSigningSecret: false,
  webhookTestResult: null,
  selectedSection: "basic",
};

export const useOrganizationSettingsStore = create<OrganizationSettingsStore>()(
  devtools(
    (set) => ({
      ...initialState,
      setEditName: (value) => set({ editName: value }),
      setEditDescription: (value) => set({ editDescription: value }),
      setEditBaseCurrency: (value) => set({ editBaseCurrency: value }),
      setEditTimezone: (value) => set({ editTimezone: value }),
      setEditSharedEmails: (value) => set({ editSharedEmails: value }),
      setEditWebhookSecret: (value) => set({ editWebhookSecret: value }),
      setEditWebhookCallbackUrl: (value) => set({ editWebhookCallbackUrl: value }),
      setWebhookSigningSecret: (value) => set({ webhookSigningSecret: value }),
      setEditEmailForwardAddress: (value) => set({ editEmailForwardAddress: value }),
      setEditEmailForwardEnabled: (value) => set({ editEmailForwardEnabled: value }),
      setEditEmailNotifyOnUpload: (value) => set({ editEmailNotifyOnUpload: value }),
      setEditColor: (value) => set({ editColor: value }),
      setWebhookUrl: (value) => set({ webhookUrl: value }),
      setEmailAddress: (value) => set({ emailAddress: value }),
      setIsSaving: (value) => set({ isSaving: value }),
      setIsCopied: (value) => set({ isCopied: value }),
      setIsEmailCopied: (value) => set({ isEmailCopied: value }),
      setIsWebhookSigningSecretCopied: (value) => set({ isWebhookSigningSecretCopied: value }),
      setIsGeneratingWebhook: (value) => set({ isGeneratingWebhook: value }),
      setIsGeneratingEmail: (value) => set({ isGeneratingEmail: value }),
      setIsGeneratingSigningSecret: (value) => set({ isGeneratingSigningSecret: value }),
      setIsTestingWebhook: (value) => set({ isTestingWebhook: value }),
      setShowWebhookSecret: (value) => set({ showWebhookSecret: value }),
      setShowWebhookSigningSecret: (value) => set({ showWebhookSigningSecret: value }),
      setWebhookTestResult: (value) => set({ webhookTestResult: value }),
      setSelectedSection: (section) => set({ selectedSection: section }),
      initializeFromOrganization: (organization, generateWebhookUrl, generateEmailAddress) => {
        set({
          editName: organization.name,
          editDescription: organization.description || "",
          editBaseCurrency: organization.baseCurrency,
          editTimezone: organization.timezone || "UTC",
          editSharedEmails: organization.sharedWithEmails || [],
          editWebhookSecret: organization.webhookSecret || "",
          editWebhookCallbackUrl: organization.webhookCallbackUrl || "",
          webhookSigningSecret: organization.webhookSigningSecret || null,
          editEmailForwardAddress: organization.emailForwardAddress || "",
          editEmailForwardEnabled: organization.emailForwardEnabled || false,
          editEmailNotifyOnUpload: organization.emailNotifyOnUpload || false,
          editColor: organization.color || "",
          webhookUrl: organization.webhookId ? generateWebhookUrl(organization.webhookId) : null,
          emailAddress: organization.emailId ? generateEmailAddress(organization.emailId) : null,
        });
      },
    }),
    { name: "organization-settings-store" }
  )
);

export default useOrganizationSettingsStore;
