import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";

await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/content/index.js"],
  outfile: "dist/content.js",
  bundle: true,
  target: "chrome120",
  format: "iife",
});
await build({
  entryPoints: { background: "src/background/index.js", popup: "src/popup.js" },
  outdir: "dist",
  bundle: true,
  target: "chrome120",
  format: "esm",
});
await Promise.all(["manifest.json", "popup.html", "popup.css", "tags.css"].map(
  (name) => copyFile(name === "manifest.json" ? name : `public/${name}`, `dist/${name}`),
));
console.log("Load extension/dist as an unpacked extension in Chrome.");
