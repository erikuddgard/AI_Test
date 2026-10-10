import {test} from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {createHash, randomUUID} from "node:crypto";
import {createStore} from "./store.ts";
import {handleApi} from "./api.ts";
import {adminCookie, generatedOwnerToken, verifyAdminSession} from "./admin-auth.ts";
process.env.QUIZ_ADMIN_PASSWORD = "test-master-password";
process.env.QUIZ_ADMIN_SESSION_SECRET = "test-session-secret-that-is-long-and-isolated";

test("Master admin: authentication, private league list, persisted owner-link replacement, confirmation and deletion", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "quiz-admin-test-"));
  const store = createStore({env: {LEAGUE_DATA_DIR: dir}});
  const server = createServer((req,res) => {void handleApi(req,res,{store});});
  await new Promise<void>(resolve => server.listen(0,"127.0.0.1",resolve));
  const base = `http://127.0.0.1:${(server.address() as {port: number}).port}`;
  const call = async (route: string, method = "GET", data?: unknown, cookie?: string, origin?: string) => {
    const response = await fetch(`${base}/api/${route}`,{method, headers:{...(data ? {"Content-Type":"application/json"}:{}),...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{})},body:data?JSON.stringify(data):undefined});
    return {status:response.status, value:await response.json(), cookie:response.headers.get("set-cookie")};
  };
  try {
    const first = await call("leagues","POST",{title:"Första ligan"});
    const second = await call("leagues","POST",{title:"Andra ligan"});
    const id = first.value.league.id;
    assert.equal((await call("admin/leagues")).status,401);
    assert.equal((await call(`admin/leagues/${id}`,"DELETE",{confirmTitle:"Första ligan"})).status,401);
    assert.equal((await call("admin/session","POST",{password:"wrong"})).status,401);
    assert.equal((await call("admin/session","POST",{password:"test-master-password"},undefined,"https://evil.example")).status,403);
    const login = await call("admin/session","POST",{password:"test-master-password"});
    assert.equal(login.status,200);
    assert.match(login.cookie!,/HttpOnly/);assert.match(login.cookie!,/SameSite=Strict/);assert.match(login.cookie!,/Max-Age=3600/);
    const cookie = login.cookie!.split(";")[0];
    const list = await call("admin/leagues","GET",undefined,cookie);
    assert.equal(list.status,200); assert.equal(list.value.length,2);
    assert.ok(list.value.every((row:any) => row.adminToken === null && !row.tokenHash && !row.token_hash));
    const forged = `${cookie.slice(0,-1)}${cookie.endsWith("0") ? "1":"0"}`;
    assert.equal((await call("admin/leagues","GET",undefined,forged)).status,401);
    const replacement = await call(`admin/leagues/${id}/owner-link`,"POST",{},cookie);
    assert.equal(replacement.status,200);
    assert.notEqual(replacement.value.adminToken,first.value.adminToken);
    const independentStore = createStore({env:{LEAGUE_DATA_DIR:dir}});
    const stored = await independentStore.load(id);
    assert.equal(stored.tokenHash,createHash("sha256").update(replacement.value.adminToken).digest("hex"));
    assert.equal(stored.league.title,"Första ligan");
    assert.notEqual(generatedOwnerToken(id),generatedOwnerToken(second.value.league.id));
    const regenerated = await call("admin/leagues","GET",undefined,cookie);
    assert.equal(regenerated.value.find((row:any) => row.id === id).adminToken,replacement.value.adminToken);
    const payload = {title:"Testquiz",date:"2026-10-10",entries:[{rank:1,name:"Anna"}]};
    const mutate = (owner:string) => fetch(`${base}/api/leagues/${id}/quizzes`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${owner}`},body:JSON.stringify(payload)});
    assert.equal((await mutate(first.value.adminToken)).status,403);
    assert.equal((await mutate(replacement.value.adminToken)).status,200);
    assert.equal((await call(`admin/leagues/${id}`,"DELETE",{confirmTitle:"Wrong title"},cookie)).status,400);
    assert.equal((await call(`leagues/${id}`)).status,200);
    assert.equal((await call(`admin/leagues/${id}`,"DELETE",{confirmTitle:"Första ligan"},cookie)).status,200);
    assert.equal((await call(`leagues/${id}`)).status,404);
    assert.equal((await call("health/database")).status,200);
    assert.equal((await call("admin/leagues","GET",undefined,cookie)).value.length,1);
    const logout = await call("admin/session","DELETE",undefined,cookie);
    assert.match(logout.cookie!,/Max-Age=0/);
  } finally {await new Promise<void>(resolve => server.close(() => resolve()));await rm(dir,{recursive:true,force:true});}
});

test("Supabase owner replacement persists token hash and list/delete/health use the private server key", async () => {
  const id = randomUUID();
  let row:any = {id,league:{id,title:"Test",participants:[],quizzes:[]},token_hash:"a".repeat(64),revision:0};
  const calls:string[] = [];
  const store = createStore({env:{SUPABASE_URL:"https://admin-test.supabase.co",SUPABASE_SERVICE_ROLE_KEY:"sb_secret_test"},fetch:async (input, init) => {
    assert.equal(new Headers(init?.headers).get("apikey"),"sb_secret_test");
    const url=new URL(String(input));const method=init?.method || "GET";calls.push(method);
    if(method === "PATCH") {assert.equal(url.searchParams.get("revision"),`eq.${row.revision}`);row={...row,...JSON.parse(String(init?.body))};return Response.json([row]);}
    if(method === "DELETE") {const old=row;row=null;return Response.json([old]);}
    return Response.json(row?[row]:[]);
  }});
  const rotated = "b".repeat(64);
  await store.mutate(id,stored => {stored.tokenHash=rotated;return stored.league;});
  assert.equal((await store.load(id)).tokenHash,rotated);
  assert.equal((await store.list!()).length,1);
  await store.remove!(id);await store.ping!();assert.ok(calls.includes("DELETE"));
});

test("Expired sessions fail closed and production cookies require HTTPS", () => {
  const req:any={headers:{},socket:{remoteAddress:"127.0.0.1"}};
  const previous=process.env.VERCEL;process.env.VERCEL="1";
  try {assert.match(adminCookie(req),/; Secure/);assert.throws(() => verifyAdminSession({...req,headers:{cookie:"quiz_admin_session=1."+"a".repeat(32)+"."+"b".repeat(64)}}));}
  finally {if(previous === undefined) delete process.env.VERCEL;else process.env.VERCEL=previous;}
});
