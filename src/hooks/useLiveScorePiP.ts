"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

  interface HTMLVideoElement {
    webkitSupportsPresentationMode?: (mode: string) => boolean;
    webkitSetPresentationMode?: (mode: string) => void;
    webkitPresentationMode?: string;
  }
}

export type LiveScorePiPData = {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  period?: string;
  clock?: string;
};

export type LiveScorePiPResult = {
  isSupported: boolean;
  mode: "document" | "video" | "none";
  isOpen: boolean;
  open: () => Promise<boolean>;
  close: () => void;
  render: (data: LiveScorePiPData) => void;
};

/**
 * Google-like "pop out" score.
 * - Chrome/Edge: uses Document Picture-in-Picture (arbitrary HTML).
 * - iPhone Safari: falls back to Video Picture-in-Picture by drawing the score onto a canvas,
 *   capturing it as a MediaStream, and entering video PiP.
 */
export function useLiveScorePiP(options: { width?: number; height?: number } = {}): LiveScorePiPResult {
  const width = options.width ?? 340;
  const height = options.height ?? 160;

  const [isOpen, setIsOpen] = useState(false);
  const pipWindowRef = useRef<Window | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastDataRef = useRef<LiveScorePiPData | null>(null);

  const supportsDocumentPiP = useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      "documentPictureInPicture" in window &&
      typeof window.documentPictureInPicture?.requestWindow === "function"
    );
  }, []);

  const supportsVideoPiP = useMemo(() => {
    if (typeof window === "undefined") return false;

    const canCanvasStream = typeof (HTMLCanvasElement.prototype as any).captureStream === "function";
    if (!canCanvasStream) return false;

    const video = document.createElement("video") as HTMLVideoElement;
    const docAny = document as any;
    const canStandard = Boolean(docAny.pictureInPictureEnabled && typeof (video as any).requestPictureInPicture === "function");
    const canWebkit =
      typeof video.webkitSupportsPresentationMode === "function" &&
      video.webkitSupportsPresentationMode("picture-in-picture") &&
      typeof video.webkitSetPresentationMode === "function";

    return canStandard || canWebkit;
  }, []);

  const mode: LiveScorePiPResult["mode"] = supportsDocumentPiP ? "document" : supportsVideoPiP ? "video" : "none";
  const isSupported = mode !== "none";

  const close = useCallback(() => {
    // Close document PiP
    if (pipWindowRef.current) {
      try {
        pipWindowRef.current.close();
      } catch {
        // ignore
      }
      pipWindowRef.current = null;
    }

    // Close video PiP
    if (typeof document !== "undefined") {
      const docAny = document as any;
      if (typeof docAny.exitPictureInPicture === "function" && docAny.pictureInPictureElement) {
        try {
          void docAny.exitPictureInPicture();
        } catch {
          // ignore
        }
      }

      if (videoRef.current?.webkitPresentationMode === "picture-in-picture") {
        try {
          videoRef.current.webkitSetPresentationMode?.("inline");
        } catch {
          // ignore
        }
      }
    }

    // Cleanup media elements
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        // ignore
      }
      videoRef.current.srcObject = null;
      videoRef.current.remove();
      videoRef.current = null;
    }

    if (canvasRef.current) {
      canvasRef.current.remove();
      canvasRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsOpen(false);
  }, []);

  const open = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    // Always reset before opening.
    close();

    if (mode === "document") {
      try {
        const pipWindow = await window.documentPictureInPicture!.requestWindow({
          width,
          height,
          disallowReturnToOpener: false,
          preferInitialWindowPlacement: true,
        });

        pipWindowRef.current = pipWindow;
        setIsOpen(true);

        // Minimal styling + content host.
        const baseStyle = pipWindow.document.createElement("style");
        baseStyle.textContent = `
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #0b1220;
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 12px;
          }
        `;
        pipWindow.document.head.appendChild(baseStyle);

        pipWindow.addEventListener("pagehide", () => {
          pipWindowRef.current = null;
          setIsOpen(false);
        });

        // If we already have data, render it immediately.
        if (lastDataRef.current) {
          renderDocumentPiP(pipWindow, lastDataRef.current, close);
        }

        return true;
      } catch (error) {
        console.error("Failed to open Document PiP:", error);
        setIsOpen(false);
        return false;
      }
    }

    // Video PiP fallback (iPhone Safari)
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 360;
      canvas.style.position = "fixed";
      canvas.style.left = "-9999px";
      canvas.style.top = "-9999px";
      document.body.appendChild(canvas);
      canvasRef.current = canvas;

      const stream = (canvas as any).captureStream(30) as MediaStream;
      streamRef.current = stream;

      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.srcObject = stream;
      video.style.position = "fixed";
      video.style.left = "-9999px";
      video.style.top = "-9999px";
      document.body.appendChild(video);
      videoRef.current = video;

      // Ensure frames start flowing.
      await video.play();

      // Initial render.
      if (lastDataRef.current) {
        renderVideoFrame(canvas, lastDataRef.current);
      } else {
        renderVideoFrame(canvas, {
          homeTeam: "Home",
          awayTeam: "Away",
          homeScore: 0,
          awayScore: 0,
        });
      }

      // Enter PiP.
      const docAny = document as any;
      if (docAny.pictureInPictureEnabled && typeof (video as any).requestPictureInPicture === "function") {
        await (video as any).requestPictureInPicture();
      } else if (typeof video.webkitSetPresentationMode === "function") {
        video.webkitSetPresentationMode("picture-in-picture");
      } else {
        throw new Error("Video PiP not available");
      }

      setIsOpen(true);

      // Detect close
      video.addEventListener("leavepictureinpicture", () => {
        close();
      });
      video.addEventListener("webkitpresentationmodechanged", () => {
        if (video.webkitPresentationMode !== "picture-in-picture") {
          close();
        }
      });

      return true;
    } catch (error) {
      console.error("Failed to open Video PiP:", error);
      close();
      return false;
    }
  }, [close, height, isSupported, mode, width]);

  const render = useCallback(
    (data: LiveScorePiPData) => {
      lastDataRef.current = data;

      if (mode === "document") {
        const pipWindow = pipWindowRef.current;
        if (!pipWindow) return;
        renderDocumentPiP(pipWindow, data, close);
        return;
      }

      if (mode === "video") {
        const canvas = canvasRef.current;
        if (!canvas) return;
        renderVideoFrame(canvas, data);
      }
    },
    [close, mode]
  );

  // Cleanup on unmount.
  useEffect(() => close, [close]);

  return { isSupported, mode, isOpen, open, close, render };
}

function renderDocumentPiP(pipWindow: Window, data: LiveScorePiPData, onClose: () => void): void {
  const meta = [data.period?.toUpperCase(), data.clock].filter(Boolean).join(" • ");

  pipWindow.document.body.innerHTML = `
    <div style="
      width: 100%;
      max-width: 340px;
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 16px;
      padding: 14px;
      position: relative;
    ">
      <button id="pip-close" aria-label="Close" style="
        position: absolute;
        top: 8px;
        right: 8px;
        width: 26px;
        height: 26px;
        border-radius: 9999px;
        border: 0;
        background: rgba(255,255,255,0.10);
        color: rgba(255,255,255,0.85);
        font-size: 14px;
        cursor: pointer;
      ">✕</button>

      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px;">
        <div style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:9999px; border:1px solid rgba(239,68,68,0.35); background: rgba(239,68,68,0.14); font-size:11px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color: rgba(254,202,202,1);">
          <span style="width:8px; height:8px; border-radius:9999px; background:#ef4444;"></span>
          Live
        </div>
        ${meta ? `<div style="font-size:11px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color: rgba(148,163,184,1);">${escapeHtml(meta)}</div>` : ""}
      </div>

      <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:10px;">
        <div style="flex:1; min-width:0; text-align:center;">
          <div style="font-size:12px; font-weight:700; color: rgba(226,232,240,1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(data.awayTeam)}</div>
          <div style="font-size:40px; font-weight:900; line-height:1;">${Number(data.awayScore) || 0}</div>
        </div>
        <div style="font-size:18px; font-weight:900; color: rgba(100,116,139,1); padding-bottom:6px;">–</div>
        <div style="flex:1; min-width:0; text-align:center;">
          <div style="font-size:12px; font-weight:700; color: rgba(226,232,240,1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(data.homeTeam)}</div>
          <div style="font-size:40px; font-weight:900; line-height:1;">${Number(data.homeScore) || 0}</div>
        </div>
      </div>
    </div>
  `;

  const btn = pipWindow.document.getElementById("pip-close");
  btn?.addEventListener("click", onClose);
}

function renderVideoFrame(canvas: HTMLCanvasElement, data: LiveScorePiPData): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Background
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, "#0b1220");
  grad.addColorStop(1, "#111c33");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Card
  const pad = 48;
  const cardX = pad;
  const cardY = pad;
  const cardW = canvas.width - pad * 2;
  const cardH = canvas.height - pad * 2;

  roundRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.stroke();

  // Header
  ctx.fillStyle = "rgba(239, 68, 68, 0.18)";
  roundRect(ctx, cardX + 28, cardY + 26, 140, 42, 999);
  ctx.fill();
  ctx.strokeStyle = "rgba(239, 68, 68, 0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(cardX + 48, cardY + 47, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(254, 202, 202, 1)";
  ctx.font = "800 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial";
  ctx.fillText("LIVE", cardX + 66, cardY + 55);

  const meta = [data.period?.toUpperCase(), data.clock].filter(Boolean).join(" • ");
  if (meta) {
    ctx.fillStyle = "rgba(148, 163, 184, 1)";
    ctx.font = "800 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial";
    ctx.textAlign = "right";
    ctx.fillText(meta, cardX + cardW - 28, cardY + 54);
    ctx.textAlign = "left";
  }

  // Teams + scores
  const centerY = cardY + cardH / 2 + 20;

  ctx.fillStyle = "rgba(226, 232, 240, 1)";
  ctx.font = "800 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial";
  ctx.textAlign = "center";
  ctx.fillText(trimToWidth(ctx, data.awayTeam || "Away", 240), cardX + cardW * 0.25, centerY - 54);
  ctx.fillText(trimToWidth(ctx, data.homeTeam || "Home", 240), cardX + cardW * 0.75, centerY - 54);

  ctx.fillStyle = "white";
  ctx.font = "900 120px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial";
  ctx.fillText(String(Number(data.awayScore) || 0), cardX + cardW * 0.25, centerY + 56);
  ctx.fillText(String(Number(data.homeScore) || 0), cardX + cardW * 0.75, centerY + 56);

  ctx.fillStyle = "rgba(100, 116, 139, 1)";
  ctx.font = "900 72px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial";
  ctx.fillText("–", cardX + cardW * 0.5, centerY + 40);

  ctx.textAlign = "left";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function trimToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  const clean = String(text || "");
  if (ctx.measureText(clean).width <= maxWidth) return clean;

  const ellipsis = "…";
  let left = 0;
  let right = clean.length;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    const candidate = clean.slice(0, mid).trimEnd() + ellipsis;
    if (ctx.measureText(candidate).width <= maxWidth) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  const finalLen = Math.max(1, left - 1);
  return clean.slice(0, finalLen).trimEnd() + ellipsis;
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
