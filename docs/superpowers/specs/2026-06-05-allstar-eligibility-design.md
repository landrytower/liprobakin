# All-Star Eligibility — Design Spec

**Date:** 2026-06-05
**Status:** Approved for implementation

## Problem

Today every player on every roster is votable in the All-Star vote (`/vote`).
The league wants to control *who* fans are allowed to vote for. Admins need a way
to mark, per team, which players are eligible. On the public vote page,
non-eligible players must be visibly blocked (greyed out with a "non-eligible"
tag) and impossible to add to a ballot.

The feature must work in French and English, load fast, and be fully responsive
on phones.

## Decisions (locked)

1. **Default state = nobody eligible.** Until an admin explicitly marks players,
   no player on that team is votable. Voting effectively pauses for an
   unconfigured team. Admins are expected to configure eligibility before
   (re)opening voting.
2. **Non-eligible tap behavior = greyed + tag, not selectable.** Non-eligible
   players still appear in the vote-page search results but are dimmed, carry a
   "Non-eligible / Non éligible" tag, and tapping them does nothing.
3. **Explicit Save** in the admin panel (not auto-save per checkbox) — fewer
   writes, clearer intent, with an unsaved-changes indicator.

## Data Model

A single Firestore document: **`settings/allStarEligibility`**

```ts
{
  teams: {
    [teamId: string]: string[]   // eligible player (roster doc) IDs for that team
  }
}
```

- Per-team arrays so saving one team's selection never clobbers another's
  (merge-write only that team's key: `setDoc(ref, { teams: { [teamId]: ids } }, { merge: true })`).
- The vote page flattens every array into a single `Set<string>` of eligible IDs.
- Absent doc / absent team key / empty array ⇒ that team has **no** eligible
  players (consistent with decision #1).
- Player IDs are roster doc IDs, which the existing system already treats as
  globally unique (ballots store bare IDs in `menPlayers[]` / `womenPlayers[]`),
  so a flat Set is consistent with current assumptions.

**Security:** `settings/{document=**}` already allows public read + admin write
(`firestore.rules:141`). No rules change needed.

## Component 1 — Eligibility loader (`src/lib/allstar-settings.ts`)

Add a cached loader mirroring the existing `getAllStarSettings()` module-promise
pattern (one Firestore read shared per page load):

```ts
export function getAllStarEligibility(): Promise<Set<string>>
```

- Reads `settings/allStarEligibility` once, flattens `teams` values into a `Set`.
- On error returns an **empty set** (fail-closed: nobody eligible) — but see
  "Failure handling" below for why the vote page must distinguish "not yet
  loaded" from "loaded empty".
- Exposes a way to invalidate/refetch is **not** required for the vote page
  (page reload is fine); the admin panel reads the raw doc directly (it needs the
  per-team structure, not the flattened set).

## Component 2 — Admin Eligibility section (`/admin/allstar`)

A new section added to `src/app/admin/(dashboard)/allstar/page.tsx`, placed near
the top (after the enable/theme toggles, before/around the banner section).

**Data loaded:**
- Teams list (id, name, city, gender) — a `getDocs(collection(... "teams"))`.
- Current eligibility doc (`settings/allStarEligibility`) — raw `{ teams }` map.
- Selected team's roster — lazily on selection, cached per team in a ref so
  re-selecting a team is instant.

**UI:**
- **Team selector**: pill buttons grouped by gender (Men / Hommes, Women /
  Femmes), reusing the gender labels already in the file's `tr` table. Shows a
  small "N eligible" badge per team derived from the eligibility map.
- On select: a **plain checkbox list of player names** (full name only — no
  photos, no position), sorted by name. Each row = checkbox + name.
- **Live counter**: `9 / 12 eligible`.
- **Select all** / **Clear all** buttons.
- **Save** button: enabled only when the local selection differs from the saved
  state; writes `{ teams: { [teamId]: checkedIds } }` (merge). Shows
  saving / saved / error states. An "unsaved changes" hint appears when dirty.
- All copy bilingual via the existing `tr` object (add new keys).

**State shape (local):**
- `eligibilityMap: Record<teamId, string[]>` — the saved server state.
- `selectedTeamId: string | null`.
- `draftIds: string[]` — checkboxes for the currently selected team (the working
  copy). `dirty = !setEqual(draftIds, eligibilityMap[selectedTeamId] ?? [])`.
- On Save success, fold `draftIds` back into `eligibilityMap`.

## Component 3 — Vote page (`/vote`)

Changes to `src/app/vote/page.tsx`:

1. **Load eligibility** in its own effect via `getAllStarEligibility()`, stored as
   `eligibleIds: Set<string> | null` (null = still loading). Runs in parallel
   with roster loading — must not block first paint.
2. **`PlayerEntry` gains `eligible: boolean`** — computed where the search/derived
   lists are built, as `eligibleIds?.has(p.id) ?? false`. (Computed at render
   from the Set, so rosters themselves don't need re-mapping.)
3. **Search results dropdown**: for a non-eligible player, render the row
   - dimmed (reduced opacity / muted text),
   - with a small tag badge: FR "Non éligible" / EN "Non-eligible",
   - and disable interaction (`onMouseDown` becomes a no-op; not added to ballot).
4. **`togglePlayer`** ignores non-eligible IDs defensively (even if some path
   reaches it).
5. **Already-selected players** (restored saved votes) continue to render in the
   selected list regardless of eligibility — eligibility only gates *new* picks.

**Failure handling (important):** because default is "nobody eligible," a failed
or slow eligibility read must not silently grey out the entire roster while data
is still in flight. Treatment:
- While `eligibleIds === null` (loading), **suppress the non-eligible tag** to
  avoid a flash of "everyone non-eligible." The Set resolves quickly (a single
  small doc), so the window is brief.
- Once loaded (even if empty), apply eligibility normally.
- On hard error, `getAllStarEligibility` resolves to an empty Set (fail-closed):
  nobody votable, which is the safe/intended default. This is acceptable because
  the admin is expected to have configured eligibility; a transient error simply
  blocks new votes rather than allowing invalid ones.

## Component 4 — Secondary QA pass

These are explicit asks bundled with the feature; scoped to stay shippable.

1. **Final-score save bug.** Trace the admin game-scoring / "save final score"
   path (game admin + stats-sheet), reproduce the reported failure, fix the
   concrete bug found. Verify the saved score persists and reflects on public
   game/standings views.
2. **Mobile responsiveness.** New Eligibility UI must be fully responsive
   (checkbox list, team pills, save bar). Spot-check vote page + admin All-Star
   at phone widths.
3. **General All-Star flow review** for obvious breakage introduced or adjacent.

**Caveat:** "check all the bugs" is deliberately scoped to the All-Star flow plus
the called-out final-score save — not a full-app audit.

## Performance Notes

- Eligibility = one tiny cached doc read, fetched in parallel; does not block
  roster render or first paint.
- Admin roster loads are one subcollection read per selected team, cached per
  team for instant re-selection.
- No change to the existing leaders-snapshot fast path.

## Out of Scope

- Retroactively invalidating ballots when a player's eligibility changes after a
  vote was cast.
- Per-player eligibility metadata (reason, dates) — boolean membership only.
- Bulk import/export of eligibility.

## Testing

- Admin: select team → check players → Save → reload → selection persists.
  Select-all / clear-all. Save only enabled when dirty. FR + EN copy.
- Vote page: eligible players selectable; non-eligible dimmed + tagged + inert in
  FR and EN. Default (no config) ⇒ all non-eligible. After admin configures a
  team, those players become selectable.
- Final-score save: enter final score → save → persists on reload + public views.
- Mobile widths: no overflow / clipped controls on new UI.
