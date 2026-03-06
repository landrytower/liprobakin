"use client";

import { useEffect, useRef, useCallback, useState } from "react";

declare global {
  interface DocumentPictureInPicture {
    window: Window | null;
    requestWindow(options?: {
      width?: number;
      height?: number;
      disallowReturnToOpener?: boolean;
      preferInitialWindowPlacement?: boolean;
    }): Promise<Window>;
  }
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

export interface UsePiPOptions {
  width?: number;
  height?: number;
}

export interface UsePiPResult {
  isPiPSupported: boolean;
  isPiPOpen: boolean;
  openPiP: () => Promise<boolean>;
  closePiP: () => void;
  pipWindow: Window | null;
}

/**
 * Hook for Document Picture-in-Picture API
 * Creates an always-on-top floating window for live scores
 */
export function useDocumentPiP(options: UsePiPOptions = {}): UsePiPResult {
  const { width = 340, height = 160 } = options;
  const [isPiPOpen, setIsPiPOpen] = useState(false);
  const pipWindowRef = useRef<Window | null>(null);

  const isPiPSupported =
    typeof window !== "undefined" &&
    "documentPictureInPicture" in window &&
    typeof window.documentPictureInPicture?.requestWindow === "function";

  const closePiP = useCallback(() => {
    if (pipWindowRef.current) {
      try {
        pipWindowRef.current.close();
      } catch {
        // ignore
      }
      pipWindowRef.current = null;
    }
    setIsPiPOpen(false);
  }, []);

  const openPiP = useCallback(async (): Promise<boolean> => {
    if (!isPiPSupported) {
      console.warn("Document Picture-in-Picture API is not supported");
      return false;
    }

    // Close existing PiP window if any
    closePiP();

    try {
      const pipWindow = await window.documentPictureInPicture!.requestWindow({
        width,
        height,
        disallowReturnToOpener: false,
        preferInitialWindowPlacement: true,
      });

      pipWindowRef.current = pipWindow;
      setIsPiPOpen(true);

      // Copy styles to PiP window
      copyStylesToPiP(pipWindow);

      // Handle window close
      pipWindow.addEventListener("pagehide", () => {
        pipWindowRef.current = null;
        setIsPiPOpen(false);
      });

      return true;
    } catch (error) {
      console.error("Failed to open Picture-in-Picture window:", error);
      setIsPiPOpen(false);
      return false;
    }
  }, [isPiPSupported, width, height, closePiP]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (pipWindowRef.current) {
        try {
          pipWindowRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    isPiPSupported,
    isPiPOpen,
    openPiP,
    closePiP,
    pipWindow: pipWindowRef.current,
  };
}

/**
 * Copy stylesheets from main document to PiP window
 */
function copyStylesToPiP(pipWindow: Window): void {
  // Add base styles for dark theme
  const baseStyle = pipWindow.document.createElement("style");
  baseStyle.textContent = `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: white;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px;
    }
    .pip-container {
      width: 100%;
      max-width: 320px;
      background: rgba(30, 41, 59, 0.95);
      border-radius: 16px;
      padding: 16px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
    .pip-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .pip-live-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(239, 68, 68, 0.15);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.4);
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .pip-live-dot {
      width: 8px;
      height: 8px;
      background: #ef4444;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .pip-meta {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .pip-score-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .pip-team {
      flex: 1;
      min-width: 0;
      text-align: center;
    }
    .pip-team-name {
      font-size: 13px;
      font-weight: 600;
      color: #e2e8f0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 4px;
    }
    .pip-team-score {
      font-size: 36px;
      font-weight: 800;
      color: white;
      line-height: 1;
    }
    .pip-vs {
      font-size: 14px;
      font-weight: 600;
      color: #64748b;
      padding: 0 4px;
    }
    .pip-close-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      cursor: pointer;
      color: #94a3b8;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: all 0.15s;
    }
    .pip-close-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      color: white;
    }
  `;
  pipWindow.document.head.appendChild(baseStyle);
}

/**
 * Render score content into PiP window
 */
export function renderScoreToPiP(
  pipWindow: Window,
  data: {
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    period?: string;
    clock?: string;
  },
  onClose?: () => void
): void {
  const { homeTeam, awayTeam, homeScore, awayScore, period, clock } = data;
  
  const meta = [period?.toUpperCase(), clock].filter(Boolean).join(" • ");

  pipWindow.document.body.innerHTML = `
    <div class="pip-container" style="position: relative;">
      <button class="pip-close-btn" id="pip-close" aria-label="Close">✕</button>
      <div class="pip-header">
        <span class="pip-live-badge">
          <span class="pip-live-dot"></span>
          Live
        </span>
        ${meta ? `<span class="pip-meta">${meta}</span>` : ""}
      </div>
      <div class="pip-score-row">
        <div class="pip-team">
          <div class="pip-team-name">${escapeHtml(awayTeam)}</div>
          <div class="pip-team-score">${awayScore}</div>
        </div>
        <div class="pip-vs">–</div>
        <div class="pip-team">
          <div class="pip-team-name">${escapeHtml(homeTeam)}</div>
          <div class="pip-team-score">${homeScore}</div>
        </div>
      </div>
    </div>
  `;

  // Add close button handler
  const closeBtn = pipWindow.document.getElementById("pip-close");
  if (closeBtn && onClose) {
    closeBtn.addEventListener("click", onClose);
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
