import { createRequire } from "node:module";
import { mkdir, copyFile, readdir, chmod } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const tesseractPackage = require.resolve("tesseract.js/package.json");
const corePackage = createRequire(tesseractPackage).resolve(
  "tesseract.js-core/package.json",
);
const target = fileURLToPath(new URL("../public/ocr/", import.meta.url));
await mkdir(path.join(target, "core"), { recursive: true });
await mkdir(path.join(target, "lang"), { recursive: true });
async function copy(source, destination) {
  await copyFile(source, destination);
  await chmod(destination, 0o644);
}
await copy(
  path.join(path.dirname(tesseractPackage), "dist/worker.min.js"),
  path.join(target, "worker.min.js"),
);
await copy(
  path.join(path.dirname(tesseractPackage), "dist/worker.min.js.LICENSE.txt"),
  path.join(target, "worker.LICENSE.txt"),
);
const coreDir = path.dirname(corePackage);
for (const file of await readdir(coreDir)) {
  if (/^tesseract-core.*\.wasm(?:\.js)?$/.test(file))
    await copy(path.join(coreDir, file), path.join(target, "core", file));
}
await copy(path.join(coreDir, "LICENSE"), path.join(target, "core/LICENSE"));
for (const language of ["eng", "swe"]) {
  const packageDir = path.dirname(
    require.resolve(`@tesseract.js-data/${language}/package.json`),
  );
  await copy(
    path.join(packageDir, "4.0.0_best_int", `${language}.traineddata.gz`),
    path.join(target, "lang", `${language}.traineddata.gz`),
  );
}
console.log("Self-hosted browser OCR assets prepared (English + Swedish).");
