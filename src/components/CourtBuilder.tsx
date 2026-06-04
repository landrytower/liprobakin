"use client";

import { useState, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import Image from "next/image";

export type CourtPlayer = {
  id: string;
  name: string;
  headshot?: string;
  teamName: string;
};

// Half court: 5 positions for one team
// Percentages based on half-court view (470×500 viewBox)
const HALF_COURT_POSITIONS = [
  { idx: 0, label: "C",  xPct: 20, yPct: 30 },
  { idx: 1, label: "PF", xPct: 32, yPct: 15 },
  { idx: 2, label: "SF", xPct: 22, yPct: 85 },
  { idx: 3, label: "PG", xPct: 68, yPct: 50 },
  { idx: 4, label: "SG", xPct: 28, yPct: 65 },
];

function Avatar({ player, size = 40 }: { player: CourtPlayer; size?: number }) {
  return (
    <div
      className="rounded-full overflow-hidden border-2 border-white/30 bg-slate-700 shrink-0 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {player.headshot ? (
        <Image
          src={player.headshot}
          alt={player.name}
          width={size}
          height={size}
          className="object-cover object-top w-full h-full"
        />
      ) : (
        <svg width={size * 0.5} height={size * 0.5} fill="currentColor" viewBox="0 0 24 24" className="text-slate-400">
          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
        </svg>
      )}
    </div>
  );
}

function DraggableCard({ id, player, size }: { id: string; player: CourtPlayer; size?: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing transition-opacity ${isDragging ? "opacity-20" : "opacity-100"}`}
    >
      <Avatar player={player} size={size} />
    </div>
  );
}

function CourtSlot({
  idx, label, xPct, yPct, player, teamColor,
}: {
  idx: number;
  label: string;
  xPct: number;
  yPct: number;
  player: CourtPlayer | null;
  teamColor: "emerald" | "blue" | "orange";
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `court-${idx}` });

  const colorClasses = {
    emerald: {
      labelActive: "text-emerald-300",
      labelInactive: "text-white/50",
      borderActive: "border-emerald-400 shadow-lg shadow-emerald-500/50",
      borderFilled: "border-emerald-500/50",
    },
    blue: {
      labelActive: "text-blue-300",
      labelInactive: "text-white/50",
      borderActive: "border-blue-400 shadow-lg shadow-blue-500/50",
      borderFilled: "border-blue-500/50",
    },
    orange: {
      labelActive: "text-orange-300",
      labelInactive: "text-white/50",
      borderActive: "border-orange-400 shadow-lg shadow-orange-500/50",
      borderFilled: "border-orange-500/50",
    },
  };

  const colors = colorClasses[teamColor];

  return (
    <div
      ref={setNodeRef}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
      style={{ left: `${xPct}%`, top: `${yPct}%` }}
    >
      <div className={`absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] sm:text-[10px] font-black tracking-widest transition-colors ${
        isOver ? colors.labelActive : colors.labelInactive
      }`}>
        {label}
      </div>

      <div
        className={`rounded-full border-2 transition-all duration-150 flex items-center justify-center ${
          isOver
            ? colors.borderActive + " scale-110"
            : player
            ? colors.borderFilled
            : "border-dashed border-white/20"
        }`}
        style={{ width: 56, height: 56 }}
      >
        {player ? (
          <DraggableCard id={`court-${idx}`} player={player} size={52} />
        ) : (
          <div className="w-full h-full rounded-full bg-white/5" />
        )}
      </div>

      {player && (
        <p className="absolute top-full mt-1 left-1/2 -translate-x-1/2 text-[9px] sm:text-[10px] text-center text-white/90 font-semibold whitespace-nowrap max-w-[72px] truncate">
          {player.name.split(" ").pop()}
        </p>
      )}
    </div>
  );
}

export default function CourtBuilder({
  teamA,
  teamB,
  teamC,
  onSwap,
  language = "en",
  currentTeam,
  onTeamChange,
}: {
  teamA: (CourtPlayer | null)[];
  teamB: (CourtPlayer | null)[];
  teamC: (CourtPlayer | null)[];
  onSwap: (fromTeam: "A" | "B" | "C", toTeam: "A" | "B" | "C", fromIdx: number, toIdx: number) => void;
  language?: string;
  currentTeam: "A" | "B" | "C";
  onTeamChange: (team: "A" | "B" | "C") => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  const [active, setActive] = useState<{ id: string; player: CourtPlayer; team: "A" | "B" | "C" } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const teams = { A: teamA, B: teamB, C: teamC };
  const currentPlayers = teams[currentTeam];

  const teamColors: Record<"A" | "B" | "C", "emerald" | "blue" | "orange"> = {
    A: "emerald",
    B: "blue",
    C: "orange",
  };

  const slotMap: Record<string, { player: CourtPlayer; team: "A" | "B" | "C" }> = {};
  (["A", "B", "C"] as const).forEach((team) => {
    teams[team].forEach((p, i) => {
      if (p) slotMap[`${team}-${i}`] = { player: p, team };
    });
  });

  function handleDragStart(e: DragStartEvent) {
    const dragId = e.active.id as string;
    const match = slotMap[dragId];
    if (match) {
      setActive({ id: dragId, player: match.player, team: match.team });
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    setActive(null);
    const from = e.active.id as string;
    const to = e.over?.id as string | undefined;
    if (!to || from === to) return;

    // Parse team and index from slot IDs like "A-0", "B-3", "court-2"
    const parseSlot = (slot: string): { team: "A" | "B" | "C"; idx: number } | null => {
      if (slot.startsWith("court-")) {
        return { team: currentTeam, idx: parseInt(slot.replace("court-", ""), 10) };
      }
      const [team, idx] = slot.split("-");
      if ((team === "A" || team === "B" || team === "C") && idx !== undefined) {
        return { team, idx: parseInt(idx, 10) };
      }
      return null;
    };

    const fromSlot = parseSlot(from);
    const toSlot = parseSlot(to);
    
    if (!fromSlot || !toSlot) return;

    onSwap(fromSlot.team, toSlot.team, fromSlot.idx, toSlot.idx);
  }

  // Swipe handling
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      // Swipe left -> next team
      if (currentTeam === "A") onTeamChange("B");
      else if (currentTeam === "B") onTeamChange("C");
    }
    if (isRightSwipe) {
      // Swipe right -> previous team
      if (currentTeam === "C") onTeamChange("B");
      else if (currentTeam === "B") onTeamChange("A");
    }
  };

  const teamColor = teamColors[currentTeam];

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Half court */}
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl touch-pan-y"
        style={{ aspectRatio: "470 / 500" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
          <HalfCourtBackground />
          
          {HALF_COURT_POSITIONS.map((pos) => (
            <CourtSlot
              key={pos.idx}
              idx={pos.idx}
              label={pos.label}
              xPct={pos.xPct}
              yPct={pos.yPct}
              player={currentPlayers[pos.idx] ?? null}
              teamColor={teamColor}
            />
          ))}

          {/* Swipe indicator */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 pointer-events-none">
            {(["A", "B", "C"] as const).map((team) => (
              <div
                key={team}
                className={`w-2 h-2 rounded-full transition-all ${
                  currentTeam === team ? `bg-${teamColors[team]}-400 w-6` : "bg-white/30"
                }`}
              />
            ))}
          </div>
        </div>

      <DragOverlay dropAnimation={null}>
        {active && (
          <div className="rounded-full border-2 border-white/70 shadow-xl opacity-90 scale-110 pointer-events-none">
            <Avatar player={active.player} size={52} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function HalfCourtBackground() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/court-half.png"
      alt=""
      className="absolute inset-0 w-full h-full object-cover"
      draggable={false}
    />
  );
}
