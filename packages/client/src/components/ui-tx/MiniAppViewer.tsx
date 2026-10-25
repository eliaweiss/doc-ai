/**
 * Mini App Viewer Component
 *
 * Renders a Mini App in an iframe and handles uiTx postMessage communication.
 * This component sets up the message bridge between the iframe and parent window.
 */

"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { Printer } from 'lucide-react';
import { createPortal } from "react-dom";
import { useUiTxMessageHandler } from "../../hooks/useUiTxMessageHandler";
import useOrgStore from "../../context-providers/orgStore";
import { isMobileWidth } from "@zdocs/util";
import { useTheme } from "../../hooks/useTheme";

export interface ConsoleLog {
  type: "error" | "warn" | "log";
  message: unknown;
  timestamp: number;
}

interface MiniAppViewerProps {
  html: string;
  title?: string;
  isFullscreen?: boolean;
  onClose?: () => void;
  onFullscreen?: (isFullscreen: boolean) => void;
  onLog?: (log: ConsoleLog) => void;
}

export function MiniAppViewer({
  html,
  title = "Mini App",
  isFullscreen = false,
  onClose,
  onFullscreen,
  onLog,
}: MiniAppViewerProps) {
  const isMobile = isMobileWidth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { org } = useOrgStore();
  const { isDark } = useTheme();

  // Set up message handler for UI helpers
  useUiTxMessageHandler({
    orgId: org?.id || "",
    // iframeRef is optional and not currently used in the hook implementation
  });

  // Theme detection script to inject into HTML
  const themeDetectionScript = useMemo(() => {
    const theme = isDark ? "dark" : "light";
    return `
<script>
(function() {
  // Expose theme state to iframe
  window.__PARENT_THEME__ = '${theme}';
  window.__IS_DARK_MODE__ = ${isDark};
  
  // Dispatch custom event when theme is available
  window.dispatchEvent(new CustomEvent('parent-theme-ready', { 
    detail: { theme: '${theme}', isDark: ${isDark} }
  }));
  
  // Listen for theme changes from parent
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'mini-app-theme-change') {
      window.__PARENT_THEME__ = event.data.theme;
      window.__IS_DARK_MODE__ = event.data.isDark;
      window.dispatchEvent(new CustomEvent('parent-theme-change', { 
        detail: { theme: event.data.theme, isDark: event.data.isDark }
      }));
    }
  });
})();
</script>
`;
  }, [isDark]);

  // Error capture script to inject into HTML
  const errorCaptureScript = useMemo(
    () => `
<script>
(function() {
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;

  function stringify(arg) {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (arg instanceof Error) return arg.stack || arg.message;
    if (typeof arg === 'object') {
      const seen = new WeakSet();
      try {
        return JSON.stringify(arg, function(key, value) {
          if (typeof value === 'bigint') return value.toString();
          if (value instanceof Error) return value.stack || value.message;
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) return '[Circular]';
            seen.add(value);
          }
          return value;
        }, 2);
      } catch(e) {
        return String(arg);
      }
    }
    return String(arg);
  }

  function postLog(type, args) {
    window.parent.postMessage({
      type: 'mini-app-console-log',
      log: { type: type, message: args.map(stringify).join(' '), timestamp: Date.now() }
    }, '*');
  }

  console.error = function(...args) {
    originalError.apply(console, args);
    postLog('error', args);
  };

  console.warn = function(...args) {
    originalWarn.apply(console, args);
    postLog('warn', args);
  };

  console.log = function(...args) {
    originalLog.apply(console, args);
    postLog('log', args);
  };

  window.addEventListener('error', function(event) {
    window.parent.postMessage({
      type: 'mini-app-console-log',
      log: {
        type: 'error',
        message: event.message + (event.filename ? ' at ' + event.filename + ':' + event.lineno : ''),
        timestamp: Date.now()
      }
    }, '*');
  });

  window.addEventListener('unhandledrejection', function(event) {
    const reason = stringify(event.reason);
    window.parent.postMessage({
      type: 'mini-app-console-log',
      log: {
        type: 'error',
        message: 'Unhandled Promise Rejection: ' + reason,
        timestamp: Date.now()
      }
    }, '*');
  });
})();
</script>
`,
    []
  );

  // Inject scripts into HTML (theme detection + error capture)
  const htmlWithScripts = useMemo(() => {
    const scriptsToInject = `${themeDetectionScript}${onLog ? errorCaptureScript : ""}`;
    return html.includes("<head>")
      ? html.replace("<head>", `<head>${scriptsToInject}`)
      : html.includes("<html>")
        ? html.replace("<html>", `<html>${scriptsToInject}`)
        : `${scriptsToInject}${html}`;
  }, [html, themeDetectionScript, errorCaptureScript, onLog]);

  // Send theme updates to iframe when theme changes
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;

    const theme = isDark ? "dark" : "light";
    iframe.contentWindow.postMessage(
      {
        type: "mini-app-theme-change",
        theme,
        isDark,
      },
      "*"
    );
  }, [isDark]);

  // Set up message listener for console logs from iframe
  useEffect(() => {
    if (!onLog) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "mini-app-console-log") {
        onLog(event.data.log);
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [onLog]);

  const [isViewerFullscreen, setIsViewerFullscreen] = useState(false);

  useEffect(() => {
    if (!isViewerFullscreen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsViewerFullscreen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isViewerFullscreen]);

  const handleRefresh = () => {
    if (iframeRef.current) {
      // Force reload by clearing and resetting srcdoc
      const iframe = iframeRef.current;
      iframe.srcdoc = "";
      requestAnimationFrame(() => {
        iframe.srcdoc = htmlWithScripts;
      });
    }
  };

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument || !iframe.contentWindow) return;

    const doc = iframe.contentDocument;

    const printStyle = doc.createElement("style");
    printStyle.setAttribute("data-print-helper", "true");
    printStyle.textContent = `
      @media print {
        html, body { height: auto !important; overflow: visible !important; }
        * { max-height: none !important; overflow: visible !important; }
      }
    `;
    doc.head.appendChild(printStyle);

    iframe.contentWindow.print();

    printStyle.remove();
  };

  const handleFullscreen = () => {
    const newFullscreenState = !isFullscreen;
    onFullscreen?.(newFullscreenState);
  };

  return (
    <div
      className="flex flex-col h-full bg-background"
      data-testid="mini-app-viewer"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b bg-muted/50"
        data-testid="mini-app-viewer-header"
      >
        <span className="text-sm font-medium text-foreground">{title}</span>
        <div className="flex items-center gap-1"
          data-testid="mini-app-viewer-header-buttons"
        >
          {/* <button
            onClick={() => setIsViewerFullscreen(true)}
            title="Open fullscreen"
            className="p-1 hover:bg-muted rounded"
            data-testid="mini-app-open-fullscreen-btn"
          >
            ↗
          </button> */}
          <button
            onClick={handleRefresh}
            title="Refresh"
            className="p-1 hover:bg-muted rounded"
            data-testid="mini-app-refresh-btn"
          >
            ↻
          </button>
          <button
            onClick={handlePrint}
            title="Print"
            className="p-1 hover:bg-muted rounded"
            data-testid="mini-app-print-btn"
          >
            <Printer className="w-4 h-4" />
          </button>
          {!isMobile && onFullscreen && (
            <button
              onClick={handleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              className="p-1 hover:bg-muted rounded"
              data-testid="mini-app-fullscreen-btn"
            >
              {isFullscreen ? "⤓" : "⛶"}
            </button>)}
          {onClose && (
            <button
              onClick={onClose}
              title="Close"
              className="p-1 hover:bg-muted rounded"
              data-testid="mini-app-close-btn"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* iframe Container */}
      <div
        className="flex-1 bg-background"
        data-testid="mini-app-viewer-content"
      >
        <iframe
          ref={iframeRef}
          srcDoc={htmlWithScripts}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-modals allow-downloads"
          className="w-full h-full border-0 dark:bg-[hsl(0_0%_20%)]"
          title={title}
          data-testid="mini-app-iframe"
        />
      </div>

      {/* Fullscreen Overlay */}
      {isViewerFullscreen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex flex-col bg-background"
            data-testid="mini-app-fullscreen-overlay"
          >
            <div
              className="flex items-center justify-between px-4 py-2 border-b bg-muted/50"
              data-testid="mini-app-fullscreen-header"
            >
              <span className="text-sm font-medium text-foreground">
                {title}
              </span>
              <button
                onClick={() => setIsViewerFullscreen(false)}
                title="Exit fullscreen (Esc)"
                className="p-1 hover:bg-muted rounded"
                data-testid="mini-app-exit-fullscreen-btn"
              >
                ✕
              </button>
            </div>
            <div className="flex-1" data-testid="mini-app-fullscreen-content">
              <iframe
                srcDoc={htmlWithScripts}
                sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-modals allow-downloads"
                className="w-full h-full border-0 dark:bg-[hsl(0_0%_20%)]"
                title={title}
                data-testid="mini-app-fullscreen-iframe"
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
