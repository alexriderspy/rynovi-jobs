import { useEffect, useMemo, useState } from "react";

type Job = {
  id: string;
  title: string;
  company: string;
  domain: string;
  location: string;
  remote: boolean;
  regions: string[];
  level: "newgrad" | "intern";
  category: "ml" | "swe" | "data";
  years: number | null;
  team: string;
  url: string;
  postedAt: string;
};

type Data = { updatedAt: string; companies: number; scanned: number; count: number; jobs: Job[] };

const PROOFPAL = "https://proofpal-eight.vercel.app";
const LEVELS = [["all", "All"], ["newgrad", "New grad"], ["intern", "Internships"]] as const;
const CATS = [["all", "All roles"], ["ml", "ML & AI"], ["swe", "Software"], ["data", "Data"]] as const;
const REGIONS = ["Anywhere", "Remote", "India", "US", "Europe", "Canada", "Asia-Pacific", "Latin America"];
const AGES = [["any", "Any time"], ["1", "24 hours"], ["3", "3 days"], ["7", "7 days"]] as const;
const PAGE = 40;

function ago(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 60) return `${m || 1}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

function useParam(key: string, fallback: string) {
  const [v, setV] = useState(() => new URLSearchParams(location.search).get(key) ?? fallback);
  useEffect(() => {
    const u = new URL(location.href);
    if (v === fallback) u.searchParams.delete(key);
    else u.searchParams.set(key, v);
    history.replaceState(null, "", u);
  }, [key, v, fallback]);
  return [v, setV] as const;
}

function useSet(key: string) {
  const [s, setS] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
    } catch {
      return new Set();
    }
  });
  const toggle = (id: string) =>
    setS((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      try {
        localStorage.setItem(key, JSON.stringify([...n]));
      } catch {
        /* storage unavailable */
      }
      return n;
    });
  return [s, toggle] as const;
}

function Pal({ size = 56 }: { size?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden="true" className="pal">
      <ellipse cx="100" cy="188" rx="54" ry="8" fill="#000" opacity="0.12" />
      <line x1="100" y1="70" x2="100" y2="48" stroke="#8D95EC" strokeWidth="5" strokeLinecap="round" />
      <circle cx="100" cy="44" r="8" fill="#FF8A3D" />
      <ellipse cx="74" cy="178" rx="16" ry="9" fill="#8D95EC" />
      <ellipse cx="126" cy="178" rx="16" ry="9" fill="#8D95EC" />
      <ellipse cx="100" cy="126" rx="62" ry="56" fill="#A3ABF7" />
      <ellipse cx="100" cy="146" rx="38" ry="30" fill="#FBEBDC" />
      <ellipse cx="78" cy="114" rx="9" ry="12" fill="#1C1B3A" />
      <ellipse cx="122" cy="114" rx="9" ry="12" fill="#1C1B3A" />
      <circle cx="81" cy="109" r="3.2" fill="#fff" />
      <circle cx="125" cy="109" r="3.2" fill="#fff" />
      <ellipse cx="64" cy="132" rx="9" ry="5" fill="#F58FAE" opacity="0.7" />
      <ellipse cx="136" cy="132" rx="9" ry="5" fill="#F58FAE" opacity="0.7" />
      <path d="M92 128 Q100 136 108 128" fill="none" stroke="#1C1B3A" strokeWidth="3" strokeLinecap="round" />
      <rect x="128" y="132" width="40" height="30" rx="5" fill="#8A5A3B" />
      <rect x="140" y="126" width="16" height="8" rx="3" fill="none" stroke="#8A5A3B" strokeWidth="4" />
    </svg>
  );
}

function Chips<T extends string>({ value, options, onChange }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="chips" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} role="radio" aria-checked={value === v} className={"chip" + (value === v ? " on" : "")} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Logo({ domain, name }: { domain: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span className="logo fallback">{name[0]}</span>
  ) : (
    <img className="logo" src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="" loading="lazy" onError={() => setFailed(true)} />
  );
}

export default function App() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useParam("q", "");
  const [level, setLevel] = useParam("level", "all");
  const [cat, setCat] = useParam("role", "all");
  const [region, setRegion] = useParam("where", "Anywhere");
  const [age, setAge] = useParam("posted", "any");
  const [tab, setTab] = useParam("tab", "all");
  const [saved, toggleSaved] = useSet("ppjobs:saved");
  const [applied, toggleApplied] = useSet("ppjobs:applied");
  const [shown, setShown] = useState(PAGE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    fetch(`/jobs.json?t=${Math.floor(Date.now() / 300000)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  useEffect(() => setShown(PAGE), [q, level, cat, region, age, tab]);

  const jobs = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    const maxAge = age === "any" ? Infinity : Number(age) * 864e5;
    return data.jobs.filter(
      (j) =>
        (tab !== "saved" || saved.has(j.id)) &&
        (level === "all" || j.level === level) &&
        (cat === "all" || j.category === cat) &&
        (region === "Anywhere" || (region === "Remote" ? j.remote : j.regions.includes(region))) &&
        Date.now() - Date.parse(j.postedAt) <= maxAge &&
        (!needle || `${j.title} ${j.company} ${j.location} ${j.team}`.toLowerCase().includes(needle))
    );
  }, [data, q, level, cat, region, age, tab, saved]);

  const fresh = data ? data.jobs.filter((j) => Date.now() - Date.parse(j.postedAt) < 864e5).length : 0;
  const activeFilters = [level !== "all", cat !== "all", region !== "Anywhere", age !== "any"].filter(Boolean).length;
  const reset = () => {
    setLevel("all");
    setCat("all");
    setRegion("Anywhere");
    setAge("any");
    setQ("");
  };

  const filters = (
    <>
      <div className="filter-group">
        <span className="label">Level</span>
        <Chips value={level} options={LEVELS} onChange={setLevel} />
      </div>
      <div className="filter-group">
        <span className="label">Role</span>
        <Chips value={cat} options={CATS} onChange={setCat} />
      </div>
      <div className="filter-group">
        <span className="label">Where</span>
        <Chips value={region} options={REGIONS.map((r) => [r, r] as const)} onChange={setRegion} />
      </div>
      <div className="filter-group">
        <span className="label">Posted</span>
        <Chips value={age} options={AGES} onChange={setAge} />
      </div>
      {activeFilters > 0 && (
        <button className="link" onClick={reset}>
          Clear filters
        </button>
      )}
    </>
  );

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-inner">
          <a className="brand" href={PROOFPAL}>
            <Pal size={40} />
            <b>ProofPal</b>
            <span className="brand-tag">Jobs</span>
          </a>
          <h1>
            Fresh entry-level tech jobs.
            <br />
            <span className="accent">0–2 years. No promoted listings.</span>
          </h1>
          <p className="sub">New grad roles and internships in ML, AI, software and data, pulled straight from company career pages every hour. You apply on the company's own site.</p>
          {data && (
            <div className="stats">
              <span className="stat">
                <i className="dot" /> Updated {ago(data.updatedAt)}
              </span>
              <span className="stat">
                <b>{data.count}</b> open roles
              </span>
              <span className="stat">
                <b>{fresh}</b> new today
              </span>
              <span className="stat">
                <b>{data.companies}</b> companies
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="layout">
        <aside className="side">{filters}</aside>

        <main className="main">
          <div className="toolbar">
            <div className="search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search role, company or city" aria-label="Search jobs" />
            </div>
            <button className="filter-btn" onClick={() => setFiltersOpen(true)}>
              Filters{activeFilters ? ` · ${activeFilters}` : ""}
            </button>
          </div>

          <div className="tabs">
            <Chips value={tab} options={[["all", "All jobs"], ["saved", `Saved · ${saved.size}`]] as const} onChange={setTab} />
            {data && <span className="count">{jobs.length} roles</span>}
          </div>

          {error && <div className="empty">Couldn't load jobs right now. Refresh in a minute.</div>}
          {!data && !error && (
            <div className="list">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="card skeleton" />
              ))}
            </div>
          )}
          {data && jobs.length === 0 && (
            <div className="empty">
              <Pal size={90} />
              <b>{tab === "saved" ? "No saved jobs yet" : "No roles match these filters"}</b>
              <span>{tab === "saved" ? "Tap the bookmark on any job to keep it here." : "Try a wider region or time range."}</span>
              {tab !== "saved" && activeFilters > 0 && (
                <button className="btn ghost" onClick={reset}>
                  Clear filters
                </button>
              )}
            </div>
          )}

          <div className="list">
            {jobs.slice(0, shown).map((j) => {
              const isNew = Date.now() - Date.parse(j.postedAt) < 864e5;
              const isApplied = applied.has(j.id);
              return (
                <article key={j.id} className={"card" + (isApplied ? " applied" : "")}>
                  <Logo domain={j.domain} name={j.company} />
                  <div className="card-body">
                    <div className="card-top">
                      <span className="company">{j.company}</span>
                      {isNew && <span className="badge new">New</span>}
                      <span className="when">{ago(j.postedAt)}</span>
                    </div>
                    <h2 className="title">{j.title}</h2>
                    <div className="meta">
                      <span className={"badge " + j.level}>{j.level === "intern" ? "Internship" : "New grad"}</span>
                      <span className={"badge cat-" + j.category}>{j.category === "ml" ? "ML & AI" : j.category === "data" ? "Data" : "Software"}</span>
                      {j.remote && <span className="badge remote">Remote</span>}
                      {j.years !== null && j.level !== "intern" && <span className="badge">{j.years === 0 ? "0 yrs" : `${j.years} yr${j.years > 1 ? "s" : ""}`}</span>}
                      <span className="loc">{j.location || "Location not listed"}</span>
                    </div>
                  </div>
                  <div className="actions">
                    <button className={"icon" + (saved.has(j.id) ? " on" : "")} onClick={() => toggleSaved(j.id)} aria-label={saved.has(j.id) ? "Remove from saved" : "Save job"} aria-pressed={saved.has(j.id)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill={saved.has(j.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
                        <path d="M6 3h12v18l-6-4-6 4z" />
                      </svg>
                    </button>
                    <a
                      className="btn apply"
                      href={j.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => {
                        if (!isApplied) toggleApplied(j.id);
                      }}
                    >
                      {isApplied ? "Opened ✓" : "Apply ↗"}
                    </a>
                  </div>
                </article>
              );
            })}
          </div>

          {jobs.length > shown && (
            <button className="btn ghost more" onClick={() => setShown((s) => s + PAGE)}>
              Show more ({jobs.length - shown} left)
            </button>
          )}

          <section className="how">
            <h3>How this works</h3>
            <p>Every hour we read the official job boards of {data?.companies ?? "90+"} tech companies and keep only new grad roles, internships and jobs asking for 0–2 years of experience. Nobody pays to be listed. Always apply on the company's own page.</p>
            <a className="btn primary" href={PROOFPAL}>
              Learn ML in 60 days with ProofPal →
            </a>
          </section>
        </main>
      </div>

      {filtersOpen && (
        <div className="sheet-backdrop" onClick={() => setFiltersOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Filters">
            <div className="sheet-head">
              <b>Filters</b>
              <button className="link" onClick={() => setFiltersOpen(false)}>
                Done
              </button>
            </div>
            {filters}
            <button className="btn primary full" onClick={() => setFiltersOpen(false)}>
              Show {jobs.length} roles
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
