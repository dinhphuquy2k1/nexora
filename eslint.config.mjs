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
      "apps/web/next-env.d.ts",
    ],
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
