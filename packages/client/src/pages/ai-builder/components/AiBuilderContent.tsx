import { useState, useEffect } from "react";
import { ResizableSplitPane } from "../../../components/ui/resizable-split-pane";
import { AiBuilderChatPane } from "./AiBuilderChatPane";
import { MiniAppPreviewPane } from "./MiniAppPreviewPane";
import { useAiBuilder } from "../context/AiBuilderProvider";



export function AiBuilderContent() {
  const { isFullscreen } = useAiBuilder();




  // Use hidePane prop to show only the right pane when fullscreen
  // This keeps MiniAppPreviewPane mounted in the same position, preventing remount
  return (
    <div className="flex-1 h-full" data-testid="ai-builder-content">
      <ResizableSplitPane
        leftPane={<AiBuilderChatPane />}
        rightPane={
          <MiniAppPreviewPane />
        }
        hidePane={isFullscreen ? "left" : "none"}
        initialLeftWidthPercent={50}
        minLeftWidthPercent={30}
        maxLeftWidthPercent={70}
        storageKey="ai-builder-split"
      />
    </div>
  );
}
