# All-Star Leaderboard & Admin Module — Design Spec
_Date: 2026-06-02_

## Overview

Two related features:

1. **Public vote page** (`/vote`) — replace the "Vote Leaders" tab with a Podium B animated leaderboard (top 3 podium + shrinking list for 4–10).
2. **Admin All-Star module** (`/admin/allstar`) — full redesign with summary stats, voter profile placeholder, and a detailed sortable analytical table.

Voter authentication (email/phone) is out of scope for this spec — a placeholder strip is included in the admin UI to be wired later.

---

## Part 1 — Public Vote Page: Leaders Tab

**File:** `src/app/vote/page.tsx`

### Layout

Replace the current `viewMode === "leaders"` section with the Podium B layout:

**Top 3 — Podium row:**
- Three cards side by side: #2 left, #1 centre, #3 right.
- #1 card is scaled ~10% larger (`scale-110`), has a gold gradient border (`border-yellow-400/40`), and a crown emoji above the avatar.
- Each card shows: letter avatar (first initial), name, team, vote count.
- #2 uses silver styling, #3 uses bronze.

**Ranks 4–10 — Mini list:**
- Compact rows below the podium.
- Each row: rank number, name, team, thin relative progress bar (width = `votes / leader_votes * 100%`), vote count.
- Rows progressively decrease in opacity: rank 4 = 85%, rank 10 = 40%.

**Animations:**
- Podium cards: `fadeInUp` with spring bounce (`cubic-bezier(0.34, 1.56, 0.64, 1)`), staggered delays (#1: 0ms, #2: 120ms, #3: 200ms).
- Mini list rows: `fadeIn` staggered at 40ms per row, starting after 300ms.
- Progress bars: width animates from 0 to target over 800ms on mount (`transition-all duration-700`).
- All animations trigger once when the leaders tab becomes active (reset on tab switch).

**Data source:** Same `voteCounts` state already fetched from `allStarVoteResults/{menPlayers,womenPlayers}`. No new Firestore reads.

**Category:** Controlled by the existing gender toggle (Men / Women) — no new tabs.

---

## Part 2 — Admin All-Star Module

**File:** `src/app/admin/(dashboard)/allstar/page.tsx`

Full redesign of the existing page. Firebase collections remain unchanged (`allStarVotes`, `teams`).

### Summary Stats Bar

4 cards in a `grid-cols-2 sm:grid-cols-4` row:
- **Total Voters** — `allStarVotes` document count
- **Total Votes Cast** — sum of all selected IDs across all categories
- **Men Players Nominees** — distinct IDs with ≥1 vote in `menPlayers`
- **Women Players Nominees** — distinct IDs with ≥1 vote in `womenPlayers`

### Voter Profiles Strip

A single info row below the stats:
- Left: label "Voter Profiles"
- Middle: pill "N registered voters", pill "Email / Phone — coming soon"
- Right: muted "→ Profile analytics" link (non-functional for now)
- Styled as a subtle `bg-slate-800/40 border border-white/5 rounded-xl` row.

### Category Tabs

Same 4 tabs as current: Men Players, Women Players, Men Coaches, Women Coaches. Same orange active style.

### Analytical Sortable Table

Columns (all sortable except #):

| Column | Description |
|--------|-------------|
| # | Rank badge (gold/silver/bronze/grey) |
| Name | Player/coach name, white bold for top 3 |
| Team | Team name, muted |
| Votes | Raw vote count, orange for #1, silver for #2, bronze for #3 |
| % of Voters | `votes / totalVoters * 100` — inline mini bar + percentage |
| % of Category | `votes / categoryTotalVotes * 100` — inline mini bar + percentage |
| Share of Total | `votes / totalVotes * 100` — percentage only |
| Today | Delta votes in last 24h — green if positive, red if negative, grey if zero |
| Trend | ↑↑ / ↑ / — / ↓ icon based on today's delta |

**Sorting behaviour:**
- Client-side sort on the already-loaded data array.
- Default sort: Votes descending.
- Clicking an active column header toggles asc/desc.
- Active column header highlighted in orange-400 with ↑ / ↓ arrow.

**"Today" delta:** Computed from a `submittedAt` / `lastModified` timestamp on each `allStarVotes` doc. Votes cast or updated within the last 24h count as today's delta per nominee.

**Refresh button:** Retained from current page. Adds a "Last refreshed X min ago" timestamp beside it.

### Data Loading

Reuse the existing `load()` function structure. Extend it to also:
- Count today's delta per nominee (filter `allStarVotes` docs where `lastModified >= now - 24h`).
- Compute `categoryTotalVotes` per category (sum of all votes in that category).
- Pass `totalVoters` and `totalVotes` down for percentage calculations.

---

## What Is Not Changing

- Firebase schema — no new collections or fields.
- Admin nav — `allstar` entry already exists in `layout.tsx`.
- Auth flow for voters — out of scope, placeholder only.
- Coach leaderboard columns — same as players (coaches don't have a "% of Voters" delta today column since voter auth isn't built, but the table renders the same way).
- The `AllStarVotesModal` used in the pulse page — untouched.
- The `AllStarFloatingButton` and `AllStarVoteBanner` components — untouched.

---

## File Changelist

| File | Change |
|------|--------|
| `src/app/vote/page.tsx` | Replace leaders view with Podium B layout + animations |
| `src/app/admin/(dashboard)/allstar/page.tsx` | Full redesign — stats bar, voter strip, sortable table |
