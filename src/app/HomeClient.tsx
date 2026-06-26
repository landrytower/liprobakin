"use client";

import { useEffect } from "react";
import HomeContent, { type CachedNewsArticle } from "./HomeContent";

export default function HomeClient({ initialNews }: { initialNews?: CachedNewsArticle[] }) {
  useEffect(() => {
    const shell = document.getElementById("home-loading-shell");
    if (shell) {
      shell.remove();
    }
  }, []);

  return <HomeContent initialNews={initialNews} />;
}
