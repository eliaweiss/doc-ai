"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { FieldDefinition } from "@zdocs/types";
import { DraggableFieldCard } from "./DraggableFieldCard";
import { AddFieldCard } from "./AddFieldCard";
import { AddFieldDialog } from "./AddFieldDialog";
import { useSchemaPage } from "../context/SchemaPageProvider";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";

interface DraggableFieldGridProps {
  fields: FieldDefinition[];
  schemaName: string;
  collectionKey?: string;
  onFieldClick: (field: FieldDefinition, collectionKey?: string) => void;
}

export function DraggableFieldGrid({
  fields,
  schemaName,
  collectionKey,
  onFieldClick,
}: DraggableFieldGridProps) {
  const { reorderFields } = useSchemaPage();
  const [isReordering, setIsReordering] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { logEvent } = useLogUserJourneyEvent();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fieldIds = fields.map(
    (field) => `${schemaName}_${collectionKey || "header"}_${field.name}`
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = fieldIds.indexOf(active.id as string);
      const newIndex = fieldIds.indexOf(over.id as string);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newFieldOrder = arrayMove(fields, oldIndex, newIndex).map(
          (f) => f.name
        );

        setIsReordering(true);
        try {
          await reorderFields(collectionKey, newFieldOrder);
          logEvent({
            eventType: "schema_fields_reordered",
            eventData: {
              collectionKey,
              fieldCount: newFieldOrder.length,
            },
          });
        } finally {
          setIsReordering(false);
        }
      }
    }
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
          <div
            className={`space-y-1 ${
              isReordering ? "opacity-70 pointer-events-none" : ""
            }`}
            data-testid={`field-list-${collectionKey || "header"}`}
          >
            {fields.map((field) => (
              <DraggableFieldCard
                key={`${schemaName}_${collectionKey || "header"}_${field.name}`}
                field={field}
                schemaName={schemaName}
                collectionKey={collectionKey}
                onClick={() => onFieldClick(field, collectionKey)}
              />
            ))}
            <AddFieldCard
              onClick={() => {
                setIsAddDialogOpen(true);
                logEvent({
                  eventType: "schema_field_add_dialog_opened",
                  eventData: { collectionKey },
                });
              }}
            />
          </div>
        </SortableContext>
      </DndContext>

      <AddFieldDialog
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        collectionKey={collectionKey}
        onFieldCreated={(field, colKey) => onFieldClick(field, colKey)}
      />
    </>
  );
}

