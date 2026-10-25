"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Settings, Trash2 } from "lucide-react";
import type { Organization } from "@zdocs/types";
import useOrgStore from "../../../context-providers/orgStore";
import { zFetch } from "../../../lib/utils";
import { toast } from "sonner";
import { useConfirm } from "../../../context-providers/confirm-provider/ConfirmProvider";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

interface OrganizationSwitcherProps {
  onOpenSettings: (org: Organization) => void;
  onOpenCreateDialog: () => void;
}

export function OrganizationSwitcher({
  onOpenSettings,
  onOpenCreateDialog,
}: OrganizationSwitcherProps) {
  const t = useTranslations("appPage");
  const tOrgs = useTranslations("organizations");
  const router = useRouter();
  const { org, setOrg, organizations, removeOrganization } = useOrgStore();
  const { logEvent } = useLogUserJourneyEvent();
  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false);
  const [deletingOrgId, setDeletingOrgId] = useState<string | null>(null);
  const confirm = useConfirm();

  const handleOrgSelect = (selectedOrg: Organization) => {
    logEvent({
      eventType: "browse_header_org_switched",
      eventData: {
        orgId: selectedOrg.id,
        previousOrgId: org?.id || null,
      },
    });
    setOrg(selectedOrg);
    setIsOrgMenuOpen(false);
    // Redirect to root path when org changes
    router.push("/");
  };

  const handleDeleteOrg = async (orgToDelete: Organization) => {
    const confirmed = await confirm({
      title: tOrgs("deleteTitle"),
      message: tOrgs("deleteConfirmation", { name: orgToDelete.name }),
      confirmLabel: tOrgs("delete"),
      cancelLabel: tOrgs("cancel"),
    });

    if (!confirmed) {
      logEvent({
        eventType: "browse_header_org_delete_cancelled",
        eventData: {
          orgId: orgToDelete.id,
        },
      });
      return;
    }

    setDeletingOrgId(orgToDelete.id);
    try {
      await zFetch(`/api/org/${orgToDelete.id}/delete`, {
        method: "POST",
      });

      logEvent({
        eventType: "browse_header_org_deleted",
        eventData: {
          orgId: orgToDelete.id,
        },
      });

      // Remove from store
      removeOrganization(orgToDelete.id);

      // If deleted org is current, switch to first available or clear
      if (org?.id === orgToDelete.id) {
        const remainingOrgs = organizations.filter(
          (o) => o.id !== orgToDelete.id
        );
        if (remainingOrgs.length > 0) {
          setOrg(remainingOrgs[0]);
          router.push("/");
        } else {
          setOrg(null);
          router.push("/");
        }
      }

      toast.success(tOrgs("deleted"));
    } catch (error) {
      console.error("Failed to delete organization:", error);
      toast.error(tOrgs("failedToDelete"));
    } finally {
      setDeletingOrgId(null);
    }
  };

  return (
    <div className="relative" data-testid="org-switcher">
      <button
        onClick={() => {
          setIsOrgMenuOpen(!isOrgMenuOpen);
          if (!isOrgMenuOpen) {
            logEvent({
              eventType: "browse_header_org_menu_opened",
            });
          }
        }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors"
        data-testid="org-switcher-btn"
      >
        {org?.color && (
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: org.color }}
            data-testid="org-switcher-color"
          />
        )}
        <span className="text-sm text-foreground">
          {t("org")}: {org?.name || t("selectOrg")}
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </button>

      {isOrgMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOrgMenuOpen(false)}
          />
          <div
            className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-lg shadow-lg z-20"
            data-testid="org-menu"
          >
            {organizations.map((orgItem) => (
              <div
                key={orgItem.id}
                className={`flex items-center group ${org?.id === orgItem.id ? "bg-accent" : ""
                  }`}
                data-testid={`org-option-wrapper-${orgItem.id}`}
              >
                <button
                  onClick={() => handleOrgSelect(orgItem)}
                  className={`flex-1 text-left px-4 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 ${org?.id === orgItem.id ? "bg-accent" : ""
                    }`}
                  data-testid={`org-option-${orgItem.id}`}
                >
                  {orgItem.color && (
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: orgItem.color }}
                      data-testid={`org-color-${orgItem.id}`}
                    />
                  )}
                  <span className="text-foreground">{orgItem.name}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenSettings(orgItem);
                    setIsOrgMenuOpen(false);
                  }}
                  className="px-2 py-2 text-sm text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                  data-testid={`org-settings-${orgItem.id}`}
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteOrg(orgItem);
                  }}
                  disabled={deletingOrgId === orgItem.id}
                  className="px-2 py-2 text-sm text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  data-testid={`org-delete-${orgItem.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="border-t border-border my-1" />
            <button
              onClick={() => {
                setIsOrgMenuOpen(false);
                onOpenCreateDialog();
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors rounded-b-lg flex items-center gap-2"
              data-testid="org-option-new"
            >
              <Plus className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground">{tOrgs("createNew")}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
