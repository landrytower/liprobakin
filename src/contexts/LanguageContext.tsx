"use client";

import { createContext, useContext, useSyncExternalStore, useCallback, ReactNode } from "react";

export type Locale = "en" | "fr";

interface LanguageContextType {
  language: Locale;
  setLanguage: (lang: Locale) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "liprobakin-language";

function getSnapshot(): Locale {
  if (typeof window === "undefined") return "fr";
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === "en" || saved === "fr" ? saved : "fr";
}

function getServerSnapshot(): Locale {
  return "fr";
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const handleSetLanguage = useCallback((lang: Locale) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, lang);
    // Dispatch storage event to trigger re-render
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
