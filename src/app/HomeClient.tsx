"use client";

import { useEffect } from "react";
import HomeContent, { type CachedNewsArticle, type CommitteeMember } from "./HomeContent";

interface HomeClientProps {
  initialNews?: CachedNewsArticle[];
  initialCommittee?: CommitteeMember[];
  initialCommission?: CommitteeMember[];
  initialReferees?: CommitteeMember[];
}

export default function HomeClient({ initialNews, initialCommittee, initialCommission, initialReferees }: HomeClientProps) {
  useEffect(() => {
    const shell = document.getElementById("home-loading-shell");
    if (shell) {
      shell.remove();
    }
  }, []);

  return (
    <HomeContent
      initialNews={initialNews}
      initialCommittee={initialCommittee}
      initialCommission={initialCommission}
      initialReferees={initialReferees}
    />
  );
}
