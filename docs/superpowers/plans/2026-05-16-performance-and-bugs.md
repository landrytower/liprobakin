# Performance & Bug Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix page load performance (image optimization, artificial delays, full DB scans) and correct team/player data display bugs.

**Architecture:** Targeted, surgical fixes across next.config.ts, team page, and image proxy. No refactors — only what directly impacts load time and correctness.

**Tech Stack:** Next.js 16, Firebase Firestore, Tailwind CSS, TypeScript

---

### Task 1: Re-enable Next.js image optimization + fix CDN cache headers

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Update next.config.ts**

Replace the current content with:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  reactCompiler: true,
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.liprobakin.com",
      },
      {
        protocol: "https",
        hostname: "*.vercel.app",
      },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
  },
  trailingSlash: false,
  generateEtags: true,
  compress: true,
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: '/',
        destination: '/home',
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      {
        source: '/logos/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        source: '/players/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2: Commit**

```bash
git add next.config.ts
git commit -m "perf: re-enable Next.js image optimization with Firebase domains + 24h logo cache"
```

---

### Task 2: Remove artificial 1.3-second loading delay on team page

**Files:**
- Modify: `src/app/team/[teamName]/page.tsx:454-460`

The code artificially waits 1.3 seconds minimum on every team page load. Remove it.

- [ ] **Step 1: Remove the artificial delay**

Find this block (lines ~454-460):

```typescript
        if (entryLoaderStartRef.current) {
          const elapsed = Date.now() - entryLoaderStartRef.current;
          const remaining = Math.max(0, 1300 - elapsed);
          if (remaining > 0) {
            await new Promise((resolve) => setTimeout(resolve, remaining));
          }
        }
```

Replace with nothing (delete entirely). The lines immediately after should be:

```typescript
        setLoading(false);
        setTimeout(() => setIsTransitioning(false), 100);
```

- [ ] **Step 2: Commit**

```bash
git add src/app/team/[teamName]/page.tsx
git commit -m "perf: remove artificial 1.3s minimum loading delay on team page"
```

---

### Task 3: Remove full games collection scan on team page load

**Files:**
- Modify: `src/app/team/[teamName]/page.tsx:338-367`

Currently fetches ALL games from Firestore to calculate wins/losses — a full table scan on every team page load. The team document already stores `wins` and `losses`. Remove the scan and use stored values.

- [ ] **Step 1: Remove the games scan block**

Find this block (lines ~338-367):

```typescript
        // Calculate wins/losses from games
        const gamesRef = collection(firebaseDB, "games");
        const gamesSnapshot = await getDocs(gamesRef);
        
        let wins = 0;
        let losses = 0;
        
        gamesSnapshot.docs.forEach((gameDoc) => {
          const game = gameDoc.data();
          if (game.winnerTeamId === foundTeamId) {
            wins++;
          } else if (game.loserTeamId === foundTeamId) {
            losses++;
          }
        });
        
        const updatedTeam: TeamData = {
          id: foundTeam.id,
          name: foundTeam.name,
          city: foundTeam.city,
          logo: foundTeam.logo,
          teamPhoto: foundTeam.teamPhoto,
          teamPhotoPosition: foundTeam.teamPhotoPosition,
          colors: foundTeam.colors,
          conference: foundTeam.conference,
          nationality: foundTeam.nationality,
          nationality2: foundTeam.nationality2,
          wins,
          losses,
        };
        
        setTeamData(updatedTeam);
```

Replace with just:

```typescript
        setTeamData(foundTeam);
```

- [ ] **Step 2: Commit**

```bash
git add src/app/team/[teamName]/page.tsx
git commit -m "perf: remove full games collection scan on team page — use stored wins/losses"
```

---

### Task 4: Fix jersey number display bug on team page (shows index instead of #)

**Files:**
- Modify: `src/app/team/[teamName]/page.tsx:928` and `src/app/team/[teamName]/page.tsx:964`

Two places show `#{index}` (the loop index 0, 1, 2…) instead of the player's actual jersey number.

- [ ] **Step 1: Fix hover overlay jersey number (line ~928)**

Find:
```tsx
                      <span className="text-xl font-bold text-white mb-0.5 transform -translate-y-2 group-hover:translate-y-0 transition-transform duration-300 delay-75">#{index}</span>
```

Replace with:
```tsx
                      <span className="text-xl font-bold text-white mb-0.5 transform -translate-y-2 group-hover:translate-y-0 transition-transform duration-300 delay-75">#{player.jerseyNumber ?? player.number}</span>
```

- [ ] **Step 2: Fix default view jersey number (line ~964)**

Find:
```tsx
                          <span className="text-xl font-bold text-blue-400 block">#{index}</span>
```

Replace with:
```tsx
                          <span className="text-xl font-bold text-blue-400 block">#{player.jerseyNumber ?? player.number}</span>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/team/[teamName]/page.tsx
git commit -m "fix: show actual player jersey number instead of loop index on team page"
```

---

### Task 5: Extend image proxy cache from 5 minutes to 1 hour

**Files:**
- Modify: `src/app/api/image-proxy/route.ts:54,69-70`

Cache-control is set to 5 minutes (300s). Player headshots and team logos from Firebase Storage rarely change — extend to 1 hour to reduce repeat fetches.

- [ ] **Step 1: Update revalidate and cache-control headers**

Find:
```typescript
    const upstreamResponse = await fetch(parsedUrl.toString(), {
      cache: "force-cache",
      next: { revalidate: 300 },
      headers: { Accept: "image/*,*/*;q=0.8" },
    });
```

Replace with:
```typescript
    const upstreamResponse = await fetch(parsedUrl.toString(), {
      cache: "force-cache",
      next: { revalidate: 3600 },
      headers: { Accept: "image/*,*/*;q=0.8" },
    });
```

Find:
```typescript
        "Cache-Control": "public, max-age=300, s-maxage=300",
```

Replace with:
```typescript
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/image-proxy/route.ts
git commit -m "perf: extend image proxy cache from 5 min to 1h client / 24h CDN"
```

---

### Task 6: Remove console.log noise from team page

**Files:**
- Modify: `src/app/team/[teamName]/page.tsx`

Multiple `console.log` calls fire on every page load (team name, index, navigation, staff data). Remove them to keep production logs clean and avoid minor V8 overhead.

- [ ] **Step 1: Remove all console.log calls in fetchTeamData**

Remove these lines:
```typescript
        console.log('🏀 Current team:', currentFullName);
        console.log('🏀 Current index:', currentIndex);
        console.log('🏀 Total teams:', allTeamsList.length);
```
```typescript
          console.log('🏀 Previous:', allTeamsList[prevIndex].fullName, '| Current:', currentFullName, '| Next:', allTeamsList[nextIndex].fullName);
```
```typescript
          console.log('🏀 Navigation disabled (only one team or team not found)');
```
```typescript
        console.log("Staff snapshot size:", staffSnapshot.size);
```
```typescript
          console.log("Staff member data:", data);
```
```typescript
        console.log("Staff data to set:", staffData);
```

- [ ] **Step 2: Commit**

```bash
git add src/app/team/[teamName]/page.tsx
git commit -m "chore: remove console.log noise from team page"
```
