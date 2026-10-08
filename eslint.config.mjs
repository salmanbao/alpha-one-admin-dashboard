import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

// Monorepo-wide lint rules. Scope is deliberately limited to apps/** so that
// packages/** (shared library code) and tooling files are not affected.
//
// The core rule here is no-restricted-imports: an app must never import from
// another app. Cross-application sharing belongs in @pfaas/ui or
// @pfaas/platform-core; anything app-specific should be duplicated (with a
// TODO comment) rather than coupled.
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/out/**",
      "**/turbo/**",
      "**/coverage/**",
      "packages/**",
      "**/*.d.ts",
    ],
  },
  {
    files: ["apps/**/*.{ts,tsx,js,jsx,mjs}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        console: "readonly",
        window: "readonly",
        document: "readonly",
        process: "readonly",
        localStorage: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        AbortController: "readonly",
        URLSearchParams: "readonly",
        TextEncoder: "readonly",
        queueMicrotask: "readonly",
        React: "readonly",
        NodeJS: "readonly",
      },
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/prop-admin/**",
                "**/prop-admin",
                "**/platform-admin/**",
                "**/platform-admin",
                "**/trader/**",
                "**/trader",
              ],
              message:
                "Cross-app imports are forbidden. Share code via @pfaas/ui or @pfaas/platform-core instead, or duplicate it locally with a TODO comment.",
            },
            {
              group: [
                "@pfaas/prop-admin",
                "@pfaas/prop-admin/**",
                "@pfaas/platform-admin",
                "@pfaas/platform-admin/**",
                "@pfaas/trader",
                "@pfaas/trader/**",
              ],
              message:
                "Cross-app imports are forbidden. Share code via @pfaas/ui or @pfaas/platform-core instead, or duplicate it locally with a TODO comment.",
            },
          ],
        },
      ],
    },
  },
];
