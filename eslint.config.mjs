import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["src/components/LivePinnedScore.tsx", "src/app/game/[gameId]/page.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["src/hooks/useDocumentPiP.ts"],
    rules: {
      "react-hooks/refs": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "**/.next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",

    // Generated / deployment artifacts:
    ".firebase/**",
    ".vercel/**",
    "mobile/**",
    "grant-league-permissions.js",
    "reset-team-records.js",
  ]),
]);

export default eslintConfig;
