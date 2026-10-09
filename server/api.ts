import type { IncomingMessage, ServerResponse } from "node:http";
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  normalizeName,
  parseResults,
  validateEntries,
  type League,
  type Entry,
} from "../src/league.ts";
import {
  getStore,
  StoreError,
  type LeagueStore,
  type StoredLeague,
} from "./store.ts";
const exec = promisify(execFile);
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
function send(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(value));
}
async function body(req: IncomingMessage, max = 64_000): Promise<any> {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    throw new HttpError(415, "Skicka JSON-data.");
  const tooLarge = () => new HttpError(
    413,
    max > 64_000
      ? "Bilden är för stor. Max 5 MB."
      : "Förfrågan är för stor.",
  );
  if (Number(req.headers["content-length"]) > max) throw tooLarge();
  let parsedBody: unknown;
  try {
    // Vercel may expose a lazy getter which parses JSON on first access.
    parsedBody = (req as IncomingMessage & { body?: unknown }).body;
  } catch {
    throw new HttpError(400, "Ogiltiga data.");
  }
  if (parsedBody !== undefined) {
    let text: string;
    try {
      text = Buffer.isBuffer(parsedBody)
        ? parsedBody.toString("utf8")
        : typeof parsedBody === "string"
          ? parsedBody
          : JSON.stringify(parsedBody);
      if (typeof text !== "string") throw new Error();
    } catch {
      throw new HttpError(400, "Ogiltiga data.");
    }
    if (Buffer.byteLength(text, "utf8") > max) throw tooLarge();
    try {
      const value = JSON.parse(text);
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error();
      return value;
    } catch {
      throw new HttpError(400, "Ogiltiga data.");
    }
  }
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > max) {
      req.resume();
      throw tooLarge();
    }
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString());
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value;
  } catch {
    throw new HttpError(400, "Ogiltiga data.");
  }
}
function authorize(req: IncomingMessage, stored: StoredLeague) {
  const token = req.headers.authorization?.replace(/^Bearer /, "") || "";
  if (!timingSafeEqual(Buffer.from(hash(token)), Buffer.from(stored.tokenHash)))
    throw new HttpError(
      403,
      "Du behöver administratörslänken för att ändra ligan.",
    );
}
const requests = new Map<string, { count: number; until: number }>();
function limit(req: IncomingMessage) {
  const now = Date.now(),
    key = req.socket.remoteAddress || "unknown";
  for (const [key, value] of requests)
    if (value.until < now) requests.delete(key);
  const value = requests.get(key) || { count: 0, until: now + 60_000 };
  if (++value.count > 30)
    throw new HttpError(
      429,
      "För många försök. Vänta en minut och försök igen.",
    );
  requests.set(key, value);
}
let ocrBusy = false;
async function recognize(data: string) {
  if (ocrBusy)
    throw new HttpError(429, "En bild läses redan. Försök igen om en stund.");
  if (typeof data !== "string" || !/^[A-Za-z0-9+/=]+$/.test(data))
    throw new HttpError(400, "Bilden kunde inte läsas.");
  const bytes = Buffer.from(data, "base64");
  if (bytes.length > 5 * 1024 * 1024)
    throw new HttpError(413, "Bilden får vara högst 5 MB.");
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!png && !jpg) throw new HttpError(400, "Välj en PNG- eller JPEG-bild.");
  ocrBusy = true;
  let dir: string | undefined;
  try {
    dir = await mkdtemp(path.join(tmpdir(), "quiz-ocr-"));
    const file = path.join(dir, png ? "image.png" : "image.jpg");
    await writeFile(file, bytes);
    const { stdout } = await exec(
      "tesseract",
      [file, "stdout", "-l", process.env.OCR_LANG || "eng", "--psm", "6"],
      { timeout: 30_000, maxBuffer: 1_000_000 },
    );
    return { text: stdout, entries: parseResults(stdout) };
  } catch (error: any) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      422,
      "Bilden kunde inte tolkas. Prova en tydligare bild eller skriv in resultatet manuellt.",
    );
  } finally {
    ocrBusy = false;
    if (dir) await rm(dir, { recursive: true, force: true });
  }
}
export async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  options: { serverless?: boolean; store?: LeagueStore } = {},
): Promise<boolean> {
  const url = new URL(req.url || "/", "http://localhost");
  if (!url.pathname.startsWith("/api/")) return false;
  try {
    const serverless = options.serverless || Boolean(process.env.VERCEL);
    const store = options.store ?? getStore(serverless);
    if (req.method !== "GET") {
      // Reject browser cross-origin mutations; no CORS access is granted.
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host)
        throw new HttpError(
          403,
          "Förfrågan måste komma från ligans egen sida.",
        );
      limit(req);
    }
    if (url.pathname === "/api/leagues" && req.method === "POST") {
      const input = await body(req);
      if (
        typeof input.title !== "string" ||
        !input.title.trim() ||
        input.title.trim().length > 60
      )
        throw new HttpError(400, "Ge ligan ett namn på 1–60 tecken.");
      const token = randomBytes(32).toString("hex");
      const league: League = {
        id: randomUUID(),
        title: input.title.trim(),
        participants: [],
        quizzes: [],
      };
      await store.create({ league, tokenHash: hash(token), revision: 0 });
      send(res, 201, { league, adminToken: token });
      return true;
    }
    const match = url.pathname.match(
      /^\/api\/leagues\/([^/]+)(?:\/(quizzes|ocr)(?:\/([^/]+))?)?$/,
    );
    if (!match || !uuidPattern.test(match[1]))
      throw new HttpError(404, "Sidan hittades inte.");
    const [, id, section, quizId] = match;
    if (!section && req.method === "GET") {
      send(res, 200, (await store.load(id)).league);
      return true;
    }
    if (section === "ocr" && req.method === "POST" && !quizId) {
      authorize(req, await store.load(id));
      if (serverless)
        throw new HttpError(
          501,
          "Bildavläsningen sker i webbläsaren på den här sidan.",
        );
      const input = await body(req, 7_100_000);
      send(res, 200, await recognize(input.image));
      return true;
    }
    if (
      section === "quizzes" &&
      ((req.method === "POST" && !quizId) ||
        (req.method === "PUT" && quizId) ||
        (req.method === "DELETE" && quizId))
    ) {
      const input = req.method === "DELETE" ? null : await body(req);
      const league = await store.mutate(id, async (stored) => {
        authorize(req, stored);
        const league = stored.league;
        if (quizId && !league.quizzes.some((q) => q.id === quizId))
          throw new HttpError(404, "Quizet hittades inte.");
        if (req.method === "DELETE")
          league.quizzes = league.quizzes.filter((q) => q.id !== quizId);
        else {
          if (
            typeof input.title !== "string" ||
            !input.title.trim() ||
            input.title.trim().length > 60
          )
            throw new HttpError(400, "Quizet behöver ett namn på 1–60 tecken.");
          if (
            typeof input.date !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
            Number.isNaN(Date.parse(input.date)) ||
            new Date(input.date).toISOString().slice(0, 10) !== input.date
          )
            throw new HttpError(400, "Välj ett giltigt datum.");
          try {
            validateEntries(input.entries);
          } catch (e: any) {
            throw new HttpError(400, e.message);
          }
          if (!quizId && league.quizzes.length >= 200)
            throw new HttpError(400, "Ligan kan innehålla högst 200 quiz.");
          const results = (input.entries as Entry[]).map((entry) => {
            let participant = league.participants.find(
              (p) => normalizeName(p.name) === normalizeName(entry.name),
            );
            if (!participant) {
              participant = {
                id: randomUUID(),
                name: entry.name.trim().replace(/\s+/g, " "),
              };
              league.participants.push(participant);
            }
            return { participantId: participant.id, rank: entry.rank };
          });
          const quiz = {
            id: quizId || randomUUID(),
            title: input.title.trim(),
            date: input.date,
            results,
          };
          if (quizId)
            league.quizzes = league.quizzes.map((q) =>
              q.id === quizId ? quiz : q,
            );
          else league.quizzes.push(quiz);
        }
        const used = new Set(
          league.quizzes.flatMap((q) => q.results.map((r) => r.participantId)),
        );
        league.participants = league.participants.filter((p) => used.has(p.id));
        if (league.participants.length > 35)
          throw new HttpError(
            400,
            "Ligan kan innehålla högst 35 olika deltagare. Kontrollera stavningen på namnen.",
          );
        league.quizzes.sort((a, b) => a.date.localeCompare(b.date));
        return league;
      });
      send(res, 200, league);
      return true;
    }
    throw new HttpError(405, "Åtgärden stöds inte.");
  } catch (error) {
    const known = error instanceof HttpError || error instanceof StoreError;
    if (!known)
      console.error(
        "League API failed:",
        error instanceof Error ? error.message : "Unknown error",
      );
    send(res, known ? error.status : 500, {
      error:
        known
          ? error.message
          : "Servern kunde inte spara resultatet. Försök igen.",
    });
  }
  return true;
}
