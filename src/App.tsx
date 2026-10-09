import { useEffect, useRef, useState } from "react";
import { recognizeResults } from "./ocr";
import {
  demo,
  points,
  standings,
  validateEntries,
  parseResults,
  type League,
  type Quiz,
  type Entry,
} from "./league";

type IconName =
  | "cup"
  | "plus"
  | "arrow"
  | "share"
  | "people"
  | "calendar"
  | "check"
  | "upload"
  | "close"
  | "grid"
  | "list"
  | "spark"
  | "edit"
  | "trash";
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    cup: (
      <>
        <path d="M8 3h8v7a4 4 0 0 1-8 0V3Zm4 11v6m-4 1h8M8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    share: (
      <>
        <path d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="7" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m3 11v-3a5 5 0 0 0-3-4" />
      </>
    ),
    calendar: (
      <>
        <rect x="4" y="5" width="16" height="16" rx="3" />
        <path d="M8 3v4m8-4v4M4 11h16m-12 5h3" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    upload: <path d="M12 16V4m-5 5 5-5 5 5M4 15v5h16v-5" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    list: <path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1" />,
    spark: (
      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />
    ),
    edit: <path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z" />,
    trash: <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
const formatDate = (date: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(
    new Date(),
  );
const colors = [
  "#dcf3b0",
  "#e9e0f8",
  "#d5e7fb",
  "#f9e1c9",
  "#f4dfe7",
  "#dcebe6",
];
async function api<T>(
  url: string,
  method = "GET",
  data?: unknown,
  token?: string,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Det gick inte att kontakta servern.");
  return result as T;
}
function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const original = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("input, button")?.focus();
    function keyboard(e: KeyboardEvent) {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const nodes = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href], select",
          ) || [],
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keyboard);
      original?.focus();
    };
  }, []);
  return (
    <div
      className="modal-shade"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={ref}
      >
        <div className="modal-heading">
          <div>
            <h2 id="modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" aria-label="Stäng" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function QuizEditor({
  league,
  quiz,
  token,
  onSave,
  onClose,
}: {
  league: League;
  quiz?: Quiz;
  token: string;
  onSave: (league: League) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(quiz?.title || ""),
    [date, setDate] = useState(quiz?.date || today());
  const [entries, setEntries] = useState<Entry[]>(
    quiz
      ? [...quiz.results]
          .sort((a, b) => a.rank - b.rank)
          .map((r) => ({
            rank: r.rank,
            name:
              league.participants.find((p) => p.id === r.participantId)?.name ||
              "",
          }))
      : [],
  );
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [image, setImage] = useState(""),
    [rawText, setRawText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const close = () => {
    if (!busy) onClose();
  };
  async function upload(file?: File) {
    if (!file || busy) return;
    setError("");
    if (
      !["image/png", "image/jpeg"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError("Välj PNG eller JPEG, högst 5 MB.");
      return;
    }
    setBusy("Läser namn och placeringar…");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Filen kunde inte öppnas."));
        reader.readAsDataURL(file);
      });
      if (!mounted.current) return;
      setImage(base64);
      const result = await recognizeResults(file, status => {
        if (mounted.current) setBusy(status);
      });
      if (!mounted.current) return;
      setRawText(result.text);
      setEntries(result.entries);
      if (!result.entries.length)
        setError(
          "Inga placeringar hittades. Skriv in resultatet nedan eller prova en tydligare bild.",
        );
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) setBusy("");
    }
  }
  async function save() {
    setError("");
    try {
      validateEntries(entries);
      if (!title.trim()) throw new Error("Ge quizet ett namn.");
      setBusy("Sparar resultat…");
      const updated = await api<League>(
        `/api/leagues/${league.id}/quizzes${quiz ? `/${quiz.id}` : ""}`,
        quiz ? "PUT" : "POST",
        { title, date, entries },
        token,
      );
      onSave(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <Modal
      title={quiz ? "Redigera quiz" : "Lägg till ett quiz"}
      subtitle="Ladda upp resultatbilden. Vi räknar ut poängen åt dig."
      onClose={close}
      wide
    >
      <div className="form-grid">
        <label>
          Quizets namn
          <input
            value={title}
            maxLength={60}
            placeholder="Till exempel Fredagsquiz #6"
            onChange={(e) => setTitle(e.target.value)}
            disabled={!!busy}
          />
        </label>
        <label>
          Datum
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={!!busy}
          />
        </label>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg"
        hidden
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        className={`upload-zone ${busy ? "loading" : ""}`}
        disabled={!!busy}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void upload(e.dataTransfer.files[0]);
        }}
      >
        {image ? (
          <img src={image} alt="Uppladdad resultatbild" />
        ) : (
          <span className="upload-icon">
            <Icon name="upload" size={25} />
          </span>
        )}
        <strong>
          {busy ||
            (image ? "Välj en annan resultatbild" : "Släpp resultatbilden här")}
        </strong>
        <span>eller klicka för att välja · PNG / JPEG · max 5 MB</span>
      </button>
      <details className="paste-results">
        <summary>Klistra in resultat som text</summary>
        <textarea
          aria-label="Resultat som text"
          value={rawText}
          placeholder={"1 Emma Lind\n2 Oscar Berg\n3 Sofia Nilsson"}
          disabled={!!busy}
          onChange={(e) => setRawText(e.target.value)}
        />
        <button
          className="button secondary small"
          disabled={!!busy}
          onClick={() => {
            const rows = parseResults(rawText);
            setEntries(rows);
            setError(
              rows.length
                ? ""
                : "Skriv en placering och ett namn på varje rad, till exempel 1 Emma Lind.",
            );
          }}
        >
          Läs in rader
        </button>
      </details>
      <div className="review-heading">
        <div>
          <h3>
            Granska resultatet <span>{entries.length} / 35</span>
          </h3>
          <p>Kontrollera stavningen så att samma person får sina poäng.</p>
        </div>
        <span className="pill">
          <Icon name="check" size={13} /> Automatisk poäng
        </span>
      </div>
      <div className="review-list">
        <div className="review-labels">
          <span>PLACERING</span>
          <span>DELTAGARE</span>
          <span>POÄNG</span>
          <span />
        </div>
        {entries.length === 0 && (
          <p className="empty-review">
            Ladda upp en bild eller lägg till deltagare manuellt.
          </p>
        )}
        {entries.map((entry, index) => (
          <div className="review-row" key={index}>
            <input
              type="number"
              min={1}
              max={entries.length || 35}
              value={entry.rank || ""}
              aria-label={`Placering rad ${index + 1}`}
              disabled={!!busy}
              onChange={(e) =>
                setEntries(
                  entries.map((r, i) =>
                    i === index ? { ...r, rank: Number(e.target.value) } : r,
                  ),
                )
              }
            />
            <input
              list="existing-names"
              value={entry.name}
              maxLength={80}
              aria-label={`Namn rad ${index + 1}`}
              placeholder="För- och efternamn"
              disabled={!!busy}
              onChange={(e) =>
                setEntries(
                  entries.map((r, i) =>
                    i === index ? { ...r, name: e.target.value } : r,
                  ),
                )
              }
            />
            <span className="review-points">
              {entry.rank > 0 && entry.rank <= entries.length
                ? entries.length - entry.rank + 1
                : "—"}
            </span>
            <button
              className="icon-button"
              aria-label={`Ta bort rad ${index + 1}`}
              disabled={!!busy}
              onClick={() =>
                setEntries(
                  entries
                    .filter((_, i) => i !== index)
                    .map((r, i) => ({ ...r, rank: i + 1 })),
                )
              }
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
      <datalist id="existing-names">
        {league.participants.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
      <button
        className="text-button add-row"
        disabled={!!busy || entries.length >= 35}
        onClick={() =>
          setEntries([...entries, { name: "", rank: entries.length + 1 }])
        }
      >
        <Icon name="plus" size={16} /> Lägg till deltagare
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-footer">
        <p>
          {entries.length} deltagare → vinnaren får {entries.length} poäng.
          <br />
          Frånvaro ger 0 poäng.
        </p>
        <button
          className="button primary"
          disabled={!!busy}
          onClick={() => void save()}
        >
          {busy || "Spara quiz"}
          <Icon name="check" size={17} />
        </button>
      </div>
    </Modal>
  );
}
function Evolution({ league, selected }: { league: League; selected: string }) {
  const rows = standings(league).slice(0, 5),
    width = 720,
    height = 235;
  const max = Math.max(1, ...rows.map((r) => r.total)),
    count = league.quizzes.length;
  const x = (i: number) => 35 + (i / Math.max(1, count - 1)) * (width - 70);
  const y = (v: number) => height - 35 - (v / max) * (height - 65);
  const lineColors = ["#c7f78c", "#c4b5fd", "#90c8f9", "#f3bda0", "#94d4c4"];
  return (
    <div className="evolution">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Ackumulerade poäng per quiz för ligans fem främsta deltagare"
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c7f78c" stopOpacity=".2" />
            <stop offset="100%" stopColor="#c7f78c" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line
              x1="35"
              x2={width - 35}
              y1={y(max * f)}
              y2={y(max * f)}
              stroke="#ffffff12"
              strokeDasharray="4 6"
            />
            <text x="3" y={y(max * f) + 4} fill="#849089" fontSize="11">
              {Math.round(max * f)}
            </text>
          </g>
        ))}
        {rows.map((p, index) => {
          let total = 0;
          const values = league.quizzes.map((q) => {
            total += points(q, p.id);
            return total;
          });
          const coords = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
          return (
            <g key={p.id} opacity={!selected || p.id === selected ? 1 : 0.25}>
              {index === 0 && values.length > 1 && (
                <polygon
                  points={`${x(0)},${y(0)} ${coords} ${x(values.length - 1)},${y(0)}`}
                  fill="url(#chart-fill)"
                />
              )}
              <polyline
                points={coords}
                fill="none"
                stroke={lineColors[index]}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="chart-line"
              />
              {values.map((v, i) => (
                <circle
                  key={i}
                  cx={x(i)}
                  cy={y(v)}
                  r="4"
                  fill={lineColors[index]}
                >
                  <title>
                    {p.name} · {league.quizzes[i].title}: {v} poäng totalt
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
        {league.quizzes.map(
          (q, i) =>
            (count <= 8 || i === 0 || i === count - 1) && (
              <text
                key={q.id}
                x={x(i)}
                y={height - 8}
                textAnchor="middle"
                fill="#849089"
                fontSize="11"
              >
                {formatDate(q.date)}
              </text>
            ),
        )}
      </svg>
      <div className="chart-legend">
        {rows.map((p, i) => (
          <span key={p.id}>
            <i style={{ background: lineColors[i] }} />
            {p.name}
          </span>
        ))}
      </div>
    </div>
  );
}
export default function App() {
  const [league, setLeague] = useState<League>(demo),
    [token, setToken] = useState(""),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<"points" | "rank">("points"),
    [chart, setChart] = useState<"total" | "evolution">("total"),
    [showAll, setShowAll] = useState(false),
    [selected, setSelected] = useState("");
  const [modal, setModal] = useState<"create" | "share" | "quiz" | null>(null),
    [editing, setEditing] = useState<Quiz>(),
    [createTitle, setCreateTitle] = useState("Fredagsligan"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [search, setSearch] = useState(""),
    [activeNav, setActiveNav] = useState("Översikt"),
    [view, setView] = useState<"overview" | "history">("overview");
  const tableRef = useRef<HTMLElement>(null);
  const isDemo = league.id === "demo",
    canEdit = !!token && !isDemo,
    rows = standings(league),
    leader = rows[0],
    lastQuiz = league.quizzes.at(-1),
    chartRows = showAll ? rows : rows.slice(0, 8);
  function notify(message: string) {
    setToast(message);
  }
  function storeToken(id: string, value: string) {
    setToken(value);
    try {
      localStorage.setItem(`quizligan-admin-${id}`, value);
    } catch {
      notify(
        "Spara administratörslänken. Webbläsaren kunde inte spara din nyckel.",
      );
    }
  }
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("liga");
    if (!id) return;
    const provided = new URLSearchParams(location.hash.slice(1)).get("admin");
    if (provided) {
      storeToken(id, provided);
      history.replaceState(
        null,
        "",
        `${location.pathname}?liga=${encodeURIComponent(id)}`,
      );
    } else {
      try {
        setToken(localStorage.getItem(`quizligan-admin-${id}`) || "");
      } catch {
        /* A reader can use the site without local storage. */
      }
    }
    setLoading(true);
    api<League>(`/api/leagues/${encodeURIComponent(id)}`)
      .then(setLeague)
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (isDemo || modal) return;
    let active = true;
    const timer = setInterval(() => {
      if (document.hidden) return;
      void api<League>(`/api/leagues/${league.id}`)
        .then((value) => {
          if (active) {
            setLeague(value);
            setLoadError("");
          }
        })
        .catch(() => {
          if (active)
            setLoadError(
              "Kunde inte uppdatera ligan. Visar senast hämtade resultat.",
            );
        });
    }, 10_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [league.id, modal, isDemo]);
  async function create() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ league: League; adminToken: string }>(
        "/api/leagues",
        "POST",
        { title: createTitle },
      );
      storeToken(result.league.id, result.adminToken);
      setLeague(result.league);
      history.replaceState(
        null,
        "",
        `${location.pathname}?liga=${result.league.id}`,
      );
      setModal("share");
      setLoadError("");
      notify("Din liga är skapad! Spara administratörslänken.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function newQuiz() {
    setError("");
    setEditing(undefined);
    setModal(isDemo ? "create" : "quiz");
  }
  function openShare() {
    setError("");
    setModal(isDemo ? "create" : "share");
  }
  const shareUrl = `${location.origin}${location.pathname}?liga=${league.id}`;
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify("Länken är kopierad!");
    } catch {
      setError(
        "Kopiering stöds inte här. Markera länken och kopiera manuellt.",
      );
    }
  }
  async function deleteQuiz(quiz: Quiz) {
    if (
      !window.confirm(
        `Ta bort ”${quiz.title}”? Poängen tas bort för alla deltagare.`,
      )
    )
      return;
    try {
      setLeague(
        await api<League>(
          `/api/leagues/${league.id}/quizzes/${quiz.id}`,
          "DELETE",
          undefined,
          token,
        ),
      );
      notify("Quizet har tagits bort.");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  if (loading || (loadError && isDemo))
    return (
      <div className="load-screen">
        <span className="brand-mark">
          <Icon name="cup" size={27} />
        </span>
        <h1>{loading ? "Hämtar din liga…" : "Ligan kunde inte öppnas"}</h1>
        {loadError && (
          <>
            <p role="alert">{loadError}</p>
            <button
              className="button primary"
              onClick={() => {
                location.href = location.pathname;
              }}
            >
              Till startsidan
            </button>
          </>
        )}
      </div>
    );
  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href={isDemo ? location.pathname : `?liga=${league.id}`}
        >
          <span className="brand-mark">
            <Icon name="cup" size={23} />
          </span>
          quizligan<span className="brand-dot">.</span>
        </a>
        <nav aria-label="Huvudnavigation">
          {(["Översikt", "Resultat", "Quizhistorik"] as const).map((item) => (
            <button
              key={item}
              className={activeNav === item ? "nav-active" : ""}
              onClick={() => {
                setActiveNav(item);
                setView(item === "Quizhistorik" ? "history" : "overview");
                if (item === "Resultat")
                  setTimeout(
                    () =>
                      tableRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      }),
                    0,
                  );
              }}
            >
              <Icon
                name={
                  item === "Översikt"
                    ? "grid"
                    : item === "Resultat"
                      ? "list"
                      : "calendar"
                }
                size={16}
              />
              {item}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <span className="league-status">
            <i />
            {isDemo ? "Demoliga" : canEdit ? "Administratör" : "Läsbehörighet"}
          </span>
          <button className="button secondary small" onClick={openShare}>
            <Icon name="share" size={16} /> <span>Dela liga</span>
          </button>
        </div>
      </header>
      <main>
        <div className="breadcrumb">
          <span>DIN QUIZLIGA</span>
          <span>/</span>
          {league.title}
        </div>
        <section className="hero">
          <div>
            <div className="eyebrow">
              <span className="tiny-dot" /> VARJE QUIZ RÄKNAS.
            </div>
            <h1>
              {view === "history" ? (
                <>
                  Alla quiz.
                  <br />
                  <span>Alla ögonblick.</span>
                </>
              ) : (
                <>
                  Lite tävling.
                  <br />
                  <span>Mycket laganda.</span>
                </>
              )}
            </h1>
            <p>
              {view === "history"
                ? "Tillbaka till omgångarna som format ligan."
                : "Alla resultat. Alla poäng. En gemensam liga."}
              <br />
              {view === "history"
                ? "Granska, rätta och håll resultaten uppdaterade."
                : "Håll koll på vem som leder – och vem som är på väg upp."}
            </p>
          </div>
          <div className="hero-action">
            <span className="season-label">
              <Icon name="spark" size={15} /> {league.title}
            </span>
            {(canEdit || isDemo) && (
              <button className="button primary" onClick={newQuiz}>
                <Icon name="plus" size={18} />
                {isDemo ? "Skapa din liga" : "Lägg till quiz"}
              </button>
            )}
            <span className="action-note">
              {canEdit
                ? "En resultatbild är allt som behövs."
                : isDemo
                  ? "Samla teamet. Starta något kul."
                  : "Resultaten uppdateras automatiskt."}
            </span>
          </div>
        </section>
        {isDemo && (
          <div className="demo-banner">
            <span>
              <Icon name="spark" size={16} />
              <strong>En smygtitt på din nästa quizliga.</strong> Här visas
              exempeldata.
            </span>
            <button onClick={newQuiz}>
              Skapa egen liga <Icon name="arrow" size={15} />
            </button>
          </div>
        )}
        {loadError && (
          <p className="error" role="alert">
            {loadError}
          </p>
        )}
        <section className="stats" aria-label="Ligans statistik">
          <div className="stat">
            <span className="stat-label">
              DELTAGARE
              <Icon name="people" size={19} />
            </span>
            <strong>
              {league.participants.length}
              <span>/ 35</span>
            </strong>
            <p>En liga, ett team.</p>
          </div>
          <div className="stat">
            <span className="stat-label">
              SPELADE QUIZ
              <Icon name="calendar" size={19} />
            </span>
            <strong>{league.quizzes.length.toString().padStart(2, "0")}</strong>
            <p>
              {lastQuiz
                ? `Senaste: ${formatDate(lastQuiz.date)}`
                : "Dags för premiären!"}
            </p>
          </div>
          <div className="stat">
            <span className="stat-label">
              POÄNG I LIGAN
              <Icon name="spark" size={19} />
            </span>
            <strong>{rows.reduce((sum, p) => sum + p.total, 0)}</strong>
            <p>Varje placering gör skillnad.</p>
          </div>
          <div className="stat leader-stat">
            <span className="stat-label">
              JUST NU I LEDNING
              <Icon name="cup" size={19} />
            </span>
            <strong className="leader-name">
              {leader?.name || "Vem tar täten?"}
            </strong>
            <p>
              {leader
                ? `${leader.total} poäng · ${
                    rows[1] && leader.total > rows[1].total
                      ? `${leader.total - rows[1].total} före tvåan`
                      : rows[1]
                        ? "Delad ledning"
                        : "Ligans första deltagare"
                  }`
                : "Lägg till det första quizet."}
            </p>
          </div>
        </section>
        {view === "overview" ? (
          <>
            <section className="charts-layout" aria-label="Ligans ställning">
              <div className="league-chart">
                <div className="chart-heading">
                  <div>
                    <span className="dark-eyebrow">
                      <span /> LIGAN I SIFFROR
                    </span>
                    <h2>
                      Kampen om toppen<span>.</span>
                    </h2>
                  </div>
                  <div
                    className="chart-switch"
                    role="tablist"
                    aria-label="Grafvy"
                  >
                    <button
                      role="tab"
                      aria-selected={chart === "total"}
                      className={chart === "total" ? "active" : ""}
                      onClick={() => setChart("total")}
                    >
                      Totalpoäng
                    </button>
                    <button
                      role="tab"
                      aria-selected={chart === "evolution"}
                      className={chart === "evolution" ? "active" : ""}
                      onClick={() => setChart("evolution")}
                    >
                      Utveckling
                    </button>
                  </div>
                </div>
                <p className="chart-description">
                  {chart === "total"
                    ? "Varje poäng tar dig närmare förstaplatsen."
                    : "Ackumulerade poäng efter varje quiz · topp 5."}
                </p>
                {!rows.length ? (
                  <div className="chart-empty">
                    <Icon name="cup" size={44} />
                    <h3>Här börjar kampen.</h3>
                    <p>Lägg till första quizet och se ligan ta form.</p>
                    {canEdit && (
                      <button
                        className="button primary small"
                        onClick={newQuiz}
                      >
                        Lägg till första quizet <Icon name="plus" size={16} />
                      </button>
                    )}
                  </div>
                ) : chart === "evolution" ? (
                  <>
                    <Evolution league={league} selected={selected} />
                    <div className="evolution-select">
                      <label htmlFor="chart-person">Lyft fram</label>
                      <select
                        id="chart-person"
                        value={selected}
                        onChange={(e) => setSelected(e.target.value)}
                      >
                        <option value="">Alla i topp 5</option>
                        {rows.slice(0, 5).map((p) => (
                          <option value={p.id} key={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="bars">
                    {chartRows.map((p, i) => (
                      <div
                        className={`bar-row ${i === 0 ? "first" : ""}`}
                        key={p.id}
                        style={{ animationDelay: `${i * 55}ms` }}
                      >
                        <span className="bar-rank">
                          {rows.findIndex((r) => r.total === p.total) + 1}
                        </span>
                        <span className="bar-name">
                          {p.name}
                          {i === 0 && <Icon name="cup" size={13} />}
                        </span>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{
                              width: `${Math.max(2, (p.total / Math.max(1, leader?.total || 1)) * 100)}%`,
                              animationDelay: `${i * 55}ms`,
                            }}
                          >
                            <span />
                          </div>
                        </div>
                        <strong>
                          {p.total}
                          <small>p</small>
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
                <div className="chart-footer">
                  <span>
                    <i />
                    {isDemo
                      ? "Exempeldata"
                      : `${league.quizzes.length} quiz · frånvaro ger 0 poäng`}
                  </span>
                  {rows.length > 8 && chart === "total" ? (
                    <button onClick={() => setShowAll(!showAll)}>
                      {showAll ? "Visa topp 8" : `Visa alla ${rows.length}`}{" "}
                      <Icon name="arrow" size={14} />
                    </button>
                  ) : (
                    <span>Alla quiz räknas</span>
                  )}
                </div>
              </div>
              <aside className="latest-card">
                <div className="latest-heading">
                  <span className="eyebrow">SENASTE OMGÅNGEN</span>
                  <span className="round-icon">
                    <Icon name="calendar" size={18} />
                  </span>
                </div>
                <h2>{lastQuiz?.title || "Nästa stora grej"}</h2>
                <p className="latest-date">
                  {lastQuiz
                    ? `${formatDate(lastQuiz.date)} · ${lastQuiz.results.length} deltagare`
                    : "Det första quizet väntar på er."}
                </p>
                {lastQuiz ? (
                  <>
                    <div className="latest-winner">
                      <span className="winner-medal">
                        <Icon name="cup" size={28} />
                      </span>
                      <span>
                        <small>OMGÅNGENS VINNARE</small>
                        <strong>
                          {
                            league.participants.find(
                              (p) =>
                                p.id ===
                                lastQuiz.results.find((r) => r.rank === 1)
                                  ?.participantId,
                            )?.name
                          }
                        </strong>
                      </span>
                      <span className="winner-points">
                        +{lastQuiz.results.length}
                        <small>poäng</small>
                      </span>
                    </div>
                    <div className="latest-runners">
                      {[...lastQuiz.results]
                        .sort((a, b) => a.rank - b.rank)
                        .slice(1, 5)
                        .map((r) => (
                          <div key={r.participantId}>
                            <span className="mini-rank">
                              {r.rank.toString().padStart(2, "0")}
                            </span>
                            <span>
                              {
                                league.participants.find(
                                  (p) => p.id === r.participantId,
                                )?.name
                              }
                            </span>
                            <strong>
                              +{lastQuiz.results.length - r.rank + 1}
                              <small>p</small>
                            </strong>
                          </div>
                        ))}
                    </div>
                    <button
                      className="latest-link"
                      onClick={() => {
                        setActiveNav("Resultat");
                        tableRef.current?.scrollIntoView({
                          behavior: "smooth",
                        });
                      }}
                    >
                      Se alla resultat <Icon name="arrow" size={17} />
                    </button>
                  </>
                ) : (
                  <div className="latest-empty">
                    <span>01</span>
                    <p>
                      Nya rivaliteter.
                      <br />
                      Nya vinnare.
                      <br />
                      Samma laganda.
                    </p>
                  </div>
                )}
              </aside>
            </section>
            <section className="results-section" ref={tableRef}>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">HELA BILDEN</span>
                  <h2>
                    Alla insatser, på ett ställe<span>.</span>
                  </h2>
                  <p>
                    {tab === "points"
                      ? "Poängen från varje quiz, samlade i en tabell."
                      : "Placeringarna från varje quiz. Ett streck betyder frånvaro."}
                  </p>
                </div>
                <div
                  className="table-switch"
                  role="tablist"
                  aria-label="Tabellvy"
                >
                  <button
                    role="tab"
                    aria-selected={tab === "points"}
                    className={tab === "points" ? "active" : ""}
                    onClick={() => setTab("points")}
                  >
                    Poäng
                  </button>
                  <button
                    role="tab"
                    aria-selected={tab === "rank"}
                    className={tab === "rank" ? "active" : ""}
                    onClick={() => setTab("rank")}
                  >
                    Placering
                  </button>
                </div>
              </div>
              <div className="table-card">
                <div className="table-toolbar">
                  <span>
                    <Icon name="people" size={17} />
                    {league.participants.length} deltagare
                  </span>
                  <input
                    type="search"
                    aria-label="Sök deltagare"
                    value={search}
                    placeholder="Sök deltagare…"
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="table-scroll">
                  <table>
                    <caption className="sr-only">
                      {tab === "points" ? "Poäng" : "Placering"} per quiz och
                      totalt för {league.title}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col" className="participant-col">
                          DELTAGARE
                        </th>
                        {league.quizzes.map((q, i) => (
                          <th scope="col" key={q.id}>
                            <span className="quiz-col-number">
                              QUIZ {String(i + 1).padStart(2, "0")}
                            </span>
                            {q.title}
                            <small>{formatDate(q.date)}</small>
                          </th>
                        ))}
                        <th scope="col" className="total-col">
                          TOTALT<small>poäng</small>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows
                        .filter((p) =>
                          p.name
                            .toLocaleLowerCase("sv")
                            .includes(search.toLocaleLowerCase("sv")),
                        )
                        .map((p) => {
                          const index = rows.findIndex((r) => r.id === p.id);
                          return (
                            <tr key={p.id}>
                              <th scope="row" className="participant-col">
                                <span className="table-rank">
                                  {rows.findIndex((r) => r.total === p.total) +
                                    1}
                                </span>
                                <span
                                  className="avatar"
                                  style={{
                                    background: colors[index % colors.length],
                                  }}
                                >
                                  {initials(p.name)}
                                </span>
                                <span>
                                  {p.name}
                                  {index === 0 && (
                                    <span className="leader-pill">
                                      I ledning
                                    </span>
                                  )}
                                </span>
                              </th>
                              {league.quizzes.map((q) => {
                                const result = q.results.find(
                                  (r) => r.participantId === p.id,
                                );
                                return (
                                  <td key={q.id}>
                                    {tab === "points" ? (
                                      <span
                                        className={
                                          result?.rank === 1
                                            ? "cell-winner"
                                            : result
                                              ? ""
                                              : "cell-absent"
                                        }
                                      >
                                        {points(q, p.id)}
                                      </span>
                                    ) : (
                                      <span
                                        className={
                                          result?.rank === 1
                                            ? "cell-winner"
                                            : result
                                              ? ""
                                              : "cell-absent"
                                        }
                                      >
                                        {result
                                          ? `${result.rank}:${
                                              [1, 2].includes(
                                                result.rank % 10,
                                              ) &&
                                              ![11, 12].includes(
                                                result.rank % 100,
                                              )
                                                ? "a"
                                                : "e"
                                            }`
                                          : "—"}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="total-col">
                                <strong>{p.total}</strong>
                                <small>p</small>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  {(!rows.length ||
                    !rows.some((p) =>
                      p.name
                        .toLocaleLowerCase("sv")
                        .includes(search.toLocaleLowerCase("sv")),
                    )) && (
                    <p className="table-empty">
                      {rows.length
                        ? "Inga deltagare matchar din sökning."
                        : "Tabellen fylls på när det första quizet sparas."}
                    </p>
                  )}
                </div>
                <p className="table-scroll-hint">
                  Svep i tabellen för att se fler quiz →
                </p>
                <div className="table-footnote">
                  <span>
                    <i className="legend-winner" /> Vinnare i omgången
                  </span>
                  <span>
                    {tab === "points" ? "0 = deltog inte" : "— = deltog inte"}
                  </span>
                  <span>Poäng = antal deltagare − placering + 1</span>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="history-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">QUIZHISTORIK</span>
                <h2>{league.quizzes.length} quiz. En gemensam historia.</h2>
              </div>
            </div>
            {[...league.quizzes].reverse().map((q) => (
              <article className="history-card" key={q.id}>
                <span className="round-icon">
                  <Icon name="calendar" />
                </span>
                <div>
                  <h3>{q.title}</h3>
                  <p>
                    {formatDate(q.date)} · {q.results.length} deltagare
                  </p>
                </div>
                <span className="history-winner">
                  <Icon name="cup" size={16} />
                  {
                    league.participants.find(
                      (p) =>
                        p.id ===
                        q.results.find((r) => r.rank === 1)?.participantId,
                    )?.name
                  }
                </span>
                {canEdit && (
                  <div className="history-actions">
                    <button
                      className="button secondary small"
                      onClick={() => {
                        setEditing(q);
                        setError("");
                        setModal("quiz");
                      }}
                    >
                      <Icon name="edit" size={15} />
                      Redigera
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Ta bort ${q.title}`}
                      onClick={() => void deleteQuiz(q)}
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </div>
                )}
              </article>
            ))}
            {!league.quizzes.length && (
              <div className="empty-history">
                <Icon name="calendar" size={32} />
                <p>Inga quiz ännu. Er historia börjar med första omgången.</p>
                {canEdit && (
                  <button className="button primary" onClick={newQuiz}>
                    Lägg till quiz
                  </button>
                )}
              </div>
            )}
          </section>
        )}
        <section className="bottom-note">
          <span className="note-icon">
            <Icon name="spark" size={24} />
          </span>
          <div>
            <strong>Enkelt att räkna. Roligt att tävla.</strong>
            <p>
              10 deltagare? Vinnaren får 10 poäng. Sista plats får 1. Nästa
              quiz, ny chans.
            </p>
          </div>
          <span>Lite vänskaplig rivalitet skadar aldrig.</span>
        </section>
      </main>
      <footer>
        <a
          className="brand footer-brand"
          href={isDemo ? location.pathname : `?liga=${league.id}`}
        >
          <Icon name="cup" size={18} />
          quizligan.
        </a>
        <span>Byggd för teamet. Och lite för vinnarskallen.</span>
        <span>Spela. Samla poäng. Gör det igen.</span>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={17} />
          {toast}
        </div>
      )}
      {modal === "create" && (
        <Modal
          title="Starta er quizliga"
          subtitle="En gemensam plats för teamets alla resultat."
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          <label>
            Ligans namn
            <input
              value={createTitle}
              maxLength={60}
              disabled={busy}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder="Fredagsligan"
            />
          </label>
          <div className="create-info">
            <Icon name="people" size={22} />
            <p>
              Upp till 35 deltagare. Dela läslänken med teamet och behåll
              administratörslänken för att lägga till quiz. Din liga börjar tom
              – exempelresultaten följer inte med.
            </p>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button primary full"
            disabled={busy || !createTitle.trim()}
            onClick={() => void create()}
          >
            {busy ? "Skapar ligan…" : "Skapa liga"}
            <Icon name="arrow" size={18} />
          </button>
        </Modal>
      )}
      {modal === "share" && (
        <Modal
          title="Roligare tillsammans"
          subtitle="Bjud in teamet till ligan."
          onClose={() => setModal(null)}
        >
          <label>
            Läslänk – dela med alla
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <button
            className="button primary full"
            onClick={() => void copy(shareUrl)}
          >
            <Icon name="share" size={17} />
            Kopiera ligalänk
          </button>
          {canEdit && (
            <div className="admin-link">
              <label>
                Administratörslänk – spara privat
                <input
                  readOnly
                  type="password"
                  value={`${shareUrl}#admin=${token}`}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <p>
                Ger rätt att ändra och ta bort resultat. Spara länken säkert;
                utan den kan du inte återställa din behörighet på en annan
                enhet.
              </p>
              <button
                className="button secondary full"
                onClick={() => void copy(`${shareUrl}#admin=${token}`)}
              >
                Kopiera administratörslänk
              </button>
            </div>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <p className="share-note">
            Alla med läslänken kan se deltagarnas namn och resultat. Teamet kan
            öppna länken när sidan är publicerad på en gemensam webbadress.
          </p>
        </Modal>
      )}
      {modal === "quiz" && canEdit && (
        <QuizEditor
          league={league}
          quiz={editing}
          token={token}
          onClose={() => setModal(null)}
          onSave={(updated) => {
            setLeague(updated);
            setModal(null);
            notify(
              editing
                ? "Quizet är uppdaterat. Poängen har räknats om."
                : "Quizet är sparat. Ligan är uppdaterad!",
            );
          }}
        />
      )}
    </div>
  );
}
