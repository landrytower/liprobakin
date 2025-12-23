"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Locale = "en" | "fr";

interface LanguageContextType {
  language: Locale;
  setLanguage: (lang: Locale) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Locale>("fr");

  // Load language from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("liprobakin-language");
    if (saved === "en" || saved === "fr") {
      setLanguage(saved);
    }
  }, []);

  // Save language to localStorage when it changes
  const handleSetLanguage = (lang: Locale) => {
    setLanguage(lang);
    localStorage.setItem("liprobakin-language", lang);
  };

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
