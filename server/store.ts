import { randomUUID } from "node:crypto"
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import type { League } from "../src/league.ts"

export type StoredLeague = {
  league: League
  tokenHash: string
  revision: number
}
type Mutation = (stored: StoredLeague) => League | Promise<League>
export interface LeagueStore {
  create(stored: StoredLeague): Promise<void>
  load(id: string): Promise<StoredLeague>
  ping?(): Promise<void>
  list?(): Promise<StoredLeague[]>
  remove?(id: string): Promise<void>
  mutate(id: string, mutation: Mutation): Promise<League>
}
export class StoreError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
const unavailable = () =>
  new StoreError(
    503,
    "Ligans databas är inte tillgänglig. Försök igen om en stund.",
  )
const notFound = () =>
  new StoreError(404, "Ligan hittades inte. Kontrollera länken.")
const conflict = () =>
  new StoreError(409, "Ligan ändrades samtidigt av någon annan. Försök igen.")

class FileStore implements LeagueStore {
  private queue: Promise<unknown> = Promise.resolve()
  private readonly dataDir: string
  constructor(dataDir: string) {
    this.dataDir = dataDir
  }

  async load(id: string): Promise<StoredLeague> {
    try {
      const stored = JSON.parse(
        await readFile(path.join(this.dataDir, `${id}.json`), "utf8"),
      )
      // Upgrade the original local file format when it is next saved.
      return { ...stored, revision: stored.revision ?? 0 }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw notFound()
      throw error
    }
  }

  async ping() { await this.list(); }

  async list() {
    let files: string[];
    try { files = await readdir(this.dataDir); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    return Promise.all(files.filter(file => /^[a-f0-9-]{36}\.json$/.test(file)).map(file => this.load(file.slice(0, -5))));
  }

  async remove(id: string) {
    const next = this.queue.then(async () => {
      await this.load(id);
      await rm(path.join(this.dataDir, `${id}.json`));
    });
    this.queue = next.catch(() => {});
    return next;
  }

  private async save(stored: StoredLeague) {
    await mkdir(this.dataDir, { recursive: true, mode: 0o700 })
    const destination = path.join(this.dataDir, `${stored.league.id}.json`)
    const temp = `${destination}.${randomUUID()}.tmp`
    try {
      await writeFile(temp, JSON.stringify(stored), { mode: 0o600 })
      await rename(temp, destination)
    } finally {
      await rm(temp, { force: true })
    }
  }

  create(stored: StoredLeague) {
    return this.save(stored)
  }

  mutate(id: string, mutation: Mutation): Promise<League> {
    const next = this.queue.then(async () => {
      const stored = await this.load(id)
      const league = await mutation(stored)
      await this.save({ ...stored, league, revision: stored.revision + 1 })
      return league
    })
    this.queue = next.catch(() => {})
    return next
  }
}

type Row = {
  id: string
  league: League
  token_hash: string
  revision: number
}
const fields = "id,league,token_hash,revision"
const maxAttempts = 5
class SupabaseStore implements LeagueStore {
  private readonly endpoint: string
  private readonly key: string
  private readonly request: typeof fetch
  constructor(endpoint: string, key: string, request: typeof fetch) {
    this.endpoint = endpoint
    this.key = key
    this.request = request
  }

  private async call(query: URLSearchParams, init: RequestInit = {}) {
    let response: Response
    try {
      response = await this.request(`${this.endpoint}?${query}`, {
        ...init,
        headers: {
          apikey: this.key,
          // Opaque sb_secret_ keys are not JWTs. Supabase authenticates those
          // through apikey; only legacy service-role JWTs use a Bearer header.
          ...(this.key.split(".").length === 3
            ? { Authorization: `Bearer ${this.key}` }
            : {}),
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      })
    } catch {
      throw unavailable()
    }
    // Never surface database responses: they can contain private data.
    if (!response.ok) throw unavailable()
    let rows: Row[]
    try {
      rows = await response.json()
    } catch {
      throw unavailable()
    }
    if (!Array.isArray(rows)) throw unavailable()
    return rows
  }

  private stored(row: Row, id: string): StoredLeague {
    if (
      !row ||
      row.id !== id ||
      row.league?.id !== id ||
      typeof row.league.title !== "string" ||
      !Array.isArray(row.league.participants) ||
      !Array.isArray(row.league.quizzes) ||
      typeof row.token_hash !== "string" ||
      !/^[0-9a-f]{64}$/.test(row.token_hash) ||
      !Number.isSafeInteger(row.revision) ||
      row.revision < 0
    )
      throw unavailable()
    return {
      league: row.league,
      tokenHash: row.token_hash,
      revision: row.revision,
    }
  }

  async create(stored: StoredLeague) {
    const rows = await this.call(new URLSearchParams({ select: fields }), {
      method: "POST",
      body: JSON.stringify({
        id: stored.league.id,
        league: stored.league,
        token_hash: stored.tokenHash,
        revision: 0,
      }),
    })
    if (rows.length !== 1) throw unavailable()
    this.stored(rows[0], stored.league.id)
  }

  async load(id: string) {
    const rows = await this.call(
      new URLSearchParams({ id: `eq.${id}`, select: fields }),
    )
    if (rows.length === 0) throw notFound()
    if (rows.length !== 1) throw unavailable()
    return this.stored(rows[0], id)
  }

  async ping() { await this.call(new URLSearchParams({select: "id", limit: "1"})); }

  async list() {
    const result: StoredLeague[] = [];
    for (let offset = 0; ; offset += 200) {
      const rows = await this.call(new URLSearchParams({select: fields, order: "id.asc", limit: "200", offset: String(offset)}));
      result.push(...rows.map(row => this.stored(row, row.id)));
      if (rows.length < 200) return result;
      if (result.length >= 10000) throw new StoreError(413, "För många ligor för att visa samtidigt.");
    }
  }

  async remove(id: string) {
    const rows = await this.call(new URLSearchParams({id: `eq.${id}`, select: fields}), {method: "DELETE"});
    if (!rows.length) throw notFound();
    if (rows.length !== 1) throw unavailable();
  }

  async mutate(id: string, mutation: Mutation): Promise<League> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const stored = await this.load(id)
      // Authorization, limits and name matching must be rerun against the
      // newest league after every conflict, not just the first snapshot.
      const draft = structuredClone(stored)
      const league = await mutation(draft)
      const rows = await this.call(
        new URLSearchParams({
          id: `eq.${id}`,
          revision: `eq.${stored.revision}`,
          select: fields,
        }),
        {
          method: "PATCH",
          body: JSON.stringify({ league, revision: stored.revision + 1, ...(draft.tokenHash !== stored.tokenHash ? {token_hash: draft.tokenHash} : {}) }),
        },
      )
      if (rows.length === 0) continue
      if (rows.length !== 1) throw unavailable()
      const saved = this.stored(rows[0], id)
      if (saved.revision !== stored.revision + 1) throw unavailable()
      return saved.league
    }
    throw conflict()
  }
}

export function createStore(
  options: {
    env?: NodeJS.ProcessEnv
    serverless?: boolean
    fetch?: typeof fetch
  } = {},
): LeagueStore {
  const env = options.env ?? process.env
  const url = env.SUPABASE_URL?.trim()
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const serverless = options.serverless || Boolean(env.VERCEL)
  if (url || key) {
    if (!url || !key)
      throw new StoreError(
        503,
        "Konfigurera både SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY på servern.",
      )
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new StoreError(
        503,
        "SUPABASE_URL måste vara en giltig HTTPS-adress.",
      )
    }
    const localHttp =
      !serverless &&
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
    if (
      (parsed.protocol !== "https:" && !localHttp) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname !== "/"
    )
      throw new StoreError(
        503,
        "SUPABASE_URL måste vara Supabase-projektets HTTPS-adress utan sökväg.",
      )
    if (key.startsWith("sb_publishable_"))
      throw new StoreError(
        503,
        "Databasen behöver en hemlig servernyckel, inte en publik Supabase-nyckel.",
      )
    // Legacy project keys are JWTs; reject the anon/authenticated roles early.
    if (key.split(".").length === 3) {
      try {
        const payload = JSON.parse(
          Buffer.from(key.split(".")[1], "base64url").toString(),
        )
        if (payload.role !== "service_role") throw new Error()
      } catch {
        throw new StoreError(
          503,
          "SUPABASE_SERVICE_ROLE_KEY måste vara projektets service_role-nyckel.",
        )
      }
    }
    return new SupabaseStore(
      `${parsed.origin}/rest/v1/quiz_leagues`,
      key,
      options.fetch ?? fetch,
    )
  }
  if (serverless)
    throw new StoreError(
      503,
      "Delad lagring saknas. Konfigurera SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY i Vercel.",
    )
  return new FileStore(env.LEAGUE_DATA_DIR || path.resolve(".league-data"))
}

let cachedStore: LeagueStore | undefined
let cachedConfig = ""
export function getStore(serverless = false): LeagueStore {
  // A cached local store preserves its mutation queue for all requests.
  const config = JSON.stringify([
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.LEAGUE_DATA_DIR,
    process.env.VERCEL,
    serverless,
  ])
  if (!cachedStore || config !== cachedConfig) {
    cachedStore = createStore({ serverless })
    cachedConfig = config
  }
  return cachedStore
}
