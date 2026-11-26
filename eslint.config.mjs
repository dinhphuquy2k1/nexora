import domainVocabulary from "./scripts/eslint-rules/no-domain-vocabulary-literals.mjs";
import noUnsafeRawSql from "./scripts/eslint-rules/no-unsafe-raw-sql.mjs";
import readableRawSql from "./scripts/eslint-rules/readable-raw-sql.mjs";
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
    plugins: {
      nexora: {
        rules: {
          "no-domain-vocabulary-literals": domainVocabulary,
          "no-unsafe-raw-sql": noUnsafeRawSql,
          "readable-raw-sql": readableRawSql,
        },
      },
    },
  },
  {
    files: ["apps/api/src/{identity,carrier,customer,shipment}/**/*.ts"],
    ignores: [
      "**/test/**",
      "**/tests/**",
      "**/__tests__/**",
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/*.d.ts",
    ],
    rules: { "nexora/no-domain-vocabulary-literals": "error" },
  },
  {
    files: [
      "apps/*/src/**/*.{ts,tsx,js,mjs,cjs}",
      "packages/*/src/**/*.{ts,tsx,js,mjs,cjs}",
    ],
    ignores: [
      "**/test/**",
      "**/tests/**",
      "**/__tests__/**",
      "**/*.test.*",
      "**/*.spec.*",
      "**/*.d.ts",
    ],
    rules: {
      "nexora/no-unsafe-raw-sql": "error",
      "nexora/readable-raw-sql": "error",
    },
  },
  {
    files: ["apps/api/src/{customer,shipment}/**/*.ts"],
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
