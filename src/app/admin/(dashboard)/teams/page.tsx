"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TeamsRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main admin page with teams section
    router.replace("/admin#teams");
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
        <p className="text-slate-400">Redirecting to Teams...</p>
      </div>
    </div>
  );
}
