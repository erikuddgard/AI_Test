import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleApi } from "./api.ts";
const dist = path.resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  try {
    if (await handleApi(req, res)) return;
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end();
      return;
    }
    const pathname = decodeURIComponent(
      new URL(req.url || "/", "http://localhost").pathname,
    );
    const file = path.resolve(dist, `.${pathname}`);
    if (file !== dist && !file.startsWith(`${dist}${path.sep}`)) {
      res.writeHead(403);
      res.end();
      return;
    }
    let target = file;
    try {
      if (!(await stat(target)).isFile())
        target = path.join(dist, "index.html");
    } catch {
      if (path.extname(pathname)) {
        res.writeHead(404);
        res.end();
        return;
      }
      target = path.join(dist, "index.html");
    }
    const data = await readFile(target);
    res.writeHead(200, {
      "Content-Type": mime[path.extname(target)] || "application/octet-stream",
      "Cache-Control": target.includes(`${path.sep}assets${path.sep}`)
        ? "public, max-age=31536000, immutable"
        : "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    if (!res.headersSent) res.writeHead(500);
    res.end("Servern kunde inte svara.");
  }
});
server.listen(Number(process.env.PORT || 8443), "0.0.0.0", () =>
  console.log("Quizligan server started."),
);
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    server.close();
    setTimeout(() => process.exit(0), 5000).unref();
  });
