import { test } from "node:test";
import assert from "node:assert/strict";
import {
  points,
  standings,
  validateEntries,
  parseResults,
  normalizeName,
  type League,
} from "../src/league.ts";
test("Scoring uses each quiz attendance, with zero for absence", () => {
  for (const count of [1, 10, 20, 35]) {
    const results = Array.from({ length: count }, (_, i) => ({
      participantId: `p${i}`,
      rank: i + 1,
    }));
    const quiz = { id: "q", title: "Quiz", date: "2026-10-09", results };
    assert.equal(points(quiz, "p0"), count);
    assert.equal(points(quiz, `p${count - 1}`), 1);
    assert.equal(points(quiz, "absent"), 0);
  }
});
test("Totals sum all quizzes, with changing attendance and alphabetical tie break", () => {
  const league: League = {
    id: "l",
    title: "L",
    participants: [
      { id: "a", name: "Anna" },
      { id: "b", name: "Bea" },
      { id: "c", name: "Calle" },
    ],
    quizzes: [
      {
        id: "q1",
        title: "1",
        date: "2026-10-01",
        results: [
          { participantId: "a", rank: 1 },
          { participantId: "b", rank: 2 },
          { participantId: "c", rank: 3 },
        ],
      },
      {
        id: "q2",
        title: "2",
        date: "2026-10-02",
        results: [
          { participantId: "b", rank: 1 },
          { participantId: "c", rank: 2 },
        ],
      },
    ],
  };
  assert.deepEqual(
    standings(league).map((p) => [p.name, p.total]),
    [
      ["Bea", 4],
      ["Anna", 3],
      ["Calle", 2],
    ],
  );
});
test("Reject ties, gaps, duplicates, missing names and more than 35", () => {
  for (const entries of [
    [
      { name: "Anna", rank: 1 },
      { name: "Bea", rank: 1 },
    ],
    [
      { name: "Anna", rank: 1 },
      { name: "Bea", rank: 3 },
    ],
    [
      { name: "Anna", rank: 1 },
      { name: " anna ", rank: 2 },
    ],
    [{ name: " ", rank: 1 }],
    [],
  ])
    assert.throws(() => validateEntries(entries));
  assert.throws(() =>
    validateEntries(
      Array.from({ length: 36 }, (_, i) => ({ name: `P ${i}`, rank: i + 1 })),
    ),
  );
  validateEntries([
    { name: "Anna", rank: 2 },
    { name: "Bea", rank: 1 },
  ]);
});
test("Parse ranked screenshot text and normalize Swedish names", () => {
  assert.equal(parseResults("36 Other Name")[0].rank, 36); // Do not silently drop over-limit rows; validation rejects them.
  assert.deepEqual(
    parseResults(
      "Placering Namn Poäng\n1. Emma Lind 950\n2 Oscar Berg 840\n3: Sofia Nilsson 700",
    ),
    [
      { rank: 1, name: "Emma Lind" },
      { rank: 2, name: "Oscar Berg" },
      { rank: 3, name: "Sofia Nilsson" },
    ],
  );
  assert.equal(normalizeName(" Åsa   Öberg "), normalizeName("åsa öberg"));
});
