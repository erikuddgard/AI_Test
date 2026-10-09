import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
test("Shared API: durable results, read-only access, updates, validation and concurrent saves", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "league-test-"));
  process.env.LEAGUE_DATA_DIR = dir;
  const { handleApi } = await import("./api.ts");
  const server = createServer((req, res) => {
    void handleApi(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as { port: number },
    base = `http://127.0.0.1:${addr.port}`;
  const call = async (
    url: string,
    method = "GET",
    body?: unknown,
    token?: string,
  ) => {
    const response = await fetch(base + url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json() };
  };
  try {
    assert.equal(
      (await call("/api/leagues", "POST", { title: "x".repeat(70_000) }))
        .status,
      413,
    );
    const created = await call("/api/leagues", "POST", { title: "Team Åsa" });
    assert.equal(created.status, 201);
    const { league, adminToken } = created.data,
      url = `/api/leagues/${league.id}`;
    const quiz = {
      title: "Quiz 1",
      date: "2026-10-09",
      entries: [
        { name: "Åsa", rank: 1 },
        { name: "Bo", rank: 2 },
      ],
    };
    assert.equal((await call(url + "/quizzes", "POST", quiz)).status, 403);
    assert.equal(
      (
        await call(
          url + "/quizzes",
          "POST",
          {
            ...quiz,
            entries: [
              { name: "Åsa", rank: 1 },
              { name: "Bo", rank: 1 },
            ],
          },
          adminToken,
        )
      ).status,
      400,
    );
    const saved = await call(url + "/quizzes", "POST", quiz, adminToken);
    assert.equal(saved.status, 200);
    const q = saved.data.quizzes[0];
    const read = await call(url);
    assert.equal(read.data.quizzes.length, 1);
    assert.equal(read.data.tokenHash, undefined);
    const edited = await call(
      url + "/quizzes/" + q.id,
      "PUT",
      {
        ...quiz,
        entries: [
          { name: " åsa ", rank: 2 },
          { name: "Bo", rank: 1 },
        ],
      },
      adminToken,
    );
    assert.equal(edited.status, 200);
    assert.equal(edited.data.participants.length, 2);
    const concurrent = await Promise.all(
      ["2", "3"].map((n) =>
        call(
          url + "/quizzes",
          "POST",
          { ...quiz, title: "Quiz " + n },
          adminToken,
        ),
      ),
    );
    assert.ok(concurrent.every((r) => r.status === 200));
    assert.equal((await call(url)).data.quizzes.length, 3);
    assert.equal(
      (
        await call(
          url + "/quizzes",
          "POST",
          { ...quiz, date: "2026-02-30" },
          adminToken,
        )
      ).status,
      400,
    );
    assert.equal(
      (await call(url + "/ocr", "POST", { image: "Zm9v" }, adminToken)).status,
      400,
    );
    assert.equal(
      (await call(url + "/quizzes/" + q.id, "DELETE", undefined, "wrong"))
        .status,
      403,
    );
    assert.equal(
      (await call(url + "/quizzes/" + q.id, "DELETE", undefined, adminToken))
        .data.quizzes.length,
      2,
    );
    const file = await import("node:fs/promises");
    const stored = JSON.parse(
      await file.readFile(path.join(dir, league.id + ".json"), "utf8"),
    );
    assert.equal(stored.league.quizzes.length, 2);
    assert.notEqual(stored.tokenHash, adminToken);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  }
});
