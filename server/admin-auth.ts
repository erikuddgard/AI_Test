import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { StoreError } from "./store.ts";
const cookieName = "quiz_admin_session";
const ttl = 3600;
function configuration() {
  const password = process.env.QUIZ_ADMIN_PASSWORD;
  const secret = process.env.QUIZ_ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!password || !secret) throw new StoreError(503, "Huvudadmin är inte aktiverad ännu.");
  return {password, secret};
}
function sign(value: string, purpose: string) {
  const {password, secret} = configuration();
  return createHmac("sha256", secret).update(`${purpose}:${password}:${value}`).digest("hex");
}
function equal(a: string, b: string) {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}
export function verifyAdminPassword(value: unknown) {
  const {password} = configuration();
  if (typeof value !== "string" || value.length > 128 || !equal(value, password))
    throw new StoreError(401, "Fel lösenord. Försök igen.");
}
export function generatedOwnerToken(id: string) {
  return sign(id, "league-owner-link-v1");
}
export function adminCookie(req: IncomingMessage, clear = false) {
  const payload = `${Math.floor(Date.now() / 1000) + ttl}.${randomBytes(16).toString("hex")}`;
  const value = clear ? "" : `${payload}.${sign(payload, "admin-session-v1")}`;
  const secure = process.env.VERCEL || req.headers["x-forwarded-proto"] === "https";
  return `${cookieName}=${value}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : ttl}${secure ? "; Secure" : ""}`;
}
export function verifyAdminSession(req: IncomingMessage) {
  const cookie = req.headers.cookie?.split(";").map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || "";
  const match = cookie.match(/^(\d+)\.([a-f0-9]{32})\.([a-f0-9]{64})$/);
  if (!match) throw new StoreError(401, "Logga in som huvudadmin.");
  const expires = Number(match[1]);
  if (expires <= Date.now() / 1000 || expires > Date.now() / 1000 + ttl + 5 || !equal(match[3], sign(`${match[1]}.${match[2]}`, "admin-session-v1")))
    throw new StoreError(401, "Din inloggning har gått ut. Logga in igen.");
}
const attempts = new Map<string, {count: number; expires: number}>();
export function throttleAdminLogin(req: IncomingMessage) {
  const now = Date.now();
  for (const [id, attempt] of attempts) if (attempt.expires <= now) attempts.delete(id);
  const forwarded = process.env.VERCEL ? req.headers["x-forwarded-for"] : undefined;
  const address = (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.socket.remoteAddress) || "unknown";
  const attempt = attempts.get(address) || {count: 0, expires: now + 15 * 60_000};
  attempts.set(address, attempt);
  if (++attempt.count > 5) throw new StoreError(429, "För många inloggningsförsök. Vänta 15 minuter.");
}
