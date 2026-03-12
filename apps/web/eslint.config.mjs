import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Phase 3: API route에서 repo 직접 import 금지 (Phase 4+ service 경유 필수)
  {
    files: ["app/api/admin/**/*.ts"],
    rules: {
      "no-restricted-imports": ["warn", {
        patterns: [{
          group: ["**/db/repositories/*", "@/lib/db/repositories/*"],
          message: "API route에서 repo 직접 import 금지. service 경유 필수 (Phase 4+)",
        }],
      }],
    },
  },
]);

export default eslintConfig;
