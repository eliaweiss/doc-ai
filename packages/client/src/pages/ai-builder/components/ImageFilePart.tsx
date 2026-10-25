import { useState } from "react";
import { DownloadIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import {
  Message,
  MessageContent,
  useMessagePart,
} from "@zdocs/client-component";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogTrigger,
} from "@zdocs/client-component";
import { Button } from "@zdocs/client-component";

type FilePart = {
  type: "file";
  mediaType: string;
  url: string;
};

export function ImageFilePart() {
  const { part, message, partIndex } = useMessagePart();
  const [isZoomed, setIsZoomed] = useState(false);

  const filePart = part as FilePart;

  if (filePart.type !== "file" || !filePart.mediaType?.startsWith("image/")) {
    return null;
  }

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = filePart.url;
    link.download = `chart-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Message
      key={`${message.id}-${partIndex}`}
      from={message.role}
      data-testid={`message-image-${message.role}`}
    >
      <MessageContent>
        <div
          className="relative group rounded-lg overflow-hidden border border-border bg-muted/30"
          data-testid="image-file-container"
        >
          <Dialog>
            <DialogTrigger asChild>
              <button
                className="block cursor-zoom-in w-full"
                data-testid="image-zoom-trigger"
              >
                <img
                  src={filePart.url}
                  alt="Generated visualization"
                  className="max-w-full h-auto rounded-lg transition-transform hover:scale-[1.02]"
                  data-testid="generated-image"
                />
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 overflow-auto">
              <DialogHeader>
                <DialogTitle>Generated visualization</DialogTitle>
              </DialogHeader>
              <img
                src={filePart.url}
                alt="Generated visualization (full size)"
                className={`w-full h-auto ${isZoomed ? "cursor-zoom-out scale-150" : "cursor-zoom-in"
                  } transition-transform`}
                onClick={() => setIsZoomed(!isZoomed)}
                data-testid="zoomed-image"
              />
            </DialogContent>
          </Dialog>

          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 bg-background/80 backdrop-blur-sm"
              onClick={handleDownload}
              data-testid="download-image-button"
            >
              <DownloadIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </MessageContent>
    </Message>
  );
}
