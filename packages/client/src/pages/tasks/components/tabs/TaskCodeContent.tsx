import { useState } from "react";
import { ResizableSplitPane } from "../../../../components/ui/resizable-split-pane";
import { TaskCodeChatPane } from "./TaskCodeChatPane";
import { TaskCodeEditorPane } from "./TaskCodeEditorPane";
import { TaskCodeChatProvider } from "../../context/TaskCodeChatProvider";

interface TaskCodeContentProps {
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

function TaskCodeContentInner({ onFullscreenChange }: TaskCodeContentProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleFullscreenChange = (fullscreen: boolean) => {
    setIsFullscreen(fullscreen);
    onFullscreenChange?.(fullscreen);
  };

  // Show only code editor pane when in fullscreen mode
  if (isFullscreen) {
    return (
      <div className="flex-1 h-full" data-testid="task-code-content">
        <TaskCodeEditorPane onFullscreenChange={handleFullscreenChange} />
      </div>
    );
  }

  // Show split pane - chat on left, code editor on right
  return (
    <div className="flex-1 h-full" data-testid="task-code-content">
      <ResizableSplitPane
        leftPane={<TaskCodeChatPane />}
        rightPane={
          <TaskCodeEditorPane onFullscreenChange={handleFullscreenChange} />
        }
        initialLeftWidthPercent={50}
        minLeftWidthPercent={30}
        maxLeftWidthPercent={70}
        storageKey="task-code-split"
      />
    </div>
  );
}

export function TaskCodeContent({ onFullscreenChange }: TaskCodeContentProps) {
  return (
    <TaskCodeChatProvider>
      <TaskCodeContentInner onFullscreenChange={onFullscreenChange} />
    </TaskCodeChatProvider>
  );
}
