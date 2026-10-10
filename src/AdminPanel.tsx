import { useEffect, useState } from "react";
type Item = {id: string; title: string; participants: number; quizzes: number; adminToken: string | null};
class AdminError extends Error { constructor(message: string, public status: number) { super(message); } }
async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/admin/${path}`, {method, credentials: "same-origin", cache: "no-store",
    headers: body ? {"Content-Type": "application/json"} : undefined, body: body ? JSON.stringify(body) : undefined});
  const value = await response.json();
  if (!response.ok) throw new AdminError(value.error || "Förfrågan misslyckades.", response.status);
  return value;
}
export default function AdminPanel({onDeleted, onBusyChange}: {onDeleted: (id: string) => void; onBusyChange: (busy: boolean) => void}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState("");
  const [confirmTitle, setConfirmTitle] = useState("");
  useEffect(() => {
    let active = true;
    request<Item[]>("leagues").then(data => {if (active) setItems(data);}).catch(e => {
      if (active && e.status !== 401) setError(e.message);
    }).finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, []);
  useEffect(() => {onBusyChange(!!busy);return () => onBusyChange(false);}, [busy, onBusyChange]);
  function failure(error: unknown) {
    const e = error as AdminError;
    setError(e.message);
    if (e.status === 401) setItems(null);
  }
  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy("login"); setError("");
    try {await request("session", "POST", {password}); setPassword(""); setItems(await request<Item[]>("leagues"));}
    catch(e) {failure(e);} finally {setBusy("");}
  }
  async function ownerLink(item: Item) {
    setBusy(item.id); setError(""); setMessage("");
    try {
      const result = await request<{adminToken: string}>(`leagues/${item.id}/owner-link`, "POST", {});
      setItems(current => current?.map(row => row.id === item.id ? {...row, adminToken: result.adminToken} : row) || null);
      setMessage("Administratörslänken är skapad. Tidigare administratörslänk har ersatts.");
    } catch(e) {failure(e);} finally {setBusy("");}
  }
  async function remove(item: Item) {
    setBusy(item.id); setError("");
    try {
      await request(`leagues/${item.id}`, "DELETE", {confirmTitle});
      setItems(current => current?.filter(row => row.id !== item.id) || null);
      setDeleting(""); setConfirmTitle(""); setMessage(`Ligan ”${item.title}” är borttagen.`); onDeleted(item.id);
    } catch(e) {failure(e);} finally {setBusy("");}
  }
  async function copy(url: string) {
    try {await navigator.clipboard.writeText(url);setMessage("Länken är kopierad.");}
    catch {setError("Markera länken i fältet och kopiera den manuellt.");}
  }
  if (loading) return <p role="status">Kontrollerar inloggning…</p>;
  if (!items) return <form onSubmit={login} className="admin-login">
    <p>Logga in för att hantera alla ligor på hemsidan.</p>
    <label>Huvudlösenord<input type="password" autoComplete="current-password" value={password} maxLength={128} onChange={e => setPassword(e.target.value)} required disabled={!!busy}/></label>
    {error && <p className="error" role="alert">{error}</p>}
    <button className="button primary full" disabled={!!busy}>{busy ? "Loggar in…" : "Logga in"}</button>
  </form>;
  const visible = items.filter(item => item.title.toLocaleLowerCase("sv").includes(search.toLocaleLowerCase("sv")));
  return <div className="admin-panel">
    <div className="admin-toolbar"><strong>{items.length} skapade ligor</strong><button className="button secondary small" disabled={!!busy} onClick={async () => {
      setBusy("logout");setError("");try {await request("session", "DELETE");setItems(null);setMessage("");}catch(e){failure(e);}finally{setBusy("");}
    }}>Logga ut</button></div>
    <label className="admin-search">Hitta en liga<input type="search" value={search} placeholder="Sök ligans namn…" onChange={e => setSearch(e.target.value)}/></label>
    {error && <p className="error" role="alert">{error}</p>}
    {message && <p className="admin-message" role="status">{message}</p>}
    <div className="admin-leagues">
      {visible.map(item => {
        const readUrl = `${location.origin}/?liga=${item.id}`;
        const adminUrl = item.adminToken ? `${readUrl}#admin=${item.adminToken}` : "";
        return <article className="admin-league" key={item.id}>
          <div className="admin-league-heading"><div><h3>{item.title}</h3><p>{item.quizzes} quiz · {item.participants} deltagare</p><small>Liga-ID: {item.id}</small></div></div>
          <label>Läslänk<input readOnly value={readUrl} onFocus={e => e.target.select()}/></label>
          <div className="admin-link-actions"><a className="button secondary small" href={readUrl} target="_blank" rel="noreferrer">Öppna liga ↗</a><button className="button secondary small" onClick={() => void copy(readUrl)}>Kopiera läslänk</button></div>
          {adminUrl ? <><label>Administratörslänk<input readOnly type="password" value={adminUrl} onFocus={e => e.target.select()}/></label><div className="admin-link-actions"><a className="button secondary small" href={adminUrl} target="_blank" rel="noreferrer">Öppna som administratör ↗</a><button className="button secondary small" onClick={() => void copy(adminUrl)}>Kopiera adminlänk</button></div></> :
            <div className="admin-recover"><p>Den tidigare administratörslänken går inte att återskapa. Skapa en ny som ersätter den gamla.</p><button className="button secondary small" disabled={!!busy} onClick={() => void ownerLink(item)}>Skapa ny administratörslänk</button></div>}
          {deleting === item.id ? <form className="admin-delete-confirm" onSubmit={e => {e.preventDefault();void remove(item);}}>
            <p>Hela ligan och alla dess quiz tas bort permanent. Skriv <strong>{item.title}</strong> för att bekräfta.</p>
            <label>Ligans namn som bekräftelse<input value={confirmTitle} onChange={e => setConfirmTitle(e.target.value)} autoComplete="off" disabled={!!busy}/></label>
            <div className="admin-link-actions"><button className="button danger small" disabled={!!busy || confirmTitle !== item.title}>{busy === item.id ? "Tar bort…" : "Ta bort hela ligan"}</button><button type="button" className="button secondary small" disabled={!!busy} onClick={() => setDeleting("")}>Avbryt</button></div>
          </form> : <button className="admin-delete-trigger" disabled={!!busy} onClick={() => {setDeleting(item.id);setConfirmTitle("");}}>Ta bort liga</button>}
        </article>;
      })}
      {!visible.length && <p>Inga ligor hittades.</p>}
    </div>
  </div>;
}
