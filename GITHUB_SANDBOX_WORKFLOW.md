# GitHub Sandbox Deployment Workflow

This repo now includes a GitHub Action at:

- `.github/workflows/sandbox-deploy.yml`

It runs on:

- Push to branch `sandbox`
- Manual trigger (`workflow_dispatch`)

## What it does

1. Pulls Vercel `preview` environment settings.
2. Builds with `vercel build`.
3. Deploys a preview with `vercel deploy --prebuilt`.
4. Optionally aliases to a custom domain (example: `sandbox.liprobakin.com`).

## Required GitHub Secrets

In GitHub → Settings → Secrets and variables → Actions, add:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Optional:

- `VERCEL_SANDBOX_DOMAIN` (e.g. `sandbox.liprobakin.com`)

## Required Vercel Preview Environment Variables (Sandbox Firebase)

In Vercel project settings, under **Preview** environment, set these values from your sandbox Firebase project:

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

## Usage

- Work on `sandbox` branch.
- Push changes to `sandbox`.
- GitHub Action deploys automatically.
- Use preview URL or `https://sandbox.liprobakin.com` if alias is configured.

Production (`master` / live domain) remains unchanged.
