"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Input, Separator } from "@zdocs/client-component";
import { Textarea } from "@zdocs/client-component";
import { Label } from "@zdocs/client-component";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zdocs/client-component";
import { useOrganizationSettings } from "../OrganizationSettingsProvider";
import { useLogUserJourneyEvent } from "../../../../utilities/api/logUserJourneyEventApi";
import useOrgStore from "../../../../context-providers/orgStore";

const TIMEZONES: [string, string][] = [
  ["UTC", "UTC"],
  ["America/New_York", "America/New_York (EST/EDT)"],
  ["America/Chicago", "America/Chicago (CST/CDT)"],
  ["America/Denver", "America/Denver (MST/MDT)"],
  ["America/Los_Angeles", "America/Los_Angeles (PST/PDT)"],
  ["Europe/London", "Europe/London (GMT/BST)"],
  ["Europe/Paris", "Europe/Paris (CET/CEST)"],
  ["Europe/Berlin", "Europe/Berlin (CET/CEST)"],
  ["Asia/Tokyo", "Asia/Tokyo (JST)"],
  ["Asia/Shanghai", "Asia/Shanghai (CST)"],
  ["Asia/Dubai", "Asia/Dubai (GST)"],
  ["Asia/Kolkata", "Asia/Kolkata (IST)"],
  ["Australia/Sydney", "Australia/Sydney (AEDT/AEST)"],
  ["America/Sao_Paulo", "America/Sao_Paulo (BRT/BRST)"],
  ["America/Mexico_City", "America/Mexico_City (CST/CDT)"],
  ["America/Toronto", "America/Toronto (EST/EDT)"],
  ["Asia/Hong_Kong", "Asia/Hong_Kong (HKT)"],
  ["Asia/Singapore", "Asia/Singapore (SGT)"],
  ["Europe/Moscow", "Europe/Moscow (MSK)"],
  ["Asia/Jerusalem", "Asia/Jerusalem (IST)"],
];

export function BasicInfoSection() {
  const tOrgs = useTranslations("organizations");
  const tLocal = useTranslations("localSettings");
  const { org } = useOrgStore();
  const {
    editDescription,
    editBaseCurrency,
    editTimezone,
    setEditDescription,
    setEditBaseCurrency,
    setEditTimezone,
  } = useOrganizationSettings();
  const { logEvent } = useLogUserJourneyEvent();

  // The default is the machine's timezone, which may not be in the short list
  const timezoneOptions =
    editTimezone && !TIMEZONES.some(([value]) => value === editTimezone)
      ? [[editTimezone, editTimezone] as [string, string], ...TIMEZONES]
      : TIMEZONES;

  useEffect(() => {
    if (org?.id) {
      logEvent({
        eventType: "org_settings_basic_info_section_viewed",
        eventData: { orgId: org.id },
      });
    }
  }, [org?.id, logEvent]);

  return (
    <>
      {/* doc-ai: no organization name or color; these are app-wide preferences */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-org-currency">{tLocal("baseCurrency")}</Label>
          <Input
            id="edit-org-currency"
            value={editBaseCurrency}
            onChange={(e) => setEditBaseCurrency(e.target.value)}
            data-testid="edit-org-currency-input"
          />
        </div>

        <div className="space-y-2" data-testid="edit-org-timezone-container">
          <Label htmlFor="edit-org-timezone">{tOrgs("timezone")}</Label>
          <Select
            value={editTimezone}
            onValueChange={setEditTimezone}
            data-testid="edit-org-timezone-select"
          >
            <SelectTrigger id="edit-org-timezone">
              <SelectValue placeholder={tOrgs("timezonePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {timezoneOptions.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-org-description">
          {tLocal("businessDescription")}
        </Label>
        <Textarea
          id="edit-org-description"
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          data-testid="edit-org-description-input"
          rows={3}
        />
        <p className="text-xs text-muted-foreground">{tLocal("businessDescriptionHint")}</p>
      </div>

      {/* doc-ai: single local user, so no sharing and no API/Webhook settings */}

    </>
  );
}
