# Admin: Mobile Fixes, Forfeit, Delete Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix admin mobile UX, add double-forfeit outcome, expose game delete on mobile, and add "Clear Stats" to the stats page without affecting player averages.

**Architecture:** Targeted, surgical edits to three files. Types and translations go in first (Task 1) so every subsequent task compiles. Each task is independently committable and testable.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Firebase Firestore

---

## File Map

| File | What changes |
|------|-------------|
| `src/app/admin/(dashboard)/games/page.tsx` | Add `"forfeit"` status type + `forfeit?: boolean` field; add translation strings; add `handleForfeit`; update score modal; update `getStatusBadge`; update `GameCard`; mobile CSS fixes |
| `src/lib/league-stats.ts` | Add forfeit branch — both teams get +1 loss when `forfeit === true` |
| `src/app/admin/(dashboard)/stats/page.tsx` | Add `clearingStatsGameId` state; add `handleClearStats` function; add translations; add "Clear Stats" button per game row |

---

## Task 1: Extend Game type + add all new translation strings

**Files:**
- Modify: `src/app/admin/(dashboard)/games/page.tsx:75-102` (Game type)
- Modify: `src/app/admin/(dashboard)/games/page.tsx:131-322` (translations)

- [ ] **Step 1: Add `"forfeit"` to the Game status union and add `forfeit?: boolean` field**

Find the `type Game` block (around line 75). Change the `status` line and add `forfeit?`:

```typescript
// Before:
  status: "scheduled" | "live" | "completed" | "postponed" | "cancelled";
  completed?: boolean;

// After:
  status: "scheduled" | "live" | "completed" | "postponed" | "cancelled" | "forfeit";
  forfeit?: boolean;
  completed?: boolean;
```

- [ ] **Step 2: Add forfeit strings to the English translations object**

In the `en` object inside `translations`, add to the `gameStatus` sub-object and to the top-level string list:

```typescript
// Inside en.gameStatus — add forfeit:
gameStatus: {
  scheduled: "Scheduled",
  live: "Live",
  completed: "Final",
  postponed: "Postponed",
  cancelled: "Cancelled",
  forfeit: "Forfeit",
},

// Add these four new top-level keys anywhere inside the en object:
forfeitBoth: "Double Forfeit",
forfeitBothConfirm: "Mark this game as a double forfeit? Both teams will receive a loss.",
forfeitBothSuccess: "Game marked as double forfeit",
forfeitBothError: "Failed to mark forfeit",
```

- [ ] **Step 3: Add forfeit strings to the French translations object**

In the `fr` object inside `translations`:

```typescript
// Inside fr.gameStatus — add forfeit:
gameStatus: {
  scheduled: "Programmé",
  live: "En Direct",
  completed: "Terminé",
  postponed: "Reporté",
  cancelled: "Annulé",
  forfeit: "Forfait",
},

// Add these four new top-level keys inside the fr object:
forfeitBoth: "Double Forfait",
forfeitBothConfirm: "Marquer ce match comme double forfait ? Les deux équipes recevront une défaite.",
forfeitBothSuccess: "Match marqué comme double forfait",
forfeitBothError: "Impossible de marquer le forfait",
```

- [ ] **Step 4: Verify TypeScript compiles**

```powershell
cd "C:\Users\bobiy\OneDrive\Documents\Bio\febakin"
npx tsc --noEmit
```

Expected: no errors about `gameStatus` missing `forfeit` key or `Game.status` union mismatch.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/\(dashboard\)/games/page.tsx
git commit -m "feat: add forfeit status type and translation strings"
```

---

## Task 2: Update league-stats.ts for double forfeit

**Files:**
- Modify: `src/lib/league-stats.ts:162-233`

- [ ] **Step 1: Find the wins/losses block**

Open `src/lib/league-stats.ts`. Locate the block that looks like:

```typescript
const completed = status === "completed" || gameData.completed === true || Boolean(winnerId);

if (!completed) return;
completedGameIds.add(gameId);

if (winnerId && teamRecords.has(winnerId)) {
  const winnerRecord = teamRecords.get(winnerId);
  if (winnerRecord) {
    winnerRecord.wins += 1;
  }

  const loserId = winnerId === homeTeamId ? awayTeamId : homeTeamId;
  if (loserId && teamRecords.has(loserId)) {
    const loserRecord = teamRecords.get(loserId);
    if (loserRecord) {
      loserRecord.losses += 1;
    }
  }
}
```

- [ ] **Step 2: Replace that block with the forfeit-aware version**

```typescript
const isForfeit = gameData.forfeit === true || status === "forfeit";
const completed =
  status === "completed" ||
  status === "forfeit" ||
  gameData.completed === true ||
  Boolean(winnerId);

if (!completed) return;
completedGameIds.add(gameId);

if (isForfeit) {
  // Double forfeit: both teams receive a loss, neither wins
  if (homeTeamId && teamRecords.has(homeTeamId)) {
    const homeRecord = teamRecords.get(homeTeamId);
    if (homeRecord) homeRecord.losses += 1;
  }
  if (awayTeamId && teamRecords.has(awayTeamId)) {
    const awayRecord = teamRecords.get(awayTeamId);
    if (awayRecord) awayRecord.losses += 1;
  }
} else if (winnerId && teamRecords.has(winnerId)) {
  const winnerRecord = teamRecords.get(winnerId);
  if (winnerRecord) {
    winnerRecord.wins += 1;
  }

  const loserId = winnerId === homeTeamId ? awayTeamId : homeTeamId;
  if (loserId && teamRecords.has(loserId)) {
    const loserRecord = teamRecords.get(loserId);
    if (loserRecord) {
      loserRecord.losses += 1;
    }
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/league-stats.ts
git commit -m "feat: forfeit gives both teams a loss in standings"
```

---

## Task 3: Add handleForfeit function in games/page.tsx

**Files:**
- Modify: `src/app/admin/(dashboard)/games/page.tsx` — add function after `handleSaveLiveScore`

- [ ] **Step 1: Find the end of `handleSaveLiveScore`**

Locate the closing `};` of `handleSaveLiveScore` (around line 1422). Insert `handleForfeit` immediately after it:

```typescript
const handleForfeit = async () => {
  if (!scoreEntryGame || !currentAdminUser) return;

  if (!window.confirm(t.forfeitBothConfirm)) return;

  setSavingScoreMode("complete");
  try {
    await updateDoc(doc(firebaseDB, "games", scoreEntryGame.id), {
      homeScore: 0,
      awayScore: 0,
      winnerId: null,
      winnerTeamId: null,
      loserTeamId: null,
      winnerScore: null,
      loserScore: null,
      forfeit: true,
      completed: true,
      status: "forfeit",
      archived: true,
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      archivedAt: serverTimestamp(),
    });

    await Promise.all([recalculateLeagueStatsFromGames(), recomputeHomeProjectorCache()]);

    try {
      await logAuditAction(
        "game_stats_updated",
        currentAdminUser.id,
        currentAdminUser.email || "unknown",
        "game",
        scoreEntryGame.id,
        `${scoreEntryGame.homeTeamName} vs ${scoreEntryGame.awayTeamName}`,
        {
          homeTeam: scoreEntryGame.homeTeamName,
          awayTeam: scoreEntryGame.awayTeamName,
          outcome: "double_forfeit",
          gameDate: scoreEntryGame.date,
        }
      );
    } catch (auditError) {
      console.error("Forfeit saved but audit log failed:", auditError);
    }

    setScoreEntryGame(null);
    setScoreForm({ homeScore: "", awayScore: "" });
    setStatusMessage({ type: "success", message: t.forfeitBothSuccess });
  } catch (error) {
    console.error("Error marking forfeit:", error);
    setStatusMessage({ type: "error", message: t.forfeitBothError });
  } finally {
    setSavingScoreMode(null);
  }
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/\(dashboard\)/games/page.tsx
git commit -m "feat: add handleForfeit — double forfeit both teams"
```

---

## Task 4: Update score modal UI + GameCard forfeit display + getStatusBadge

**Files:**
- Modify: `src/app/admin/(dashboard)/games/page.tsx`

- [ ] **Step 1: Update `getStatusBadge` to include forfeit amber style**

Find the `getStatusBadge` function (around line 1710). Add the `forfeit` entry to the `styles` Record:

```typescript
const styles: Record<Game["status"], string> = {
  scheduled: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  live: "bg-red-500/20 text-red-300 border-red-500/30 animate-pulse",
  completed: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  postponed: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  cancelled: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  forfeit: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};
```

- [ ] **Step 2: Update `GameCard` — make `isCompleted` true for forfeits too**

Find `const isCompleted = game.status === "completed";` (around line 2869 inside `GameCard`). Change it to:

```typescript
const isCompleted = game.status === "completed" || game.status === "forfeit";
```

- [ ] **Step 3: Update `GameCard` — show "FF" instead of scores for forfeits**

Find the away-team score span inside GameCard (it checks `isCompleted` and renders `game.awayScore`). Change the score value:

```typescript
// Away score span — change the score rendering:
{game.status === "forfeit" ? "FF" : game.awayScore}

// Home score span — same change:
{game.status === "forfeit" ? "FF" : game.homeScore}
```

- [ ] **Step 4: Update the middle VS / Final label in GameCard**

Find the center divider that shows `t.gameStatus.completed` when `isCompleted`. Update it:

```typescript
{isCompleted ? (
  <span className="text-xs text-slate-600 uppercase">
    {game.status === "forfeit" ? "–" : t.gameStatus.completed}
  </span>
) : (
  <span className="text-sm text-slate-500">{t.at}</span>
)}
```

- [ ] **Step 5: Add "Double Forfeit" button to the score modal**

Find the score modal action buttons `<div className="flex gap-3 pt-2">` (around line 2358). Replace the entire actions block with a two-row layout:

```tsx
{/* Actions */}
<div className="space-y-2 pt-2">
  <div className="flex gap-3">
    <button
      onClick={handleSaveLiveScore}
      disabled={savingScoreMode !== null}
      className="flex-1 rounded-lg bg-gradient-to-r from-red-500 to-red-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <span className="inline-flex items-center justify-center gap-2">
        {savingScoreMode === "live" ? (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        ) : null}
        <span>{savingScoreMode === "live" ? t.saving : t.saveLiveScore}</span>
      </span>
    </button>
    <button
      onClick={handleSaveScore}
      disabled={savingScoreMode !== null}
      className="flex-1 rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <span className="inline-flex items-center justify-center gap-2">
        {savingScoreMode === "complete" ? (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        ) : null}
        <span>{savingScoreMode === "complete" ? t.saving : t.markComplete}</span>
      </span>
    </button>
    <button
      onClick={() => {
        setScoreEntryGame(null);
        setScoreForm({ homeScore: "", awayScore: "" });
        setSavingScoreMode(null);
      }}
      className="rounded-lg border border-white/10 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 transition"
    >
      {t.cancelEdit}
    </button>
  </div>
  <button
    onClick={handleForfeit}
    disabled={savingScoreMode !== null}
    className="w-full rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 transition disabled:opacity-60 disabled:cursor-not-allowed"
  >
    {t.forfeitBoth}
  </button>
</div>
```

- [ ] **Step 6: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/\(dashboard\)/games/page.tsx
git commit -m "feat: forfeit badge, FF score display, double forfeit button in score modal"
```

---

## Task 5: Mobile CSS fixes in games/page.tsx

**Files:**
- Modify: `src/app/admin/(dashboard)/games/page.tsx`

- [ ] **Step 1: Fix view mode tabs — allow horizontal scroll on mobile**

Find the view mode tabs container `<div className="flex rounded-xl bg-slate-900/60 border border-white/10 p-1">` (around line 1797). Add overflow scroll:

```tsx
// Before:
<div className="flex rounded-xl bg-slate-900/60 border border-white/10 p-1">

// After:
<div className="flex rounded-xl bg-slate-900/60 border border-white/10 p-1 overflow-x-auto scrollbar-hide min-w-0">
```

- [ ] **Step 2: Fix controls row — allow wrapping on mobile**

Find the outer controls `<div className="flex flex-col sm:flex-row gap-3">` (around line 1795). Add `flex-wrap`:

```tsx
// Before:
<div className="flex flex-col sm:flex-row gap-3">

// After:
<div className="flex flex-col sm:flex-row gap-3 flex-wrap">
```

- [ ] **Step 3: Fix matchday card edit/delete buttons — always visible on touch**

Find `<div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">` (around line 2451). Remove the hover-only opacity:

```tsx
// Before:
<div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">

// After:
<div className="absolute top-3 right-3 flex gap-1">
```

- [ ] **Step 4: Fix GameCard mobile row — add delete button alongside venue**

Find the `{/* Mobile Info Row */}` block at the bottom of `GameCard` (around line 3002). Replace it:

```tsx
{/* Mobile Info Row */}
<div className="md:hidden mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
  <span>{formatDate(game.date)} • {game.time}</span>
  <div className="flex items-center gap-2">
    <span className="truncate max-w-[120px]">{game.venue}</span>
    <button
      onClick={() => onDelete(game)}
      className="rounded-lg border border-rose-500/30 p-1.5 text-rose-400 hover:bg-rose-500/10 transition flex-shrink-0 flex items-center justify-center min-w-[32px] min-h-[32px]"
      title={t.deleteGame}
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  </div>
</div>
```

- [ ] **Step 5: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/\(dashboard\)/games/page.tsx
git commit -m "fix: mobile admin — scrollable tabs, always-visible matchday buttons, delete in mobile row"
```

---

## Task 6: Add "Clear Stats" to the stats page

**Files:**
- Modify: `src/app/admin/(dashboard)/stats/page.tsx`

- [ ] **Step 1: Add `clearStats` translation strings to both language objects**

In the `t` object (around lines 95–242), add to both `en` and `fr`:

```typescript
// Inside the en object:
clearStats: "Clear Stats",
clearStatsConfirm: "Delete all player stats for this game? The game score and result will be kept.",
clearStatsSuccess: "Player stats cleared.",
clearStatsError: "Failed to clear player stats.",

// Inside the fr object:
clearStats: "Effacer Stats",
clearStatsConfirm: "Supprimer toutes les statistiques joueurs de ce match ? Le score et le résultat seront conservés.",
clearStatsSuccess: "Statistiques joueurs effacées.",
clearStatsError: "Impossible d'effacer les statistiques joueurs.",
```

- [ ] **Step 2: Add `clearingStatsGameId` state**

In the component's state declarations section (search for `deletingGameId` — the new state goes right below it):

```typescript
const [deletingGameId, setDeletingGameId] = useState<string | null>(null);
const [clearingStatsGameId, setClearingStatsGameId] = useState<string | null>(null);  // ADD THIS LINE
```

- [ ] **Step 3: Add `handleClearStats` function**

Insert this function immediately after the closing `};` of `handleDeleteGame` (around line 2739):

```typescript
const handleClearStats = async (game: Game) => {
  if (!currentAdminUser?.permissions?.canManageGames) return;
  if (!window.confirm(copy.clearStatsConfirm)) return;

  setClearingStatsGameId(game.id);
  try {
    const [sharedStatsSnap, nestedStatsSnap] = await Promise.all([
      getDocs(query(collection(firebaseDB, "playerGameStats"), where("gameId", "==", game.id))),
      getDocs(collection(firebaseDB, `games/${game.id}/playerStats`)),
    ]);

    if (!sharedStatsSnap.empty || !nestedStatsSnap.empty) {
      const batch = writeBatch(firebaseDB);
      sharedStatsSnap.docs.forEach((d) => batch.delete(d.ref));
      nestedStatsSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    await Promise.all([
      recalculateTeamRosterStats(game.homeTeamId),
      recalculateTeamRosterStats(game.awayTeamId),
      recalculateTeamRecords([game.homeTeamId, game.awayTeamId]),
    ]);
    await recomputeHomeProjectorCache();

    await logAuditAction(
      "player_stats_deleted",
      currentAdminUser.id,
      currentAdminUser.email || "unknown",
      "game",
      game.id,
      `${game.awayTeamName} @ ${game.homeTeamName}`,
      {
        operation: "clear_player_stats",
        homeTeam: game.homeTeamName,
        awayTeam: game.awayTeamName,
        gameDate: game.date,
        deletedPlayerGameStats: sharedStatsSnap.size,
        deletedNestedStats: nestedStatsSnap.size,
      }
    );

    window.alert(copy.clearStatsSuccess);
  } catch (error) {
    console.error("Error clearing stats:", error);
    window.alert(copy.clearStatsError);
  } finally {
    setClearingStatsGameId(null);
  }
};
```

- [ ] **Step 4: Add the "Clear Stats" button in the game row**

Find the existing Delete button block in the game row (around line 2888):

```tsx
{canManageStats && (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      handleDeleteGame(game);
    }}
    disabled={deletingGameId === game.id}
    className="rounded-xl px-3 py-2 text-xs font-bold border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
    aria-label={copy.deleteGame}
    title={copy.deleteGame}
  >
    {deletingGameId === game.id ? "..." : copy.deleteGame}
  </button>
)}
```

Add the "Clear Stats" button directly after that closing `)}`:

```tsx
{canManageStats && game.completed && (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      handleClearStats(game);
    }}
    disabled={clearingStatsGameId === game.id}
    className="rounded-xl px-3 py-2 text-xs font-bold border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
    aria-label={copy.clearStats}
    title={copy.clearStats}
  >
    {clearingStatsGameId === game.id ? "..." : copy.clearStats}
  </button>
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/\(dashboard\)/stats/page.tsx
git commit -m "feat: add Clear Stats button — removes player stats, keeps game score and result"
```

---

## Final Verification

- [ ] **Build the project**

```powershell
cd "C:\Users\bobiy\OneDrive\Documents\Bio\febakin"
npm run build
```

Expected: build completes with no TypeScript or Next.js errors.

- [ ] **Manual smoke test on mobile**

1. Open admin on a phone (or DevTools mobile emulation)
2. Go to Games → confirm 4 tabs scroll horizontally without clipping
3. Open a matchday card → confirm edit/delete buttons are visible without hovering
4. Open any game card → confirm the delete icon appears in the bottom info row on mobile
5. Open score entry on any scheduled game → confirm "Double Forfeit" amber button appears below the two action buttons
6. Tap Double Forfeit on a test game → confirm both teams appear with +1 loss in standings
7. Go to Stats → confirm completed games show an amber "Clear Stats" button
8. Tap Clear Stats on a game with registered player stats → confirm player averages drop to 0.0 for that game's stats, score still shows
