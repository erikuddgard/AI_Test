import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import handler from "../api/index.ts";

test("Vercel rewrites are handled and missing shared database returns a clear 503", async () => {
  const previousUrl = process.env.SUPABASE_URL,
    previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const server = createServer((req, res) => {
    void handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/index?route=leagues`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Vercel test" }),
      },
    );
    assert.equal(response.status, 503);
    const data = await response.json();
    assert.match(data.error, /SUPABASE_URL/);
    assert.match(data.error, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const missing = await fetch(`http://127.0.0.1:${port}/not-an-api-route`);
    assert.equal(missing.status, 404);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});

test("Vercel adapter forwards nested quiz routes to the protected shared API", async () => {
  const originalFetch = globalThis.fetch;
  const previousUrl = process.env.SUPABASE_URL,
    previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://adapter-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_adapter_test_fixture";
  const rows = new Map<string, any>();
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== "https://adapter-test.supabase.co")
      return originalFetch(input, init);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("apikey"), "sb_secret_adapter_test_fixture");
    assert.equal(headers.has("authorization"), false);
    const id = url.searchParams.get("id")?.replace(/^eq\./, "") || "";
    if (init?.method === "POST") {
      const row = JSON.parse(String(init.body));
      rows.set(row.id, row);
      return Response.json([structuredClone(row)], { status: 201 });
    }
    const row = rows.get(id);
    if (init?.method === "PATCH") {
      const revision = Number(
        url.searchParams.get("revision")?.replace(/^eq\./, ""),
      );
      if (!row || row.revision !== revision) return Response.json([]);
      Object.assign(row, JSON.parse(String(init.body)));
    }
    return Response.json(row ? [structuredClone(row)] : []);
  };
  const server = createServer((req, res) => {
    void handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const call = (
    route: string,
    method = "GET",
    body?: unknown,
    token?: string,
  ) =>
    originalFetch(
      `http://127.0.0.1:${port}/api/index?route=${encodeURIComponent(route)}`,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
  try {
    const created = await call("leagues", "POST", {
      title: "Vercel adapter league",
    });
    assert.equal(created.status, 201);
    const { league, adminToken } = await created.json();
    const quiz = {
      title: "Quiz",
      date: "2026-10-09",
      entries: [
        { name: "Åsa", rank: 1 },
        { name: "Bo", rank: 2 },
      ],
    };
    const nestedRoute = `leagues/${league.id}/quizzes`;
    assert.equal((await call(nestedRoute, "POST", quiz)).status, 403);
    const saved = await call(nestedRoute, "POST", quiz, adminToken);
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).quizzes.length, 1);
    const shared = await call(`leagues/${league.id}`);
    assert.equal(shared.status, 200);
    assert.equal((await shared.json()).participants.length, 2);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    globalThis.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});
