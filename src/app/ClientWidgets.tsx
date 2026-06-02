"use client";

import dynamic from "next/dynamic";

const LivePinnedScore = dynamic(() => import("@/components/LivePinnedScore"), {
  ssr: false,
  loading: () => null,
});

const LiprobakinAI = dynamic(() => import("@/components/LiprobakinAI"), {
  ssr: false,
  loading: () => null,
});

const AllStarFloatingButton = dynamic(() => import("@/components/AllStarFloatingButton"), {
  ssr: false,
  loading: () => null,
});

export default function ClientWidgets() {
  return (
    <>
      <LivePinnedScore />
      <LiprobakinAI />
      <AllStarFloatingButton />
    </>
  );
}
