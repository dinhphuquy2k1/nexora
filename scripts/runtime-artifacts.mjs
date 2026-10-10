// Copy the installed, frozen graph; never resolve versions or download packages.
import {
  cp,
  mkdir,
  readFile,
  readdir,
  realpath,
  symlink,
  lstat,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, dirname, relative, join } from "node:path";
import { createHash } from "node:crypto";
const [sourceArg, destArg, mode] = process.argv.slice(2);
if (!sourceArg || !destArg)
  throw Error("Usage: node runtime-artifacts.mjs SOURCE DEST [tooling]");
const source = await realpath(sourceArg),
  dest = resolve(destArg),
  seen = new Map();
if (dest === source || dest.startsWith(source + "/"))
  throw Error("Output must be outside source");
await mkdir(dest, { recursive: true });
if ((await readdir(dest)).length) throw Error("Output must be empty");
async function manifestAt(dir) {
  return JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
}
async function findPackage(parent, name) {
  let cursor = parent;
  while (true) {
    const candidate = join(cursor, "node_modules", name);
    try {
      await lstat(join(candidate, "package.json"));
      return await realpath(candidate);
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    const next = dirname(cursor);
    if (next === cursor) throw Error("Missing installed dependency " + name);
    cursor = next;
  }
}
async function copyContents(src, out, isRoot) {
  const workspace =
    src.startsWith(resolve("apps") + "/") ||
    src.startsWith(resolve("packages") + "/");
  const allow = new Set([
    "package.json",
    "dist",
    "prisma",
    "prisma.config.ts",
    "src",
    "next.config.ts",
    ".next",
    "public",
  ]);
  if (workspace && src.includes("/apps/api")) allow.delete("src");
  if (workspace && src.includes("/packages/database")) allow.delete("src");
  if (workspace && src.includes("/packages/shared")) allow.delete("src");
  await mkdir(out, { recursive: true });
  for (const entry of await readdir(src, { withFileTypes: true })) {
    if (entry.name === "node_modules" || (workspace && !allow.has(entry.name)))
      continue;
    if (!isRoot && entry.name === ".next") continue;
    await cp(join(src, entry.name), join(out, entry.name), {
      recursive: true,
      dereference: false,
    });
  }
  if (workspace && src.includes("/apps/api")) {
    const { rm } = await import("node:fs/promises");
    for (const p of ["openapi.js", "openapi.js.map", "openapi.d.ts"])
      await rm(join(out, "dist", p), { force: true });
  }
}
async function visit(src, isRoot = false) {
  if (seen.has(src)) return seen.get(src);
  const manifest = await manifestAt(src);
  const id = createHash("sha256")
    .update(relative(process.cwd(), src))
    .digest("hex")
    .slice(0, 16);
  const out = isRoot ? dest : join(dest, "node_modules", ".nexora", id);
  seen.set(src, out);
  await copyContents(src, out, isRoot);
  const deps = {
    ...manifest.dependencies,
    ...manifest.optionalDependencies,
    ...manifest.peerDependencies,
    ...(isRoot && mode === "tooling" ? manifest.devDependencies : {}),
  };
  for (const name of Object.keys(deps)) {
    const optional =
      Object.hasOwn(manifest.optionalDependencies ?? {}, name) ||
      manifest.peerDependenciesMeta?.[name]?.optional;
    // Optional peers are not runtime requirements; explicit dependencies still win.
    if (
      manifest.peerDependenciesMeta?.[name]?.optional &&
      !Object.hasOwn(manifest.dependencies ?? {}, name)
    )
      continue;
    let target;
    try {
      target = await findPackage(src, name);
    } catch (error) {
      if (optional) continue;
      throw error;
    }
    const copied = await visit(target),
      link = join(out, "node_modules", name);
    await mkdir(dirname(link), { recursive: true });
    await symlink(relative(dirname(link), copied), link, "dir");
  }
  // Prisma's generated client is not an npm dependency: preserve its actual installed output.
  if (manifest.name === "@prisma/client") {
    const req = createRequire(join(src, "package.json"));
    const generated = dirname(req.resolve(".prisma/client/default"));
    const self = join(out, "node_modules", "@prisma", "client");
    await mkdir(dirname(self), { recursive: true });
    await symlink(relative(dirname(self), out), self, "dir");
    await cp(generated, join(out, "node_modules", ".prisma", "client"), {
      recursive: true,
    });
  }
  return out;
}
await visit(source, true);
console.log(
  `Frozen ${mode ?? "runtime"} artifacts copied: ${seen.size} installed packages`,
);
