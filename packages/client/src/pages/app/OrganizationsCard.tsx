"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@zdocs/client-component";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zdocs/client-component";
import { Input } from "@zdocs/client-component";
import { Building2, RefreshCw, Plus, X } from "lucide-react";
import type { Organization } from "@zdocs/types";

interface OrganizationsCardProps {
  organizations: Organization[];
  selectedOrg: Organization | null;
  isLoading: boolean;
  onSelectOrg: (org: Organization) => void;
  onOrgCreated: (org: Organization) => void;
}

export function OrganizationsCard({
  organizations,
  selectedOrg,
  isLoading,
  onSelectOrg,
  onOrgCreated,
}: OrganizationsCardProps) {
  const t = useTranslations("organizations");
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgDescription, setNewOrgDescription] = useState("");
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [createOrgError, setCreateOrgError] = useState<string | null>(null);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) {
      setCreateOrgError(t("nameRequired"));
      return;
    }

    setIsCreatingOrg(true);
    setCreateOrgError(null);

    try {
      const response = await fetch("/api/org/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newOrgName.trim(),
          description: newOrgDescription.trim() || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        onOrgCreated(data.organization);
        setNewOrgName("");
        setNewOrgDescription("");
        setShowCreateOrg(false);
      } else {
        const data = await response.json();
        setCreateOrgError(data.error || t("failedToCreate"));
      }
    } catch (error) {
      console.error("Failed to create organization:", error);
      setCreateOrgError(t("failedToCreate"));
    } finally {
      setIsCreatingOrg(false);
    }
  };

  return (
    <Card data-testid="app-orgs-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div data-testid="app-orgs-header">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {t("title")}
            </CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCreateOrg(!showCreateOrg)}
            className="text-muted-foreground hover:text-foreground"
            data-testid="app-orgs-toggle-create-btn"
          >
            {showCreateOrg ? (
              <X className="w-4 h-4" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Create Organization Form */}
        {showCreateOrg && (
          <div
            className="mb-4 p-4 bg-secondary rounded-lg border border-border"
            data-testid="app-orgs-create-form"
          >
            <h4 className="text-sm font-medium text-foreground mb-3">
              {t("createNew")}
            </h4>
            <div className="space-y-3">
              <Input
                placeholder={t("namePlaceholder")}
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                data-testid="app-orgs-create-name-input"
              />
              <Input
                placeholder={t("descriptionPlaceholder")}
                value={newOrgDescription}
                onChange={(e) => setNewOrgDescription(e.target.value)}
                data-testid="app-orgs-create-desc-input"
              />
              {createOrgError && (
                <p
                  className="text-destructive text-sm"
                  data-testid="app-orgs-create-error"
                >
                  {createOrgError}
                </p>
              )}
              <Button
                onClick={handleCreateOrg}
                disabled={isCreatingOrg || !newOrgName.trim()}
                className="w-full"
                data-testid="app-orgs-create-submit-btn"
              >
                {isCreatingOrg ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    {t("creating")}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    {t("createButton")}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Organizations List */}
        {isLoading ? (
          <div
            className="flex justify-center py-4"
            data-testid="app-orgs-loading"
          >
            <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : organizations.length === 0 ? (
          <div className="text-center py-4" data-testid="app-orgs-empty">
            <p className="text-muted-foreground text-sm mb-3">
              {t("noOrganizations")}
            </p>
            {!showCreateOrg && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateOrg(true)}
                data-testid="app-orgs-empty-create-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("createFirst")}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2" data-testid="app-orgs-list">
            {organizations.map((organization) => (
              <button
                key={organization.id}
                onClick={() => onSelectOrg(organization)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  selectedOrg?.id === organization.id
                    ? "bg-primary/20 border border-primary/50 text-primary"
                    : "bg-secondary hover:bg-accent text-foreground border border-transparent"
                }`}
                data-testid={`app-org-item-${organization.id}`}
              >
                <div className="font-medium">{organization.name}</div>
                {organization.description && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {organization.description}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
