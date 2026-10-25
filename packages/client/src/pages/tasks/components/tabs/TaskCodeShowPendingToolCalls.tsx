import { cn, getAiPartToolName, isAiPartToolCall } from "../../../../lib/utils";
import {
  useMessagePart,
  Tool,
  ToolInput,
  ToolContent,
  ToolHeader,
  ToolOutput,
} from "@zdocs/client-component";
import { UIToolInvocation } from "ai";

export function TaskCodeShowPendingToolCalls() {
  const { part } = useMessagePart();

  // Check for tool calls first (they have types like "tool-displayHtml")
  if (!isAiPartToolCall(part)) {
    return null;
  }
  const toolPart = part as UIToolInvocation<any>;

  return (
    <div
      className={cn(
        "transition-all duration-1000 overflow-hidden",
        toolPart.state === "output-available"
          ? "opacity-0 max-h-0"
          : "opacity-100 max-h-[500px]"
      )}
      data-testid="task-code-show-pending-tool-calls"
    >
      <Tool>
        <ToolHeader
          state={toolPart.state}
          title={getAiPartToolName(part)}
          type={`tool-${getAiPartToolName(part)}`}
        />
        <ToolContent>
          <ToolInput input={toolPart.input} />
          <ToolOutput output={toolPart.output} errorText={toolPart.errorText} />
        </ToolContent>
      </Tool>
    </div>
  );
}
