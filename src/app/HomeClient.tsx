"use client";

import { useEffect } from "react";
import HomeContent from "./HomeContent";

export default function HomeClient() {
  useEffect(() => {
    const shell = document.getElementById("home-loading-shell");
    if (shell) {
      shell.remove();
    }
  }, []);

  return <HomeContent />;
}
