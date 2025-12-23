# Firebase Deployment Guide

## The Problem
Your Next.js app has dynamic routes that don't work on Firebase Hosting because Firebase is serving static files.

## Solutions

### ✅ Recommended: Deploy to Vercel
Vercel is built for Next.js and handles all routing automatically:

```bash
npm i -g vercel
vercel
```

### Alternative: Use Vercel (via vercel.json already configured)
Your `vercel.json` is already set up. Just run:

```bash
vercel --prod
```

### Current Setup
Your Firebase is currently hosting the static HTML in `public/hosted/index.html` which won't work with Next.js routing.

## Why Routing Fails on Firebase
- Firebase Hosting serves static files
- Next.js dynamic routes like `/team/[teamName]` need server-side handling
- API routes in `/api/*` won't work on static hosting
- Client-side navigation breaks on page refresh

## Quick Fix
Deploy to Vercel - it's free and built for Next.js.
