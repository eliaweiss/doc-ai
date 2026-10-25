import { type ComponentType } from "react";

export interface IntegrationStatusResult {
  connected: boolean;
  connectionId: string | null;
  displayName: string | null;
}

export interface ImportDialogProps {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

export interface IntegrationDefinition {
  id: string;
  enabled: boolean;
  logo: {
    src: string;
  };
  queryParam: string;
  accountDriverType: string;
  externalUrl: string;

  video?: {
    src: string;
    title: string;
    thumbnail?: string;
  };

  /**
   * Optional vendor-provided "Connect" button artwork (e.g. Intuit's required
   * official "Connect to QuickBooks" button). When set, the card renders this
   * image instead of the generic Button to trigger the OAuth flow.
   * Assets must be used as-is per the vendor's brand guidelines.
   */
  connectButton?: {
    defaultSrc: string;
    hoverSrc: string;
    width: number;
    height: number;
  };

  i18n: {
    title: string;
    description: string;
    idle: string;
    connect: string;
    disconnect: string;
    openExternal: string;
    connectedDescription: string;
    connectStarted: string;
    connectedToast: string;
    disconnectedToast: string;
    disconnectFailed: string;
    connectFailed: string;
    notConfigured: string;
    oauthErrors: Record<string, string>;
  };

  fetchStatus: (orgId: string) => Promise<IntegrationStatusResult>;
  startOAuth: (orgId: string) => Promise<{ authorizationUrl: string }>;
  disconnect: (orgId: string) => Promise<void>;

  ImportDialog?: ComponentType<ImportDialogProps>;
}
