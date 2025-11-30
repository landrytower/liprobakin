npm run build
npx firebase deploy --only hosting --project ppop-35930


# Febaco League

Febaco is a custom React/Next.js experience inspired by the NBA G League website. It highlights the essentials of a developmental basketball league—Players, Games, Schedule, News, Stats, Standings, and Teams—using bold typography, glassmorphism cards, and responsive Tailwind CSS layouts.

## Features

- Hero headline that mirrors the G League splash with schedule callouts and live data pulse cards.
- Sticky navigation with anchors for Players, Games, Schedule, News, Stats, Standings, and Teams.
- Scoreboard, schedule rail, player spotlights, and news grid powered by structured mock data (`src/data/febaco.ts`).
- Stats dashboard, standings table, and franchise grid to showcase league depth.
- Fully responsive design using the App Router, TypeScript, and Tailwind CSS v4 utilities.

## Tech Stack

- Next.js 16 (App Router + React 19)
- TypeScript
- Tailwind CSS v4
- ESLint

## Local Development

```bash
npm install          # install dependencies
npm run dev          # start the development server on http://localhost:3000
npm run lint         # run ESLint against the project
npm run build        # create an optimized production build
```

## Project Structure

- `src/app/page.tsx` – main Febaco landing page with every section composed in a single layout.
- `src/app/globals.css` – global theming (dark gradient background, font stack, etc.).
- `src/data/febaco.ts` – mock data for games, players, schedule, stats, standings, and franchises.

## Customization

Edit the constants in `src/data/febaco.ts` to plug in live data feeds or CMS hooks, and adjust the Tailwind classes in `src/app/page.tsx` to match updated branding (colors, typography, or layout tweaks).*** End Patch
