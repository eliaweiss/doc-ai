"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FieldDefinition } from "@zdocs/types";
import { useTranslations } from "next-intl";
import { Badge, cn } from "@zdocs/client-component";
import { Button } from "@zdocs/client-component";
import { 
  Lock, 
  Search, 
  GripVertical, 
  Edit2, 
  Trash2, 
  Type,
  Hash,
  DollarSign,
  Calendar,
  CheckSquare,
  List,
  Plus,
  Code,
  type LucideIcon
} from "lucide-react";
import { useSchemaPage } from "../context/SchemaPageProvider";
import { useConfirm } from "../../../context-providers/confirm-provider/ConfirmProvider";

function getFieldIcon(type: FieldDefinition["type"]): LucideIcon {
  switch (type) {
    case "text":
      return Type;
    case "number":
      return Hash;
    case "currency":
      return DollarSign;
    case "date":
      return Calendar;
    case "boolean":
      return CheckSquare;
    case "enum":
      return List;
    case "sum":
      return Plus;
    case "code":
      return Code;
    default:
      return Type;
  }
}

interface DraggableFieldCardProps {
  field: FieldDefinition;
  schemaName: string;
  collectionKey?: string;
  onClick: () => void;
}

export function DraggableFieldCard({
  field,
  schemaName,
  collectionKey,
  onClick,
}: DraggableFieldCardProps) {
  const t = useTranslations("schema");
  const { deleteField } = useSchemaPage();
  const confirm = useConfirm();
  const id = `${schemaName}_${collectionKey || "header"}_${field.name}`;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirm({
      title: t("deleteFieldTitle"),
      message: t("deleteFieldConfirmation", { name: field.displayName }),
      confirmLabel: t("deleteField"),
      cancelLabel: t("cancel"),
    });

    if (confirmed) {
      await deleteField(collectionKey, field.name);
    }
  };

  const descriptionSnippet = field.description
    ? field.description.length > 50
      ? `${field.description.substring(0, 50)}...`
      : field.description
    : "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      onDoubleClick={onClick}
      className={cn("relative flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-card hover:bg-accent/50 transition-all group cursor-pointer",
        field.hidden ? "opacity-60 grayscale-[0.5]" : "",
        isDragging ? "shadow-lg ring-2 ring-primary" : "",
      )}
      data-testid={`field-card-${field.name}`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-accent/50 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        data-testid={`field-drag-handle-${field.name}`}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Field Icon */}
      <div className="flex-shrink-0">
        {(() => {
          const Icon = getFieldIcon(field.type);
          return <Icon className="w-4 h-4 text-muted-foreground" data-testid={`field-icon-${field.name}`} />;
        })()}
      </div>

      {/* Field Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-6">
          <span className="font-medium text-foreground truncate">
            {field.displayName}
          </span>
          {descriptionSnippet && (
            <div className="flex-1 min-w-0 hidden md:block" data-testid={`field-description-${field.name}`}>
              <span className="text-sm text-muted-foreground truncate">
                {descriptionSnippet}
              </span>
            </div>
          )}
        </div>
      </div>




      <div className="flex items-center gap-1">

        {field.required && (
          <Lock className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
        )}
        {field.searchable && (
          <Search className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        )}
      </div>
      {/* Type Badge */}
      <div className="flex-shrink-0">
        <Badge
          variant="outline"
          className="font-mono text-[10px] uppercase h-5 px-1.5"
        >
          {field.type}
        </Badge>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onClick}
          data-testid={`field-edit-btn-${field.name}`}
        >
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleDelete}
          data-testid={`field-delete-btn-${field.name}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {field.hidden && (
        <Badge
          variant="outline"
          className="absolute -top-1 -right-1 text-[10px] h-4 px-1 bg-background flex-shrink-0"
        >
          {t("hidden")}
        </Badge>
      )}
    </div>
  );
}

