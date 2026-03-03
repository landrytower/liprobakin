import { config } from "dotenv";

config({ path: ".env.local" });

const required = [
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_DATABASE_URL",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
];

const missing = required.filter((key) => !process.env[key] || !String(process.env[key]).trim());

if (missing.length > 0) {
  console.error("Missing sandbox env vars:");
  for (const key of missing) {
    console.error(`- ${key}`);
  }
  console.error("\nCopy .env.sandbox.example to .env.local and fill values from your sandbox Firebase project.");
  process.exit(1);
}

const projectId = String(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "").trim();
const adminProjectId = String(process.env.FIREBASE_PROJECT_ID || "").trim();

if (projectId === "ppop-35930" || adminProjectId === "ppop-35930") {
  console.error("Unsafe configuration: project id still points to production (ppop-35930).");
  console.error("Use your sandbox Firebase project id instead.");
  process.exit(1);
}

if (projectId !== adminProjectId) {
  console.error("Mismatch: NEXT_PUBLIC_FIREBASE_PROJECT_ID and FIREBASE_PROJECT_ID must be the same sandbox project.");
  process.exit(1);
}

console.log("Sandbox env looks good.");
console.log(`Project: ${projectId}`);
