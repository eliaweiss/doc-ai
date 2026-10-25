"use client";

import { useTranslations } from "next-intl";
import { Button } from "@zdocs/client-component";
import { Input } from "@zdocs/client-component";
import { Label } from "@zdocs/client-component";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@zdocs/client-component";
import { Copy, Check, Eye, EyeOff } from "lucide-react";
import { useOrganizationSettings } from "../OrganizationSettingsProvider";
import Link from "next/link";
import { useEffect } from "react";
import { useLogUserJourneyEvent } from "../../../../utilities/api/logUserJourneyEventApi";

export function OutboundWebhookSection() {
  const tOrgs = useTranslations("organizations");
  const {
    editWebhookCallbackUrl,
    webhookSigningSecret,
    isTestingWebhook,
    isWebhookSigningSecretCopied,
    showWebhookSigningSecret,
    webhookTestResult,
    setEditWebhookCallbackUrl,
    setWebhookSigningSecret,
    setShowWebhookSigningSecret,
    copyWebhookSigningSecret,
    testWebhook,
  } = useOrganizationSettings();
  const { logEvent } = useLogUserJourneyEvent();

  useEffect(() => {
    logEvent({
      eventType: "org_api_settings_outbound_webhook_section_viewed",
    });
  }, [logEvent]);

  useEffect(() => {
    if (webhookTestResult) {
      if (webhookTestResult.success) {
        logEvent({
          eventType: "org_api_settings_webhook_test_success",
          eventData: {
            statusCode: webhookTestResult.statusCode,
          },
        });
      } else {
        logEvent({
          eventType: "org_api_settings_webhook_test_error",
          eventData: {
            statusCode: webhookTestResult.statusCode,
            error: webhookTestResult.error,
          },
        });
      }
    }
  }, [webhookTestResult, logEvent]);

  return (
    <div className="space-y-4" data-testid="outbound-webhook-section">
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">
          {tOrgs("outboundWebhookTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {tOrgs("outboundWebhookDescription")}{" "}
          <Link
            className="text-primary underline hover:text-primary/80"
            href={`${process.env.NEXT_PUBLIC_DOCS_URL}/docs/integration/webhook-callbacks`}
            target="_blank"
            data-testid="outbound-webhook-documentation-link"
            onClick={async () => {
              await logEvent({
                eventType: "org_api_settings_documentation_link_clicked",
                eventData: {
                  section: "outbound-webhooks",
                },
              });
            }}
          >
            {tOrgs("viewWebhookDocumentation")}
          </Link>
          .
        </p>
      </div>

      {/* Endpoint URL */}
      <div className="space-y-2">
        <Label htmlFor="edit-org-webhook-callback-url" className="text-sm font-medium">
          {tOrgs("webhookEndpointUrl")}
        </Label>
        <Input
          id="edit-org-webhook-callback-url"
          type="url"
          value={editWebhookCallbackUrl}
          onChange={(e) => setEditWebhookCallbackUrl(e.target.value)}
          placeholder={tOrgs("webhookEndpointUrlPlaceholder")}
          data-testid="edit-org-webhook-callback-url-input"
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          {tOrgs("webhookEndpointUrlDescription")}
        </p>
      </div>

      {/* Webhook Signing Secret */}
      <div className="space-y-2">
        <Label htmlFor="edit-org-webhook-signing-secret" className="text-sm font-medium">
          {tOrgs("webhookSigningSecret")}
        </Label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              id="edit-org-webhook-signing-secret"
              type={showWebhookSigningSecret ? "text" : "password"}
              value={webhookSigningSecret || ""}
              onChange={(e) => setWebhookSigningSecret(e.target.value || null)}
              placeholder={tOrgs("webhookSigningSecretPlaceholder")}
              data-testid="webhook-signing-secret-input"
              className="font-mono text-sm pr-10"
            />
            <button
              type="button"
              onClick={async () => {
                const newValue = !showWebhookSigningSecret;
                setShowWebhookSigningSecret(newValue);
                await logEvent({
                  eventType: "org_api_settings_webhook_signing_secret_toggled",
                  eventData: {
                    visible: newValue,
                  },
                });
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              data-testid="toggle-webhook-signing-secret-visibility"
            >
              {showWebhookSigningSecret ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {webhookSigningSecret && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={async () => {
                      await copyWebhookSigningSecret();
                      await logEvent({
                        eventType: "org_api_settings_webhook_signing_secret_copied",
                      });
                    }}
                    data-testid="webhook-signing-secret-copy-button"
                  >
                    {isWebhookSigningSecretCopied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {isWebhookSigningSecretCopied
                      ? tOrgs("webhookSigningSecretCopied")
                      : tOrgs("webhookSigningSecretCopyTooltip")}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {tOrgs("webhookSigningSecretDescription")}
        </p>
      </div>

      {/* Test Result */}
      {webhookTestResult && (
        <div
          className={`p-3 rounded-md text-sm ${webhookTestResult.success
              ? "bg-green-500/20 text-green-500"
              : "bg-red-500/20 text-red-500"
            }`}
          data-testid="webhook-test-result"
        >
          {webhookTestResult.success ? (
            <p>
              {tOrgs("testWebhookSuccess")}
              {webhookTestResult.statusCode &&
                ` (HTTP ${webhookTestResult.statusCode})`}
            </p>
          ) : (
            <p>
              {tOrgs("testWebhookFailed")}: {webhookTestResult.error}
              {webhookTestResult.statusCode &&
                ` (HTTP ${webhookTestResult.statusCode})`}
            </p>
          )}
        </div>
      )}

      {/* Test Button */}
      <div className="flex items-center gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            await logEvent({
              eventType: "org_api_settings_webhook_test_clicked",
            });
            await testWebhook();
          }}
          disabled={
            isTestingWebhook ||
            !editWebhookCallbackUrl.trim()
          }
          data-testid="test-webhook-button"
        >
          {isTestingWebhook
            ? tOrgs("testWebhookTesting")
            : tOrgs("testWebhook")}
        </Button>
      </div>
    </div>
  );
}
