"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { doc, onSnapshot } from "firebase/firestore";
import { firebaseDB } from "@/lib/firebase";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const FLOATING_BUTTON_SIZE = 64; // px (h-14/16 w-14/16 responsive)
const FLOATING_BUTTON_VISIBLE_FRACTION = 0.05; // 5% visible when off-screen
const AI_SETTINGS_DOC = "global";

function clampPosition(
  pos: { x: number; y: number },
  viewportWidth: number,
  viewportHeight: number
) {
  const size = FLOATING_BUTTON_SIZE;
  const visible = FLOATING_BUTTON_VISIBLE_FRACTION;

  const minX = -size * (1 - visible);
  const maxX = viewportWidth - size * visible;
  const minY = -size * (1 - visible);
  const maxY = viewportHeight - size * visible;

  return {
    x: Math.min(Math.max(pos.x, minX), maxX),
    y: Math.min(Math.max(pos.y, minY), maxY),
  };
}

export default function LiprobakinAI() {
  const [isAiEnabled, setIsAiEnabled] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Salut! Je suis Princesse, ton IA 🏀\n\nPose-moi des questions sur la ligue - équipes, joueurs, classements, stats, ou prochains matchs!",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef({
    dragging: false,
    offsetX: 0,
    offsetY: 0,
    moved: false,
    startX: 0,
    startY: 0,
  });
  const animationFrameRef = useRef<number | null>(null);
  const targetPosition = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const settingsRef = doc(firebaseDB, "siteSettings", AI_SETTINGS_DOC);
    const unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        const data = snapshot.data();
        setIsAiEnabled(data?.aiEnabled !== false);
      },
      (error) => {
        console.error("Failed to read AI visibility settings:", error);
        setIsAiEnabled(true);
      }
    );

    return () => unsubscribe();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize floating button position and keep it clamped on resize
  useEffect(() => {
    const updatePosition = () => {
      if (typeof window === "undefined") return;
      setPosition((prev) => {
        if (!prev) {
          const margin = 16;
          const buttonSize = window.innerWidth < 640 ? 56 : FLOATING_BUTTON_SIZE;
          const x = window.innerWidth - buttonSize - margin;
          const y = window.innerHeight - buttonSize - margin;
          return clampPosition({ x, y }, window.innerWidth, window.innerHeight);
        }
        return clampPosition(prev, window.innerWidth, window.innerHeight);
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, []);

  // Smooth animation loop for drag
  const animateDrag = useCallback(() => {
    if (!targetPosition.current || !dragState.current.dragging) return;
    
    setPosition(prev => {
      if (!prev) return prev;
      
      // Smooth interpolation (lerp)
      const smoothing = 0.3; // Lower = smoother but slower
      const newX = prev.x + (targetPosition.current!.x - prev.x) * smoothing;
      const newY = prev.y + (targetPosition.current!.y - prev.y) * smoothing;
      
      return { x: newX, y: newY };
    });
    
    if (dragState.current.dragging) {
      animationFrameRef.current = requestAnimationFrame(animateDrag);
    }
  }, []);

  // Global listeners for dragging the floating button
  useEffect(() => {
    const handleMove = (event: MouseEvent | TouchEvent) => {
      if (!dragState.current.dragging) return;
      if (!position) return;

      // Prevent scrolling on touch devices while dragging
      if ("touches" in event) {
        event.preventDefault();
      }

      const point = "touches" in event ? event.touches[0] : (event as MouseEvent);
      const clientX = point.clientX;
      const clientY = point.clientY;

      // Check if we've moved enough to count as a drag
      const deltaX = Math.abs(clientX - dragState.current.startX);
      const deltaY = Math.abs(clientY - dragState.current.startY);
      if (deltaX > 5 || deltaY > 5) {
        dragState.current.moved = true;
      }

      // Update target position for smooth animation
      targetPosition.current = {
        x: clientX - dragState.current.offsetX,
        y: clientY - dragState.current.offsetY,
      };
    };

    const handleUp = () => {
      if (!dragState.current.dragging) return;
      dragState.current.dragging = false;
      setIsDragging(false);

      // Cancel animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (typeof window === "undefined") return;
      setPosition((prev) => {
        if (!prev) return prev;
        return clampPosition(prev, window.innerWidth, window.innerHeight);
      });
    };

    window.addEventListener("mousemove", handleMove, { passive: false });
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchend", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchend", handleUp);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [position]);

  const suggestedQuestions = [
    "Prédire: [Équipe A] vs [Équipe B] avec TSS + confiance",
    "Comparer: [Joueur 1] vs [Joueur 2] avec PCS",
    "Quel est le prochain match et ton pronostic chiffré ?",
    "Montre le classement actuel et les équipes en forme",
  ];

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: content.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let assistantContent = "";

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? { ...m, content: assistantContent }
              : m
          )
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleFloatingButtonPointerDown = (
    e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>
  ) => {
    const point = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

    dragState.current.dragging = true;
    dragState.current.moved = false;
    dragState.current.offsetX = point.clientX - rect.left;
    dragState.current.offsetY = point.clientY - rect.top;
    dragState.current.startX = point.clientX;
    dragState.current.startY = point.clientY;
    
    setIsDragging(true);
    
    // Initialize target position
    targetPosition.current = position ? { ...position } : null;
    
    // Start animation loop
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(animateDrag);
  };

  const handleFloatingButtonClick = () => {
    // If the user dragged the button, don't toggle the chat
    if (dragState.current.moved) {
      dragState.current.moved = false;
      return;
    }
    setIsOpen(!isOpen);
  };

  if (!isAiEnabled) return null;

  return (
    <>
      {/* Floating Button - circular avatar with AI logo - responsive across all screen sizes */}
      <button
        onMouseDown={handleFloatingButtonPointerDown}
        onTouchStart={handleFloatingButtonPointerDown}
        onClick={handleFloatingButtonClick}
        className={`fixed z-50 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center overflow-hidden rounded-full border-2 border-slate-600/50 bg-slate-800/90 text-white shadow-xl shadow-black/50 backdrop-blur-xl transition-transform duration-200 hover:scale-110 hover:shadow-2xl hover:border-orange-500/50 ${
          isOpen ? "scale-0 opacity-0" : "scale-100 opacity-100"
        } ${isDragging ? "cursor-grabbing scale-105" : "cursor-grab"}`}
        aria-label="Ouvrir Princesse AI"
        style={{
          ...(position
            ? { left: position.x, top: position.y }
            : { right: 24, bottom: 24 }),
          transition: isDragging ? "transform 0.1s ease-out" : "transform 0.2s ease-out, opacity 0.3s ease-out",
          touchAction: "none",
        }}
      >
        <Image
          src="/logos/Ai.png"
          alt="Princesse AI"
          width={56}
          height={56}
          className="h-full w-full object-cover pointer-events-none"
          draggable={false}
        />
      </button>

      {/* Chat Panel - Dark theme matching page colors */}
      <div
        className={`fixed bottom-4 right-4 left-4 sm:bottom-6 sm:right-6 sm:left-auto z-50 flex h-[500px] w-auto sm:w-[380px] flex-col overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/95 shadow-2xl shadow-black/70 backdrop-blur-2xl transition-all duration-300 ${
          isOpen
            ? "scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        {/* Header - Dark theme */}
        <div className="flex items-center justify-between bg-slate-800/90 border-b border-slate-700/50 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2">
            <div className="relative h-8 w-8 sm:h-9 sm:w-9 overflow-hidden rounded-full border border-slate-600/50 bg-slate-900">
              <Image
                src="/logos/Ai.png"
                alt="Princesse AI"
                fill
                sizes="36px"
                className="object-cover"
              />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Princesse AI</h3>
              <p className="text-xs text-slate-400">Ton assistant de la ligue</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-white"
            aria-label="Fermer le chat"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path
                fillRule="evenodd"
                d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Messages - Dark theme with subtle background */}
        <div className="flex-1 space-y-3 sm:space-y-4 overflow-y-auto bg-slate-900/50 p-3 sm:p-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 sm:px-4 ${
                  message.role === "user"
                    ? "bg-orange-500/90 text-white shadow-md shadow-orange-500/20"
                    : "bg-slate-800/90 text-slate-100 border border-slate-700/50 shadow-md shadow-black/30"
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">{message.content}</p>
              </div>
            </div>
          ))}
          
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-slate-800/90 border border-slate-700/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-orange-500 animation-delay-0" />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-orange-500 animation-delay-150" />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-orange-500 animation-delay-300" />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <div className="rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-2 text-sm text-red-400">
                {error}
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Questions - Dark theme, French text */}
        {messages.length <= 2 && (
          <div className="border-t border-slate-700/50 bg-slate-800/50 px-3 py-2 sm:px-4">
            <p className="mb-2 text-xs text-slate-500">Essaie de demander:</p>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {suggestedQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => sendMessage(question)}
                  className="rounded-full bg-slate-700/80 border border-slate-600/50 px-2.5 py-1 sm:px-3 text-xs text-slate-300 transition-colors hover:bg-slate-600/90 hover:border-orange-500/30"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input - Dark theme, French placeholder */}
        <form
          id="ai-chat-form"
          onSubmit={onSubmit}
          className="border-t border-slate-700/50 bg-slate-800/70 p-3 sm:p-4"
        >
          <div className="flex gap-2">
            <input
              type="text"
              name="content"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Pose une question sur la ligue..."
              className="flex-1 rounded-full bg-slate-900/90 border border-slate-700/50 px-3 py-2 sm:px-4 text-sm text-white placeholder-slate-500 outline-none ring-orange-500 focus:ring-2 focus:border-transparent"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-orange-500 text-white shadow-md shadow-orange-500/30 transition-colors hover:bg-orange-400 disabled:opacity-50 disabled:hover:bg-orange-500"
              aria-label="Envoyer le message"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
