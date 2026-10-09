import { test } from "node:test"
import assert from "node:assert/strict"
import { createHash, randomUUID } from "node:crypto"
import { createServer, type Server } from "node:http"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { League } from "../src/league.ts"
import { handleApi } from "./api.ts"
import {
  createStore,
  StoreError,
  type LeagueStore,
  type StoredLeague,
} from "./store.ts"

const key = "sb_secret_test_server_only"
const env = {
  SUPABASE_URL: "https://league-test.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: key,
  VERCEL: "1",
}
const token = "test-owner-token"
const tokenHash = createHash("sha256").update(token).digest("hex")
type Row = {
  id: string;
  league: League;
  token_hash: string;
  revision: number;
}
type Call = {
  method: string;
  params: URLSearchParams;
  body: any;
}

function mockDatabase() {
  const rows = new Map<string, Row>()
  const calls: Call[] = []
  let beforePatch: ((row: Row, call: Call) => void) | undefined
  const request: typeof fetch = async (input, init) => {
    const url = new URL(String(input))
    assert.equal(url.origin, env.SUPABASE_URL)
    assert.equal(url.pathname, "/rest/v1/quiz_leagues")
    const headers = new Headers(init?.headers)
    assert.equal(headers.get("apikey"), key)
    assert.equal(headers.get("authorization"), null)
    assert.equal(headers.get("prefer"), "return=representation")
    const call = {
      method: init?.method ?? "GET",
      params: url.searchParams,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    }
    calls.push(call)
    if (call.method === "POST") {
      if (rows.has(call.body.id)) return Response.json({}, { status: 409 })
      rows.set(call.body.id, structuredClone(call.body))
      return Response.json([call.body], { status: 201 })
    }
    const id = call.params.get("id")?.replace(/^eq\./, "")
    assert.ok(id)
    const row = rows.get(id)
    if (call.method === "GET") return Response.json(row ? [row] : [])
    assert.equal(call.method, "PATCH")
    if (!row) return Response.json([])
    beforePatch?.(row, call)
    if (`eq.${row.revision}` !== call.params.get("revision"))
      return Response.json([])
    assert.deepEqual(Object.keys(call.body).sort(), ["league", "revision"])
    assert.equal(call.body.revision, row.revision + 1)
    const saved = { ...row, ...structuredClone(call.body) }
    rows.set(id, saved)
    return Response.json([saved])
  }
  return {
    rows,
    calls,
    request,
    onPatch(fn: typeof beforePatch) {
      beforePatch = fn
    },
  }
}

function emptyLeague(): StoredLeague {
  return {
    league: {
      id: randomUUID(),
      title: "Teamet",
      participants: [],
      quizzes: [],
    },
    tokenHash,
    revision: 0,
  }
}
function storeFor(db: ReturnType<typeof mockDatabase>) {
  return createStore({ env, fetch: db.request })
}
async function serve(store?: LeagueStore) {
  const server = createServer((req, res) => {
    void handleApi(req, res, { store, serverless: true })
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  return { server, base }
}
async function close(server: Server) {
  await new Promise<void>((resolve) => server.close(() => resolve()))
}
async function api(
  base: string,
  path: string,
  method = "GET",
  data?: unknown,
  ownerToken?: string,
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(ownerToken ? { Authorization: `Bearer ${ownerToken}` } : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  })
  return { status: response.status, data: await response.json() }
}

test("Serverless storage requires a complete, safe server-side database configuration", () => {
  for (const invalid of [
    { VERCEL: "1" },
    { SUPABASE_URL: env.SUPABASE_URL },
    { SUPABASE_SERVICE_ROLE_KEY: key },
    { ...env, SUPABASE_URL: "not-a-url" },
    { ...env, SUPABASE_URL: "http://league-test.supabase.co" },
    { ...env, SUPABASE_URL: "https://user:secret@league-test.supabase.co" },
    { ...env, SUPABASE_URL: "https://league-test.supabase.co/other" },
    { ...env, SUPABASE_URL: "https://league-test.supabase.co?secret=value" },
    { ...env, SUPABASE_SERVICE_ROLE_KEY: "sb_publishable_browser_key" },
    {
      ...env,
      SUPABASE_SERVICE_ROLE_KEY: `header.${Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url")}.signature`,
    },
  ]) {
    assert.throws(
      () => createStore({ env: invalid }),
      (error: unknown) => error instanceof StoreError && error.status === 503,
    )
  }
  assert.throws(() => createStore({ env: {}, serverless: true }), StoreError)
  assert.doesNotThrow(() => createStore({ env: {} }))
})

test("Legacy service-role JWT keys use Bearer authorization in addition to apikey", async () => {
  const initial = emptyLeague();
  const legacyKey = `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`;
  const store = createStore({
    env: { ...env, SUPABASE_SERVICE_ROLE_KEY: legacyKey },
    fetch: async (_input, init) => {
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("apikey"), legacyKey);
      assert.equal(headers.get("authorization"), `Bearer ${legacyKey}`);
      return Response.json([{
        id: initial.league.id,
        league: initial.league,
        token_hash: tokenHash,
        revision: 0,
      }]);
    },
  });
  assert.equal((await store.load(initial.league.id)).league.id, initial.league.id);
});

test("Vercel pre-parsed JSON bodies accept objects, strings and buffers while enforcing size and shape", async () => {
  const db = mockDatabase();
  const store = storeFor(db);
  const circular: { title: string; self?: unknown } = { title: "Teamet" };
  circular.self = circular;
  const cases = [
    { body: { title: "Objektliga" }, status: 201 },
    { body: JSON.stringify({ title: "Textliga" }), status: 201 },
    { body: Buffer.from(JSON.stringify({ title: "Bufferliga" })), status: 201 },
    { body: { title: "Teamet" }, contentLength: "64001", status: 413 },
    { body: { title: "å".repeat(35_000) }, status: 413 },
    { body: "x".repeat(64_001), status: 413 },
    { body: "invalid-json", status: 400 },
    { body: [], status: 400 },
    { body: null, status: 400 },
    { body: circular, status: 400 },
    { body: undefined, getterThrows: true, status: 400 },
  ];
  const server = createServer((req, res) => {
    const index = Number(new URL(req.url!, "http://localhost").searchParams.get("case"));
    if (cases[index].getterThrows) {
      Object.defineProperty(req, "body", {
        get() {
          throw Object.assign(new Error("Invalid JSON"), { statusCode: 400 });
        },
      });
    } else {
      (req as typeof req & { body: unknown }).body = cases[index].body;
    }
    if (cases[index].contentLength) req.headers["content-length"] = cases[index].contentLength;
    void handleApi(req, res, { store, serverless: true });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    for (let index = 0; index < cases.length; index++) {
      const result = await api(base, `/api/leagues?case=${index}`, "POST");
      assert.equal(result.status, cases[index].status, `body case ${index}`);
    }
    assert.equal(db.rows.size, 3);
  } finally {
    await close(server);
  }
});

test("Supabase CAS preserves both concurrent writes from independent serverless instances", async () => {
  const db = mockDatabase()
  const a = storeFor(db),
    b = storeFor(db)
  const initial = emptyLeague()
  await a.create(initial)
  const attempts = [0, 0]
  await Promise.all(
    [a, b].map((store, index) =>
      store.mutate(initial.league.id, (stored) => {
        attempts[index]++
        stored.league.quizzes.push({
          id: randomUUID(),
          title: `Quiz ${index}`,
          date: "2026-10-09",
          results: [],
        })
        return stored.league
      }),
    ),
  )
  const saved = await a.load(initial.league.id)
  assert.equal(saved.revision, 2)
  assert.equal(saved.league.quizzes.length, 2)
  assert.deepEqual(saved.league.quizzes.map((q) => q.title).sort(), [
    "Quiz 0",
    "Quiz 1",
  ])
  assert.deepEqual(attempts.sort(), [1, 2])
  assert.equal(db.calls.filter((c) => c.method === "PATCH").length, 3)
  assert.equal(saved.tokenHash, tokenHash)
})

test("Supabase conflicts stop after bounded retries, and upstream errors never expose secrets", async () => {
  const db = mockDatabase()
  const store = storeFor(db),
    initial = emptyLeague()
  await store.create(initial)
  db.onPatch((row) => {
    row.revision++
  })
  let attempts = 0
  await assert.rejects(
    store.mutate(initial.league.id, (stored) => {
      attempts++
      return stored.league
    }),
    (error: unknown) => error instanceof StoreError && error.status === 409,
  )
  assert.equal(attempts, 5)
  assert.equal(db.calls.filter((c) => c.method === "PATCH").length, 5)
  const rejected = createStore({
    env,
    fetch: async () =>
      Response.json({ message: `database rejected ${key}` }, { status: 401 }),
  })
  await assert.rejects(
    rejected.load(initial.league.id),
    (error: unknown) =>
      error instanceof StoreError &&
      error.status === 503 &&
      !error.message.includes(key),
  )
  const disconnected = createStore({
    env,
    fetch: async () => {
      throw new Error(key)
    },
  })
  await assert.rejects(
    disconnected.load(initial.league.id),
    (error: unknown) =>
      error instanceof StoreError && !error.message.includes(key),
  )
  const malformed = createStore({
    env,
    fetch: async () => Response.json([{ id: initial.league.id }]),
  })
  await assert.rejects(malformed.load(initial.league.id), StoreError)
})

test("A Vercel request without database configuration fails clearly and never creates local data", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "league-serverless-test-"))
  const names = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "LEAGUE_DATA_DIR",
  ] as const
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  )
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.LEAGUE_DATA_DIR = dir
  const server = await serve()
  try {
    const result = await api(server.base, "/api/leagues", "POST", {
      title: "Teamet",
    })
    assert.equal(result.status, 503)
    assert.match(result.data.error, /SUPABASE_URL/)
    assert.deepEqual(await readdir(dir), [])
  } finally {
    await close(server.server)
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name]
      else process.env[name] = previous[name]
    }
    await rm(dir, { recursive: true, force: true })
  }
})

test("Shared Supabase API reads are public; mutations require the owner token and remain durable across instances", async () => {
  const db = mockDatabase()
  const a = await serve(storeFor(db)),
    b = await serve(storeFor(db))
  try {
    const created = await api(a.base, "/api/leagues", "POST", {
      title: "Delad liga",
    })
    assert.equal(created.status, 201)
    const { league, adminToken } = created.data
    const url = `/api/leagues/${league.id}`
    const quiz = {
      title: "Fredagsquiz",
      date: "2026-10-09",
      entries: [{ name: "Åsa", rank: 1 }],
    }
    assert.equal(
      (await api(a.base, url + "/quizzes", "POST", quiz)).status,
      403,
    )
    assert.equal(
      (await api(a.base, url + "/quizzes", "POST", quiz, "wrong")).status,
      403,
    )
    const concurrent = await Promise.all(
      [a, b].map((server, i) =>
        api(
          server.base,
          url + "/quizzes",
          "POST",
          { ...quiz, title: `Quiz ${i}` },
          adminToken,
        ),
      ),
    )
    assert.ok(concurrent.every((result) => result.status === 200))
    const read = await api(b.base, url)
    assert.equal(read.status, 200)
    assert.equal(read.data.quizzes.length, 2)
    assert.equal(read.data.participants.length, 1)
    assert.equal(read.data.tokenHash, undefined)
    assert.equal(read.data.token_hash, undefined)
    assert.equal(read.data.revision, undefined)
    assert.equal(read.data.adminToken, undefined)
    assert.ok(!JSON.stringify(read.data).includes(key))
    const row = db.rows.get(league.id)!
    assert.equal(row.revision, 2)
    assert.notEqual(row.token_hash, adminToken)
    assert.equal(
      row.token_hash,
      createHash("sha256").update(adminToken).digest("hex"),
    )
    const q = read.data.quizzes[0]
    assert.equal(
      (await api(b.base, url + "/quizzes/" + q.id, "DELETE")).status,
      403,
    )
    const edited = await api(
      a.base,
      url + "/quizzes/" + q.id,
      "PUT",
      { ...quiz, title: "Rättat quiz" },
      adminToken,
    )
    assert.equal(edited.status, 200)
    assert.equal(
      (
        await api(
          b.base,
          url + "/quizzes/" + q.id,
          "DELETE",
          undefined,
          adminToken,
        )
      ).status,
      200,
    )
    assert.equal((await api(a.base, url)).data.quizzes.length, 1)
    assert.equal(
      (await api(a.base, `/api/leagues/${randomUUID()}`)).status,
      404,
    )
    assert.equal(
      (await api(a.base, url + "/ocr", "POST", { image: "Zm9v" }, adminToken))
        .status,
      501,
    )
  } finally {
    await Promise.all([close(a.server), close(b.server)])
  }
})

test("A CAS retry revalidates participant limits and authorization against the latest league", async () => {
  const db = mockDatabase()
  const store = storeFor(db),
    initial = emptyLeague()
  initial.league.participants = Array.from({ length: 34 }, (_, i) => ({
    id: `p${i}`,
    name: `Person ${i}`,
  }))
  initial.league.quizzes = [
    {
      id: randomUUID(),
      title: "Tidigare quiz",
      date: "2026-10-08",
      results: initial.league.participants.map((p, i) => ({
        participantId: p.id,
        rank: i + 1,
      })),
    },
  ]
  await store.create(initial)
  const server = await serve(store)
  const url = `/api/leagues/${initial.league.id}/quizzes`
  const input = {
    title: "Nytt quiz",
    date: "2026-10-09",
    entries: [{ name: "Ny person", rank: 1 }],
  }
  try {
    db.onPatch((row) => {
      db.onPatch(undefined)
      row.league.participants.push({ id: "p34", name: "Samtidig person" })
      row.league.quizzes[0].results.push({ participantId: "p34", rank: 35 })
      row.revision++
    })
    const result = await api(server.base, url, "POST", input, token)
    assert.equal(result.status, 400)
    assert.match(result.data.error, /35/)
    assert.equal(db.calls.filter((c) => c.method === "PATCH").length, 1)
    assert.equal((await store.load(initial.league.id)).league.quizzes.length, 1)
    db.onPatch((row) => {
      db.onPatch(undefined)
      row.token_hash = createHash("sha256")
        .update("rotated-owner")
        .digest("hex")
      row.revision++
    })
    const authorizedInput = {
      ...input,
      entries: [{ name: "Person 0", rank: 1 }],
    }
    assert.equal(
      (await api(server.base, url, "POST", authorizedInput, token)).status,
      403,
    )
    assert.equal(db.calls.filter((c) => c.method === "PATCH").length, 2)
  } finally {
    await close(server.server)
  }
})
