import { build, emptyDir } from "https://deno.land/x/dnt@0.40.0/mod.ts";
import pkgJson from "../package.json" with { type: "json" };

const outDir = "./build/npm";
await emptyDir(outDir);

await build({
  entryPoints: ["./main.ts"],
  outDir,
  shims: {
    deno: false,
  },
  test: false,
  typeCheck: false,
  compilerOptions: {
    lib: ["ESNext", "DOM"],
    target: "ES2020",
    sourceMap: true,
  },
  package: {
    name: pkgJson.name,
    version: pkgJson.version,
    license: pkgJson.license,
    author: pkgJson.author,
    repository: pkgJson.repository,
    bugs: pkgJson.bugs,
    engines: {
      node: ">= 16",
    },
    sideEffects: false,
  },
});

await Deno.copyFile("README.md", `${outDir}/README.md`);
