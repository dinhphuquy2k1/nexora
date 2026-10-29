// Compile actual feature TSX/CSS with pinned existing tooling; no product route/flag.
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(root, "apps/web/package.json"));
const { webpack, NormalModule } = require("next/dist/compiled/webpack/webpack");
const output = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(root, "artifacts/retail-fixture");
await mkdir(output, { recursive: true });
const compiler = webpack({
  plugins: [
    {
      apply(compiler) {
        compiler.hooks.compilation.tap("RetailFixtureTrace", (compilation) =>
          NormalModule.getCompilationHooks(compilation).loader.tap(
            "RetailFixtureTrace",
            (context) => {
              context.currentTraceSpan =
                require("next/dist/trace").trace("retail-fixture-css");
            },
          ),
        );
      },
    },
  ],
  mode: "development",
  devtool: false,
  cache: false,
  context: root,
  entry: resolve(root, "apps/web/test/fixtures/retail-entry.tsx"),
  output: { path: output, filename: "bundle.js" },
  resolve: {
    extensions: [".tsx", ".ts", ".mjs", ".js", ".json"],
    alias: {
      "@nexora/ui": resolve(root, "packages/ui/src/index.tsx"),
      "@nexora/shared/validation": resolve(
        root,
        "packages/shared/src/validation/index.ts",
      ),
      react: dirname(require.resolve("react/package.json")),
      "react-dom": dirname(require.resolve("react-dom/package.json")),
    },
    modules: [resolve(root, "apps/web/node_modules"), "node_modules"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: resolve(root, "scripts/fixtures/retail/typescript-loader.cjs"),
      },
      {
        test: /\.css$/,
        use: [
          resolve(root, "scripts/fixtures/retail/style-loader.cjs"),
          {
            loader: require.resolve(
              "next/dist/build/webpack/loaders/css-loader/src/index.js",
            ),
            options: {
              postcss: async () => ({
                postcss: createRequire(require.resolve("next/package.json"))(
                  "postcss",
                ),
              }),
              esModule: true,
              modules: {
                auto: /\.module\.css$/,
                exportLocalsConvention: "asIs",
                getLocalIdent:
                  require("next/dist/build/webpack/config/blocks/css/loaders/getCssModuleLocalIdent")
                    .getCssModuleLocalIdent,
              },
            },
          },
        ],
      },
    ],
  },
  optimization: { minimize: false },
});
try {
  await new Promise((yes, no) =>
    compiler.run((error, stats) => {
      if (error) return no(error);
      if (stats.hasErrors())
        return no(
          Error(
            stats.toString({ all: false, errors: true, errorDetails: true }),
          ),
        );
      yes();
    }),
  );
} finally {
  await new Promise((r) => compiler.close(r));
}
await writeFile(
  resolve(output, "index.html"),
  '<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Retail UI test fixture</title><style>@font-face{font-family:Inter;src:url(/inter.woff2)}:root{--font-inter:Inter}body{font-family:Inter,sans-serif;margin:0;padding:16px}*{box-sizing:border-box}#fixture-root{min-width:0}</style><div id="fixture-root"></div><script src="/bundle.js"></script></html>',
);
console.log("Actual Retail fixture TSX/CSS bundle built (test-only)");
