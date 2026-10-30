import domainVocabulary from "./scripts/eslint-rules/no-domain-vocabulary-literals.mjs";
import js from "@eslint/js";
import ts from "typescript-eslint";
export default ts.config(
  {
    ignores: [
      "**/dist/**",
      "**/.contracts/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/generated/**",
      "artifacts/**",
      "apps/web/next-env.d.ts",
    ],
  },
  {
    files: ["apps/api/src/{identity,carrier,customer}/**/*.ts"],
    ignores: [
      "**/test/**",
      "**/tests/**",
      "**/__tests__/**",
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/*.d.ts",
    ],
    plugins: {
      nexora: { rules: { "no-domain-vocabulary-literals": domainVocabulary } },
    },
    rules: { "nexora/no-domain-vocabulary-literals": "error" },
  },
  {
    files: ["apps/api/src/customer/**/*.ts"],
    rules: { "no-nested-ternary": "error" },
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["**/*.{mjs,cjs}"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        require: "readonly",
        module: "readonly",
        __dirname: "readonly",
        URL: "readonly",
        AbortSignal: "readonly",
      },
    },
  },
  {
    files: ["**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
