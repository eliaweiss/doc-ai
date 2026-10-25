"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@zdocs/client-component";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zdocs/client-component";
import { Input } from "@zdocs/client-component";
import { Checkbox } from "@zdocs/client-component";
import { Label } from "@zdocs/client-component";
import { SYSTEM_DOCUMENT_TYPES } from "@zdocs/types";
import type { Organization } from "@zdocs/types";
import { zFetch } from "../../../lib/utils";
import { toast } from "sonner";

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (organization: Organization) => void;
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateOrganizationDialogProps) {
  const tOrgs = useTranslations("organizations");
  const [newOrgName, setNewOrgName] = useState("");
  const [selectedSchemas, setSelectedSchemas] = useState<string[]>(
    SYSTEM_DOCUMENT_TYPES.map((t) => t.name)
  );
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) {
      toast.error(tOrgs("nameRequired"));
      return;
    }

    setIsCreating(true);
    try {
      const data = await zFetch(
        "/api/org/create",
        {
          method: "POST",
          body: {
            name: newOrgName.trim(),
            selectedSchemas: selectedSchemas,
          },
        }
      );
      onSuccess(data.organization);
      setNewOrgName("");
      setSelectedSchemas(SYSTEM_DOCUMENT_TYPES.map((t) => t.name));
      onOpenChange(false);
      toast.success(tOrgs("title") + " created");
    } catch (error) {
      console.error("Failed to create organization:", error);
      toast.error(tOrgs("failedToCreate"));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tOrgs("createNew")}</DialogTitle>
          <DialogDescription>{tOrgs("description")}</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">{tOrgs("namePlaceholder")}</Label>
            <Input
              id="org-name"
              placeholder={tOrgs("namePlaceholder")}
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateOrg();
              }}
              data-testid="new-org-name-input"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                {tOrgs("selectSchemas")}
              </Label>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => {
                  if (selectedSchemas.length === SYSTEM_DOCUMENT_TYPES.length) {
                    setSelectedSchemas([]);
                  } else {
                    setSelectedSchemas(
                      SYSTEM_DOCUMENT_TYPES.map((t) => t.name)
                    );
                  }
                }}
              >
                {selectedSchemas.length === SYSTEM_DOCUMENT_TYPES.length
                  ? tOrgs("deselectAll")
                  : tOrgs("selectAll")}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-[200px] overflow-y-auto p-1 border rounded-md">
              {SYSTEM_DOCUMENT_TYPES.map((type) => (
                <div
                  key={type.name}
                  className="flex items-center space-x-2"
                  data-testid={`schema-option-${type.name}`}
                >
                  <Checkbox
                    id={`schema-${type.name}`}
                    checked={selectedSchemas.includes(type.name)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedSchemas([...selectedSchemas, type.name]);
                      } else {
                        setSelectedSchemas(
                          selectedSchemas.filter((s) => s !== type.name)
                        );
                      }
                    }}
                  />
                  <Label
                    htmlFor={`schema-${type.name}`}
                    className="text-sm font-normal cursor-pointer flex items-center gap-2"
                  >
                    <span>{type.displayName}</span>
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tOrgs("cancel")}
          </Button>
          <Button
            onClick={handleCreateOrg}
            disabled={isCreating || !newOrgName.trim()}
          >
            {isCreating ? tOrgs("creating") : tOrgs("createButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
