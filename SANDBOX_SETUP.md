# Sandbox Setup (No Impact on Live)

This project now supports environment-based Firebase targeting.

## What is already done

- Git branch `sandbox` has been created.
- Client Firebase config in `src/lib/firebase.ts` now reads `NEXT_PUBLIC_FIREBASE_*` values.
- Article metadata fetch in `src/app/page.tsx` now uses `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.

## Important

A Git branch alone does **not** isolate database writes.
To prevent sandbox actions (like scheduling games) from touching live data, your sandbox deployment must use a different Firebase project.

## Required environment variables for sandbox deployment

Set these in Vercel for the `Preview` environment (or in local `.env.local` while testing sandbox):

- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Use values from your **sandbox Firebase project**, not `ppop-35930`.

## Safe workflow

1. Work on branch `sandbox`.
2. Push `sandbox` branch and open the Vercel preview URL.
3. Confirm preview is using sandbox Firebase env vars.
4. Do tests (create games, edit records, etc.) only on preview/local sandbox.
5. Keep production env vars unchanged for `master`/production.

## Optional extra safety

In Firebase Rules for production, restrict write access more tightly (admin-only), and keep a separate rules set for sandbox.
