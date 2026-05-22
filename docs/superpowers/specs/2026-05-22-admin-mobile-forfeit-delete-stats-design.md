# Admin Page: Mobile Fixes, Delete, Forfeit, Stats Averages

**Date:** 2026-05-22  
**Approach:** Approach A — Targeted fixes

---

## Overview

Four improvements to the admin dashboard's games management:

1. Mobile responsiveness — fix broken touch targets and overflowing controls
2. Delete games & player stats — expose existing delete on mobile; add "Clear Stats" action
3. Double forfeit — new forfeit outcome for games where both teams don't show
4. Stats averages correctness — gamesPlayed denominator must only count games with registered player stats

---

## 1. Mobile Responsiveness

### View mode tabs
- Wrap `matchday / calendar / schedule / archive` tabs in `overflow-x-auto scrollbar-hide` so they scroll horizontally on small phones instead of clipping.

### Filter + action buttons row
- Change from `flex-row` to `flex-wrap gap-2` so buttons stack instead of overflow on narrow screens.

### Matchday card buttons
- Remove `opacity-0 group-hover:opacity-100` on edit/delete buttons inside matchday cards.
- Replace with always-visible small icon buttons (top-right corner) so they are reachable on touch devices.

### GameCard action buttons
- Ensure all action buttons meet a minimum 44×44px touch target.
- On mobile (`md:hidden` row), add the delete button alongside the date/venue info row so it's easy to tap without needing to reach the right-side cluster.

### Score modal
- Already mobile-friendly (`max-w-md p-6`). No changes needed.

### Game scheduling form
- Already uses `grid-cols-1 md:grid-cols-3` for date/time/venue. No changes needed.

---

## 2. Delete Games & Player Stats

### Delete a game (existing, mobile fix only)
- The delete button in `GameCard` already works and cascade-deletes `playerGameStats`.
- Mobile fix: ensure it's visible and tappable in the mobile info row at the bottom of the card.
- No logic changes needed.

### Delete player stats for a game (new — Stats page)
- Add a "Clear Stats" trash-icon button on each game row in the Stats page.
- Button is only shown when `playerGameStats` records exist for that game (i.e., stats have been registered).
- Confirmation dialog: "This will delete all player stats for this game. The game score and result will be kept. Continue?"
- On confirm:
  1. Query and delete all `playerGameStats` documents where `gameId == game.id`
  2. Call `recalculateLeagueStatsFromGames()` to recompute player averages
  3. Call `recomputeHomeProjectorCache()` to sync the projector cache
  4. Show success toast
- The game document (score, winner, status) is NOT modified.
- Log audit action `player_stats_deleted`.

---

## 3. Double Forfeit

### UI
- Add a "Double Forfeit" button in the score entry modal, styled in amber, below or alongside the existing "Update Live" / "Mark Complete" buttons.
- Confirmation dialog: "Mark this game as a double forfeit? Both teams will receive a loss."

### Data model
- Add `forfeit: true` boolean flag to the game document.
- Add `status: "forfeit"` as a new valid status (extend the `Game` type union).
- Set `homeScore: 0`, `awayScore: 0`, `winnerId: null`, `winnerTeamId: null`, `loserTeamId: null`.
- Set `completed: true`, `archived: true`, `status: "forfeit"`.

### Standings calculation (`league-stats.ts`)
- Forfeit games: both teams get +1 loss. Since `winnerId` is null, neither team gets a win.
- The existing logic `if (winnerId && teamRecords.has(winnerId))` already skips the win when `winnerId` is null, so only the loss needs to be explicit.
- Add a check: if `forfeit === true`, add a loss to BOTH `homeTeamId` and `awayTeamId`.

### GameCard display
- Add `forfeit` to the status badge map with amber styling: `bg-amber-500/20 text-amber-300 border-amber-500/30`.
- When `game.status === "forfeit"`, show "FF – FF" instead of scores in the card.
- Add `forfeit` to translation strings in both `en` and `fr`.

---

## 4. Stats Averages — gamesPlayed Denominator

### Current behavior (verified)
- `recalculateLeagueStatsFromGames` builds a `totalsByPlayer` map.
- The `games` counter increments **only** when a player's stat record is found — either in the embedded `playerStats` array on the game doc, or in the `playerGameStats` collection.
- Score-only saves (`handleSaveScore` in games page) do not write any player stats, so they do not increment any player's `games` counter.
- The `avg` function divides by `games`, so averages are already based on games with stats only.

### Fix / guard to add
- The current logic is correct. However, add an explicit guard in `handleSaveScore`: after saving a score, the call to `recalculateLeagueStatsFromGames` should not inadvertently create player stat entries.
- Confirm that `gamesPlayed` written to each player document equals the count of `playerGameStats` records for that player (not total completed games the team played).
- If any discrepancy is found during implementation, fix the `games` accumulator to only count from `playerGameStats` collection (the canonical source), ignoring the embedded `playerStats` array unless there are no `playerGameStats` records for that game.

---

## Files to Change

| File | Changes |
|------|---------|
| `src/app/admin/(dashboard)/games/page.tsx` | Mobile CSS fixes, forfeit handler, forfeit status type, forfeit badge, forfeit translation strings |
| `src/app/admin/(dashboard)/stats/page.tsx` | "Clear Stats" button + delete handler |
| `src/lib/league-stats.ts` | Forfeit loss handling for both teams; verify/guard gamesPlayed denominator |

---

## Out of Scope

- No changes to the public-facing standings or player profile pages (they read from the already-recalculated data).
- No changes to the PDF export.
- No single-team forfeit (only double forfeit is in scope per the spec).
