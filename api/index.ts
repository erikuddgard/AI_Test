import type { IncomingMessage, ServerResponse } from "node:http";
import { handleApi } from "../server/api.ts";

// Vercel's rewrite carries the original API path without exposing storage credentials.
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  const incoming = new URL(req.url || "/", "http://localhost");
  const route = incoming.searchParams.get("route");
  if (route !== null) req.url = `/api/${route.replace(/^\/+/, "")}`;
  try {
    if (await handleApi(req, res, { serverless: true })) return;
    res.writeHead(404, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify({ error: "Sidan hittades inte." }));
  } catch {
    if (!res.headersSent)
      res.writeHead(500, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
    res.end(
      JSON.stringify({ error: "Servern kunde inte svara. Försök igen." }),
    );
  }
}
