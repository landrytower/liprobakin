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

## Deploy (Vercel)

### Create a Vercel project

- Vercel Dashboard → **New Project** → import this GitHub repo.
- Framework preset: **Next.js**
- Build command: `npm run build`
- Output directory: `.next`

### Environment Variables (required)

This app uses Firebase Admin on the server for admin APIs. In Vercel → Project → **Settings** → **Environment Variables**, add:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`

For `FIREBASE_PRIVATE_KEY`, you can paste the key as multiline OR as a single line with `\n` sequences — the code normalizes both.

### Environment Variables (optional / feature-specific)

- `NEXT_PUBLIC_BASE_URL` (recommended; used for password reset links)
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (contact form email notifications)
- `GROQ_API_KEY` (AI chat endpoint)
- `YOUTUBE_OAUTH_ACCESS_TOKEN` (YouTube live create endpoint)
- `NEXT_PUBLIC_GRAFANA_URL` (admin errors dashboard)

### Firebase console settings

- Firebase Auth → **Settings** → **Authorized domains**: add your Vercel domain (e.g. `your-app.vercel.app`) and any custom domain.

## Deploy (Firebase Hosting)

```bash
npm run build
npx firebase deploy --only hosting --project ppop-35930
```

## Project Structure

- `src/app/page.tsx` – main Febaco landing page with every section composed in a single layout.
- `src/app/globals.css` – global theming (dark gradient background, font stack, etc.).
- `src/data/febaco.ts` – mock data for games, players, schedule, stats, standings, and franchises.

## Customization

Edit the constants in `src/data/febaco.ts` to plug in live data feeds or CMS hooks, and adjust the Tailwind classes in `src/app/page.tsx` to match updated branding (colors, typography, or layout tweaks).
