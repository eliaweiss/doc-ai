"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuickAccess } from "../../../context-providers/QuickAccessProvider";
import { getSystemApps, type SystemApp } from "../utils/systemApps";
import { DraggableAppShortcut } from "./DraggableAppShortcut";
import { Loader2 } from "lucide-react";
import useAppStore from "../../../context-providers/appStore";
import { toast } from "sonner";
import { useLogUserJourneyEvent } from "../../../utilities/api/logUserJourneyEventApi";
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

type ResolvedApp = {
  id: string;
  appId: string;
  appType: "system" | "mini_app";
  name: string;
  description?: string;
  iconComponent?: any;
  icon?: string | null;
  color?: string | null;
  path: string;
};

export function QuickAccessBar() {
  const t = useTranslations("appPage");
  const router = useRouter();
  const { miniApps, miniAppsLoading } = useAppStore();
  const { items, isLoading, disable, isEnabled, reorder } = useQuickAccess();
  const [isReordering, setIsReordering] = useState(false);
  const { logEvent } = useLogUserJourneyEvent();
  const hasLoggedView = useRef(false);

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

  // Resolve app data for each quick access item
  const resolvedApps = (items
    .map((item): ResolvedApp | null => {
      if (item.appType === "system") {
        const systemApp = getSystemApps().find((app: SystemApp) => app.id === item.appId);
        if (systemApp) {
          return {
            id: item.id,
            appId: item.appId,
            appType: item.appType,
            name: t(systemApp.translationKey),
            description: t(`${systemApp.translationKey}Description`),
            iconComponent: systemApp.icon,
            color: systemApp.color,
            path: systemApp.path,
          };
        }
      } else {
        // For mini apps, resolve from the store
        const miniApp = miniApps.find((app) => app.id === item.appId);
        if (miniApp) {
          return {
            id: item.id,
            appId: item.appId,
            appType: item.appType,
            name: miniApp.name,
            description: miniApp.description || undefined,
            icon: miniApp.icon,
            color: miniApp.color,
            path: `/app/${miniApp.id}`, // doc-ai: view-only route, no AI builder
          };
        }
        // If mini app not found yet, return null (will be filtered out)
        return null;
      }
      return null;
    })
    .filter((app): app is ResolvedApp => app !== null));

  useEffect(() => {
    if (resolvedApps.length > 0 && !hasLoggedView.current) {
      hasLoggedView.current = true;
      logEvent({
        eventType: "quick_access_bar_viewed",
        eventData: { appCount: resolvedApps.length },
      });
    }
  }, [resolvedApps.length, logEvent]);

  if (isLoading || miniAppsLoading) {
    return (
      <div
        className="border-b border-border px-6 py-2 flex items-center justify-center gap-2"
        data-testid="quick-access-loading"
      >
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0 || resolvedApps.length === 0) {
    return null;
  }

  const handleAppClick = (app: ResolvedApp) => {
    logEvent({
      eventType: "quick_access_app_clicked",
      eventData: { appId: app.appId, appType: app.appType, appName: app.name },
    });
    router.push(app.path);
  };

  const handleDisable = async (appId: string, appType: "system" | "mini_app") => {
    try {
      await disable({ appId, appType });
      logEvent({
        eventType: "quick_access_app_disabled",
        eventData: { appId, appType },
      });
      toast.success("App disabled from quick access");
    } catch (error) {
      logEvent({
        eventType: "quick_access_app_disable_error",
        eventData: { appId, appType },
      });
      toast.error("Failed to disable app");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = resolvedApps.findIndex((app) => app.id === active.id);
      const newIndex = resolvedApps.findIndex((app) => app.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(resolvedApps, oldIndex, newIndex);
        const itemIds = newOrder.map((app) => app.id);

        setIsReordering(true);
        try {
          await reorder(itemIds);
          logEvent({
            eventType: "quick_access_app_reordered",
            eventData: { itemCount: itemIds.length },
          });
        } catch (error) {
          toast.error("Failed to reorder apps");
          console.error("Error reordering apps:", error);
        } finally {
          setIsReordering(false);
        }
      }
    }
  };

  const itemIds = resolvedApps.map((app) => app.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div
          className={`w-full border-b border-border px-0 py-2 md:px-6 flex flex-col gap-2 ${isReordering ? "opacity-70 pointer-events-none" : ""
            }`}
          data-testid="quick-access-bar"
        >
          {resolvedApps.map((app) => (
            <DraggableAppShortcut
              key={app.id}
              id={app.id}
              name={app.name}
              description={app.description}
              icon={app.icon}
              iconComponent={app.iconComponent}
              color={app.color}
              onClick={() => handleAppClick(app)}
              testId={`quick-access-${app.appId}`}
              showEnableSwitch
              isEnabled={isEnabled(app.appId, app.appType)}
              onDisable={() => handleDisable(app.appId, app.appType)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
