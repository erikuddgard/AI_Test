export type Participant = { id: string; name: string };
export type Result = { participantId: string; rank: number };
export type Quiz = {
  id: string;
  title: string;
  date: string;
  results: Result[];
};
export type League = {
  id: string;
  title: string;
  participants: Participant[];
  quizzes: Quiz[];
};
export type Entry = { name: string; rank: number };
export const normalizeName = (name: string) =>
  name.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("sv-SE");
export function points(quiz: Quiz, participantId: string) {
  const result = quiz.results.find((r) => r.participantId === participantId);
  return result ? quiz.results.length - result.rank + 1 : 0;
}
export function standings(league: League) {
  return league.participants
    .map((p) => ({
      ...p,
      total: league.quizzes.reduce((sum, q) => sum + points(q, p.id), 0),
      played: league.quizzes.filter((q) =>
        q.results.some((r) => r.participantId === p.id),
      ).length,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "sv"));
}
export function validateEntries(entries: Entry[]) {
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 35)
    throw new Error("Ett quiz behöver 1–35 deltagare.");
  const names = new Set<string>(),
    ranks = new Set<number>();
  for (const entry of entries) {
    if (
      !entry ||
      typeof entry.name !== "string" ||
      !entry.name.trim() ||
      entry.name.trim().length > 80
    )
      throw new Error("Varje deltagare behöver ett namn på högst 80 tecken.");
    const name = normalizeName(entry.name);
    if (names.has(name))
      throw new Error(`Namnet ${entry.name.trim()} förekommer flera gånger.`);
    if (
      !Number.isInteger(entry.rank) ||
      entry.rank < 1 ||
      entry.rank > entries.length ||
      ranks.has(entry.rank)
    )
      throw new Error(
        `Placeringarna måste vara unika och innehålla alla tal från 1 till ${entries.length}.`,
      );
    names.add(name);
    ranks.add(entry.rank);
  }
}
export function parseResults(text: string): Entry[] {
  return text.split(/\r?\n/).flatMap((line) => {
    const match = line.trim().match(/^#?(\d{1,3})\s*[.)\-:|]?\s+(.+?)\s*$/);
    if (!match) return [];
    const rank = Number(match[1]);
    const name = match[2]
      .replace(/\s+[|]?\s*\d+(?:[.,]\d+)?\s*(?:p|pts|poäng)?\s*$/i, "")
      .trim();
    return rank > 0 && name ? [{ rank, name }] : [];
  });
}
const names = [
  "Emma Lind",
  "Oscar Berg",
  "Sofia Nilsson",
  "Alex Chen",
  "Maja Ek",
  "Erik Andersson",
  "Julia Holm",
  "Noah Dahl",
];
export const demo: League = {
  id: "demo",
  title: "Fredagsligan",
  participants: names.map((name, i) => ({ id: `p${i}`, name })),
  quizzes: [
    [0, 2, 1, 4, 3, 5, 7, 6],
    [1, 0, 3, 2, 5, 4, 6, 7],
    [0, 2, 4, 1, 3, 6, 5, 7],
    [2, 0, 1, 3, 4, 7, 6, 5],
    [0, 1, 2, 4, 3, 5, 6, 7],
  ].map((order, i) => ({
    id: `q${i}`,
    title: [
      "Premiärquiz",
      "Popkultur",
      "Världen runt",
      "Musikquiz",
      "Fredagsmix",
    ][i],
    date: `2026-10-${String(i + 1).padStart(2, "0")}`,
    results: order.map((p, rank) => ({
      participantId: `p${p}`,
      rank: rank + 1,
    })),
  })),
};
