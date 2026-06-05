# All-Star Eligibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins choose, per team, which players are eligible for All-Star voting; on the public vote page, non-eligible players show greyed with a "Non-eligible" tag and cannot be picked. Plus a scoped QA pass (final-score save resilience + mobile responsiveness).

**Architecture:** Eligibility lives in one Firestore doc `settings/allStarEligibility` shaped `{ teams: { [teamId]: string[] } }`. The vote page reads it once (cached module promise, like `getAllStarSettings`) and flattens it to a `Set<string>`. Default-absent ⇒ nobody eligible. The admin All-Star page gets a new "Eligibility" section (team picker + checkbox list + explicit Save).

**Tech Stack:** Next.js (App Router, client components), TypeScript, Firebase Firestore, Tailwind CSS.

**Testing note:** This repo has **no test framework** (no vitest/jest/playwright, zero test files). Per existing project conventions, each task is verified with `npm run lint`, `npm run build` (TypeScript typecheck), and explicit manual browser checks — not unit tests. Do **not** add a test harness.

---

## File Structure

- **Modify** `src/lib/allstar-settings.ts` — add cached `getAllStarEligibility()` returning `Set<string>`.
- **Modify** `src/app/vote/page.tsx` — load eligibility set; grey-out + tag + block non-eligible players in the search results.
- **Modify** `src/app/admin/(dashboard)/allstar/page.tsx` — add the Eligibility admin section (state, data load, UI).
- **Modify** `src/app/admin/(dashboard)/games/page.tsx` — fix `handleSaveScore` so post-save recalculation failures don't masquerade as save failures.

No new files. No Firestore rules change (`settings/{document=**}` is already public-read / admin-write).

---

## Task 1: Eligibility loader

**Files:**
- Modify: `src/lib/allstar-settings.ts`

- [ ] **Step 1: Add the cached loader**

Append to `src/lib/allstar-settings.ts` (the file already imports `doc`, `getDoc`, and `firebaseDB`):

```ts
// Module-level promise cache — one Firestore read shared across all components per page load
let _eligibilityPromise: Promise<Set<string>> | null = null;

/**
 * Returns the set of player IDs eligible for All-Star voting, flattened across
 * all teams from settings/allStarEligibility { teams: { [teamId]: string[] } }.
 * Fails closed: on error or missing doc, returns an empty set (nobody eligible).
 */
export function getAllStarEligibility(): Promise<Set<string>> {
  if (!_eligibilityPromise) {
    _eligibilityPromise = getDoc(doc(firebaseDB, "settings", "allStarEligibility"))
      .then((snap) => {
        const teams = (snap.exists() ? snap.data().teams : undefined) as
          | Record<string, string[]>
          | undefined;
        const set = new Set<string>();
        if (teams) {
          for (const ids of Object.values(teams)) {
            for (const id of ids || []) set.add(id);
          }
        }
        return set;
      })
      .catch(() => new Set<string>());
  }
  return _eligibilityPromise;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: compiles with no new TypeScript errors. (If the build is slow, `npx tsc --noEmit` is an acceptable faster check.)

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new lint errors in `src/lib/allstar-settings.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/allstar-settings.ts
git commit -m "feat: add getAllStarEligibility cached loader"
```

---

## Task 2: Vote page — load eligibility and block non-eligible picks

**Files:**
- Modify: `src/app/vote/page.tsx`

- [ ] **Step 1: Import the loader**

In `src/app/vote/page.tsx`, change the import from `@/lib/team-gender` area. Add a new import line near the other `@/lib` imports (after line 18 `import { normalizeTeamGender, type TeamGender } from "@/lib/team-gender";`):

```ts
import { getAllStarEligibility } from "@/lib/allstar-settings";
```

- [ ] **Step 2: Add the two translation keys**

In the `tr` object, add `nonEligible` to both languages.

In `tr.fr` (after the line `alreadyVotedSub: "Ce numéro a déjà soumis un vote.",`):

```ts
    nonEligible: "Non éligible",
```

In `tr.en` (after the line `alreadyVotedSub: "This phone number has already submitted a vote.",`):

```ts
    nonEligible: "Non-eligible",
```

- [ ] **Step 3: Add eligibility state**

After the existing `const [leadersSnap, setLeadersSnap] = useState<...>(null);` line (~line 160), add:

```ts
  // null = not yet loaded (suppress tag to avoid a flash of "all non-eligible")
  const [eligibleIds, setEligibleIds] = useState<Set<string> | null>(null);
```

- [ ] **Step 4: Load eligibility in an effect**

After the leaders-snapshot effect (the `useEffect` that calls `getDoc(doc(firebaseDB, "allStarLeaders", "snapshot"))`, ends ~line 240), add a new effect:

```ts
  // Fetch eligibility set (cached, parallel — must not block first paint)
  useEffect(() => {
    getAllStarEligibility()
      .then(setEligibleIds)
      .catch(() => setEligibleIds(new Set()));
  }, []);
```

- [ ] **Step 5: Guard `togglePlayer` against non-eligible IDs**

In `togglePlayer` (~line 255), add a guard as the first line inside the function body, before `setSelectedPlayers`:

```ts
  const togglePlayer = (id: string) => {
    if (eligibleIds !== null && !eligibleIds.has(id)) return; // non-eligible: inert
    setSelectedPlayers((prev) => {
```

(Leave the rest of `togglePlayer` unchanged.)

- [ ] **Step 6: Render non-eligible search rows greyed + tagged + inert**

Replace the search-results `.map(...)` block (currently ~lines 629–645, the `{searchResults.map((player) => { ... })}` inside the dropdown) with:

```tsx
                  {searchResults.map((player) => {
                    const voteCount = playerVotes[player.id] || 0;
                    const isSelected = curPlayers.includes(player.id);
                    const blocked = eligibleIds !== null && !eligibleIds.has(player.id);
                    return (
                      <button
                        key={player.id}
                        disabled={blocked}
                        onMouseDown={blocked ? undefined : () => { togglePlayer(player.id); setSearch(""); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${blocked ? "opacity-40 cursor-not-allowed" : "hover:bg-white/5"} ${isSelected ? "opacity-50" : ""} ${shakeId === player.id ? "animate-shake" : ""}`}>
                        <div className="w-9 h-9 rounded-full bg-slate-700 overflow-hidden relative shrink-0 flex items-center justify-center">
                          {player.headshot ? <Image src={player.headshot} alt={player.name} fill className="object-cover object-top" sizes="36px" /> : <PersonPlaceholder size={20} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{player.name}</p>
                          <p className="text-xs text-slate-400 truncate">{player.teamName}</p>
                        </div>
                        {blocked ? (
                          <span className="text-[10px] font-bold shrink-0 px-2 py-0.5 rounded-full bg-slate-600/30 text-slate-400 border border-slate-500/30 uppercase tracking-wide whitespace-nowrap">
                            {t.nonEligible}
                          </span>
                        ) : (
                          voteCount > 0 && <span className="text-xs text-orange-400 font-bold shrink-0 px-2 py-0.5 rounded-full bg-orange-400/10">{voteCount}</span>
                        )}
                      </button>
                    );
                  })}
```

- [ ] **Step 7: Typecheck + lint**

Run: `npm run build` then `npm run lint`
Expected: no new errors.

- [ ] **Step 8: Manual verification**

Run: `npm run dev`, open `/vote`.
- With no eligibility configured yet (fresh `settings/allStarEligibility` absent), every player in the search dropdown shows the "Non-eligible / Non éligible" tag, is dimmed, and tapping does nothing.
- Toggle the language switch — tag reads "Non éligible" in FR, "Non-eligible" in EN.
- (Eligible players are verified after Task 4 configures some.)

- [ ] **Step 9: Commit**

```bash
git add src/app/vote/page.tsx
git commit -m "feat: grey out and block non-eligible players on vote page"
```

---

## Task 3: Admin Eligibility section — state and data loading

**Files:**
- Modify: `src/app/admin/(dashboard)/allstar/page.tsx`

- [ ] **Step 1: Add translation keys**

In the `tr` object, add these keys to BOTH `tr.en` and `tr.fr`.

Add to `tr.en` (after `minAgo: "min ago",`):

```ts
    eligTitle: "Eligibility",
    eligSubtitle: "Choose which players fans can vote for",
    eligSelectTeam: "Select a team to set eligibility",
    eligPickTeam: "Pick a team above to manage its eligible players.",
    eligSelectAll: "Select all",
    eligClearAll: "Clear all",
    eligSave: "Save eligibility",
    eligSaving: "Saving…",
    eligSaved: "Saved!",
    eligUnsaved: "Unsaved changes",
    eligEligible: "eligible",
    eligNoRoster: "No players on this team.",
    eligRosterLoading: "Loading players…",
    eligError: "Could not save. Please try again.",
```

Add to `tr.fr` (after `minAgo: "min",`):

```ts
    eligTitle: "Éligibilité",
    eligSubtitle: "Choisissez les joueurs que les fans peuvent voter",
    eligSelectTeam: "Sélectionnez une équipe pour définir l'éligibilité",
    eligPickTeam: "Choisissez une équipe ci-dessus pour gérer ses joueurs éligibles.",
    eligSelectAll: "Tout sélectionner",
    eligClearAll: "Tout effacer",
    eligSave: "Enregistrer l'éligibilité",
    eligSaving: "Enregistrement…",
    eligSaved: "Enregistré !",
    eligUnsaved: "Modifications non enregistrées",
    eligEligible: "éligibles",
    eligNoRoster: "Aucun joueur dans cette équipe.",
    eligRosterLoading: "Chargement des joueurs…",
    eligError: "Échec de l'enregistrement. Réessayez.",
```

- [ ] **Step 2: Add eligibility state**

After the existing `const [bannerResetSuccess, setBannerResetSuccess] = useState(false);` line (~line 204), add:

```ts
  // ── Eligibility ──
  type EligTeam = { id: string; name: string; gender: "men" | "women" };
  type EligPlayer = { id: string; name: string };
  const [eligTeams, setEligTeams] = useState<EligTeam[]>([]);
  const [eligMap, setEligMap] = useState<Record<string, string[]>>({});
  const [eligSelectedTeam, setEligSelectedTeam] = useState<string | null>(null);
  const [eligRoster, setEligRoster] = useState<EligPlayer[]>([]);
  const [eligRosterLoading, setEligRosterLoading] = useState(false);
  const [eligDraft, setEligDraft] = useState<string[]>([]);
  const [eligSaving, setEligSaving] = useState(false);
  const [eligSavedFlash, setEligSavedFlash] = useState(false);
  const [eligErrorFlag, setEligErrorFlag] = useState(false);
  const eligRosterCache = useRef<Record<string, EligPlayer[]>>({});
```

- [ ] **Step 3: Load teams + eligibility doc**

After the state, add an effect (place it near the other `useEffect`s, e.g. after the `useEffect(() => { getDoc(doc(firebaseDB, "settings", "allStarBanner"))...` effect ~line 342):

```ts
  // Load teams + current eligibility map for the Eligibility section
  useEffect(() => {
    (async () => {
      const [teamsSnap, eligSnap] = await Promise.all([
        getDocs(collection(firebaseDB, "teams")),
        getDoc(doc(firebaseDB, "settings", "allStarEligibility")),
      ]);
      const teams: EligTeam[] = teamsSnap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: [data.city, data.name].filter(Boolean).join(" ") || d.id,
            gender: normalizeTeamGender(data.gender, data.logo, "men") as "men" | "women",
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      setEligTeams(teams);
      setEligMap(eligSnap.exists() ? ((eligSnap.data().teams as Record<string, string[]>) || {}) : {});
    })().catch(() => {});
  }, []);
```

(`normalizeTeamGender`, `collection`, `getDocs`, `getDoc`, `doc`, `setDoc`, `firebaseDB` are all already imported in this file.)

- [ ] **Step 4: Add select-team, toggle, save handlers**

After the load effect, add:

```ts
  const selectEligTeam = async (teamId: string) => {
    setEligSelectedTeam(teamId);
    setEligDraft(eligMap[teamId] ?? []);
    setEligErrorFlag(false);
    if (eligRosterCache.current[teamId]) {
      setEligRoster(eligRosterCache.current[teamId]);
      return;
    }
    setEligRosterLoading(true);
    try {
      const snap = await getDocs(collection(firebaseDB, "teams", teamId, "roster"));
      const roster: EligPlayer[] = snap.docs
        .map((d) => {
          const pd = d.data();
          return { id: d.id, name: `${pd.firstName || ""} ${pd.lastName || ""}`.trim() || pd.name || d.id };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      eligRosterCache.current[teamId] = roster;
      setEligRoster(roster);
    } catch {
      setEligRoster([]);
    } finally {
      setEligRosterLoading(false);
    }
  };

  const toggleEligPlayer = (id: string) =>
    setEligDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const saveEligibility = async () => {
    if (!eligSelectedTeam) return;
    setEligSaving(true);
    setEligErrorFlag(false);
    try {
      await setDoc(
        doc(firebaseDB, "settings", "allStarEligibility"),
        { teams: { [eligSelectedTeam]: eligDraft } },
        { merge: true },
      );
      setEligMap((prev) => ({ ...prev, [eligSelectedTeam]: eligDraft }));
      setEligSavedFlash(true);
      setTimeout(() => setEligSavedFlash(false), 2500);
    } catch {
      setEligErrorFlag(true);
    } finally {
      setEligSaving(false);
    }
  };
```

- [ ] **Step 5: Typecheck + lint**

Run: `npm run build` then `npm run lint`
Expected: no new errors. (The handlers/state are unused until Task 4 adds the UI — TypeScript allows unused functions, but unused `useState` setters are fine. If lint flags an unused var, it will be consumed in Task 4; if the linter is strict enough to fail the build, proceed straight to Task 4 before committing.)

- [ ] **Step 6: Commit**

```bash
git add "src/app/admin/(dashboard)/allstar/page.tsx"
git commit -m "feat: add eligibility state and data loading to admin All-Star page"
```

---

## Task 4: Admin Eligibility section — UI

**Files:**
- Modify: `src/app/admin/(dashboard)/allstar/page.tsx`

- [ ] **Step 1: Compute the dirty flag in render**

Inside the component body, just before the `return (` statement (after `lastRefreshedLabel`, ~line 559), add:

```ts
  const eligSavedForTeam = eligSelectedTeam ? eligMap[eligSelectedTeam] ?? [] : [];
  const eligDirty =
    eligSelectedTeam !== null &&
    (eligDraft.length !== eligSavedForTeam.length ||
      eligDraft.some((id) => !eligSavedForTeam.includes(id)));
  const eligGroups: { key: "men" | "women"; label: string }[] = [
    { key: "men", label: language === "fr" ? "Hommes" : "Men" },
    { key: "women", label: language === "fr" ? "Femmes" : "Women" },
  ];
```

- [ ] **Step 2: Insert the Eligibility section markup**

Insert this block immediately AFTER the closing of the gold-theme-toggle section (the `</div>` that ends the `{/* ── All-Star Gold Theme Toggle ── */}` block, ~line 673) and BEFORE the `{/* ── Home Page Vote Banner ── */}` comment (~line 675):

```tsx
      {/* ── Eligibility ── */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-xl shrink-0">✅</div>
          <div>
            <p className="text-sm font-bold text-emerald-300 tracking-wide uppercase">{t.eligTitle}</p>
            <p className="text-xs text-emerald-600/80 mt-0.5">{t.eligSubtitle}</p>
          </div>
        </div>

        {/* Team picker grouped by gender */}
        <div className="space-y-3">
          {eligGroups.map((group) => {
            const groupTeams = eligTeams.filter((tm) => tm.gender === group.key);
            if (groupTeams.length === 0) return null;
            return (
              <div key={group.key}>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">{group.label}</p>
                <div className="flex flex-wrap gap-2">
                  {groupTeams.map((tm) => {
                    const count = (eligMap[tm.id] ?? []).length;
                    const active = eligSelectedTeam === tm.id;
                    return (
                      <button
                        key={tm.id}
                        onClick={() => selectEligTeam(tm.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${active ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-white/5"}`}
                      >
                        {tm.name}
                        {count > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? "bg-white/20" : "bg-emerald-500/15 text-emerald-400"}`}>{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Roster checkbox list */}
        {eligSelectedTeam === null ? (
          <div className="text-center py-8 text-slate-500 text-sm">{t.eligPickTeam}</div>
        ) : eligRosterLoading ? (
          <div className="flex items-center justify-center py-8 text-slate-500 text-sm gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            {t.eligRosterLoading}
          </div>
        ) : eligRoster.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">{t.eligNoRoster}</div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-xs font-bold text-emerald-400 tabular-nums">
                {eligDraft.length} / {eligRoster.length} {t.eligEligible}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setEligDraft(eligRoster.map((p) => p.id))} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 transition-all">{t.eligSelectAll}</button>
                <button onClick={() => setEligDraft([])} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-700/60 hover:bg-slate-700 border border-white/5 text-slate-300 transition-all">{t.eligClearAll}</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {eligRoster.map((p) => {
                const checked = eligDraft.includes(p.id);
                return (
                  <label key={p.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${checked ? "bg-emerald-500/10 border-emerald-500/30" : "bg-slate-800/50 border-white/5 hover:bg-slate-800"}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleEligPlayer(p.id)}
                      className="w-4 h-4 shrink-0 rounded accent-emerald-500"
                    />
                    <span className={`text-sm truncate ${checked ? "text-white font-medium" : "text-slate-300"}`}>{p.name}</span>
                  </label>
                );
              })}
            </div>

            {/* Save bar */}
            <div className="flex items-center justify-end gap-3 pt-1 flex-wrap">
              {eligErrorFlag && <span className="text-xs text-red-400 mr-auto">{t.eligError}</span>}
              {eligDirty && !eligSaving && <span className="text-xs text-amber-400 mr-auto">{t.eligUnsaved}</span>}
              <button
                onClick={saveEligibility}
                disabled={!eligDirty || eligSaving}
                className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-600/30"
              >
                {eligSaving ? (
                  <span className="flex items-center gap-2"><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>{t.eligSaving}</span>
                ) : eligSavedFlash ? (
                  <span className="flex items-center gap-2"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>{t.eligSaved}</span>
                ) : t.eligSave}
              </button>
            </div>
          </div>
        )}
      </div>
```

- [ ] **Step 3: Typecheck + lint**

Run: `npm run build` then `npm run lint`
Expected: no new errors; previously-unused handlers from Task 3 are now consumed.

- [ ] **Step 4: Manual verification (admin)**

Run: `npm run dev`, open `/admin/allstar` (log in as admin).
- The Eligibility section appears below the gold-theme toggle.
- Teams are grouped Men / Women (Hommes / Femmes in FR).
- Click a team → roster loads as a plain checkbox list (names only, no photos), 2 columns on desktop, 1 on mobile.
- Counter reads `0 / N eligible`. Check a few → counter updates. Save button enables ("Unsaved changes" shows). Click **Save** → spinner → "Saved!". Re-select another team and come back → selections persisted. Reload the page → still persisted, and the team pill shows the eligible count badge.
- **Select all** / **Clear all** work. Toggle language → all labels switch FR/EN.

- [ ] **Step 5: Cross-check with vote page**

With the same dev server, open `/vote`. The players you just marked eligible are now selectable (no tag); everyone else still shows the "Non-eligible" tag and is inert. Confirm in both languages.

- [ ] **Step 6: Commit**

```bash
git add "src/app/admin/(dashboard)/allstar/page.tsx"
git commit -m "feat: add eligibility admin UI (team picker, checkbox list, save)"
```

---

## Task 5: Fix final-score save resilience

**Files:**
- Modify: `src/app/admin/(dashboard)/games/page.tsx:1307-1385`

**Problem:** In `handleSaveScore`, `recalculateLeagueStatsFromGames()` and `recomputeHomeProjectorCache()` run inside the same `try` as the `updateDoc` that saves the score. If recalculation throws, the catch shows "Failed to save score" even though the game was already written — the admin thinks the save failed.

- [ ] **Step 1: Replace `handleSaveScore` body**

Replace the entire `handleSaveScore` function (lines ~1307–1385) with this version. It saves the score first; post-save side-effects (recalculation, audit) are each wrapped so they cannot turn a successful save into a reported failure:

```ts
  const handleSaveScore = async () => {
    if (!scoreEntryGame) return;

    const homeScore = parseInt(scoreForm.homeScore);
    const awayScore = parseInt(scoreForm.awayScore);

    if (isNaN(homeScore) || isNaN(awayScore)) {
      setStatusMessage({ type: "error", message: "Please enter valid scores" });
      return;
    }

    if (homeScore === awayScore) {
      setStatusMessage({
        type: "error",
        message: language === "fr" ? "Le score final ne peut pas être à égalité" : "Final score cannot be tied",
      });
      return;
    }

    setSavingScoreMode("complete");

    const winnerId = homeScore > awayScore ? scoreEntryGame.homeTeamId : scoreEntryGame.awayTeamId;
    const loserId = winnerId === scoreEntryGame.homeTeamId ? scoreEntryGame.awayTeamId : scoreEntryGame.homeTeamId;
    const winnerScore = winnerId === scoreEntryGame.homeTeamId ? homeScore : awayScore;
    const loserScore = winnerId === scoreEntryGame.homeTeamId ? awayScore : homeScore;

    // 1. Save the score. A failure HERE is a real save failure.
    try {
      await updateDoc(doc(firebaseDB, "games", scoreEntryGame.id), {
        homeScore,
        awayScore,
        winnerId,
        winnerTeamId: winnerId,
        loserTeamId: loserId,
        winnerScore,
        loserScore,
        completed: true,
        status: "completed",
        archived: true,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        archivedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error saving score:", error);
      setStatusMessage({ type: "error", message: "Failed to save score" });
      setSavingScoreMode(null);
      return;
    }

    // 2. Post-save side-effects. Failures here must NOT report the save as failed.
    try {
      await Promise.all([recalculateLeagueStatsFromGames(), recomputeHomeProjectorCache()]);
    } catch (recalcError) {
      console.error("Score saved but stats recalculation failed:", recalcError);
    }

    const winnerName = winnerId === scoreEntryGame.homeTeamId ? scoreEntryGame.homeTeamName : scoreEntryGame.awayTeamName;
    const loserName = winnerId === scoreEntryGame.homeTeamId ? scoreEntryGame.awayTeamName : scoreEntryGame.homeTeamName;
    try {
      await logAuditAction(
        "game_stats_updated",
        currentAdminUser?.id || "unknown",
        currentAdminUser?.email || "unknown",
        "game",
        scoreEntryGame.id,
        `${scoreEntryGame.homeTeamName} vs ${scoreEntryGame.awayTeamName}`,
        {
          homeTeam: scoreEntryGame.homeTeamName,
          awayTeam: scoreEntryGame.awayTeamName,
          homeScore,
          awayScore,
          winner: winnerName,
          loser: loserName,
          gameDate: scoreEntryGame.date,
        },
      );
    } catch (auditError) {
      console.error("Score saved but audit log failed:", auditError);
    }

    setScoreEntryGame(null);
    setScoreForm({ homeScore: "", awayScore: "" });
    setStatusMessage({ type: "success", message: "Score saved and game archived" });
    setSavingScoreMode(null);
  };
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run build` then `npm run lint`
Expected: no new errors. (No new imports needed — `updateDoc`, `serverTimestamp`, `recalculateLeagueStatsFromGames`, `recomputeHomeProjectorCache`, `logAuditAction` were already used by the original function.)

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open `/admin/games`. Open the score-entry dialog for a game, enter a valid non-tied final score, click save (the "complete/final" save). Confirm:
- Success message "Score saved and game archived" appears, dialog closes.
- Reload the page — the game shows as completed with the saved score.
- Standings/public game view reflect the result.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/(dashboard)/games/page.tsx"
git commit -m "fix: don't report final-score save as failed when post-save recalc throws"
```

---

## Task 6: Mobile responsiveness + final verification pass

**Files:**
- Possibly modify: `src/app/admin/(dashboard)/allstar/page.tsx`, `src/app/vote/page.tsx` (only if a real overflow is found)

- [ ] **Step 1: Check the new admin UI at phone width**

Run: `npm run dev`. In the browser devtools, set viewport to 375px wide. Open `/admin/allstar`:
- Eligibility team pills wrap (they use `flex flex-wrap`) — confirm no horizontal scroll.
- Checkbox list collapses to a single column (`grid-cols-1 sm:grid-cols-2`) — confirm.
- Save bar wraps (`flex-wrap`) and the Save button stays fully visible.
- If any element overflows the viewport, fix it with Tailwind responsive utilities (`min-w-0`, `truncate`, `flex-wrap`, `w-full`) and note the change.

- [ ] **Step 2: Check the vote page at phone width**

At 375px, open `/vote`:
- Search dropdown rows: the "Non-eligible" tag must not push the layout (it uses `shrink-0 whitespace-nowrap`); the player name truncates (`truncate min-w-0`). Confirm no overflow.

- [ ] **Step 3: Full lint + build gate**

Run: `npm run lint` then `npm run build`
Expected: clean build, no errors.

- [ ] **Step 4: End-to-end smoke (both languages)**

1. Admin: mark 9 of 12 players on a team eligible, Save.
2. Vote page: those 9 selectable, other 3 greyed + tagged. Switch FR/EN — tag + all copy localized.
3. Cast a vote with eligible players → submits, redirects to results.
4. Admin games: save a final score → persists.

- [ ] **Step 5: Commit any responsiveness fixes**

```bash
git add -A
git commit -m "fix: mobile responsiveness for All-Star eligibility UI"
```

(If Step 1–2 found nothing to change, skip the commit.)

---

## Self-Review Coverage Map

- Spec §Data Model → Task 1 (loader) + Task 3 Step 3 (admin reads `{teams}`) + Task 4 save (`{ teams: { [teamId]: ids } }` merge).
- Spec §Component 1 (loader) → Task 1.
- Spec §Component 2 (admin section) → Tasks 3 & 4.
- Spec §Component 3 (vote page) → Task 2.
- Spec §Component 3 failure handling (suppress tag while `null`) → Task 2 Step 6 (`eligibleIds !== null` gate).
- Spec §Component 4.1 (final-score save) → Task 5.
- Spec §Component 4.2 (mobile) → Task 6.
- Spec §Testing → manual verification steps in Tasks 2, 4, 5, 6 (no test framework in repo).
