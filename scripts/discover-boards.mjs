// Finds more companies to read: the public internship and new grad lists on GitHub (SimplifyJobs) link each role
// to the company's own job board. We keep only which board each company uses (Greenhouse, Lever, Ashby, Workday,
// SmartRecruiters) and then read those boards ourselves in fetch-jobs.mjs, so every listing comes straight from
// the company. Writes scripts/boards.json. Run weekly (the GitHub Action does it on Mondays).
import { writeFile } from "node:fs/promises";
import { COMPANIES } from "./companies.mjs";

const LISTS = [
  "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/.github/scripts/listings.json",
  "https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/.github/scripts/listings.json"
];
// A company counts if it listed an entry-level role in the last six months.
const RECENT = 180 * 864e5;

const BOARD = [
  ["greenhouse", /(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_app\?for=)?([A-Za-z0-9_-]+)/],
  ["lever", /jobs\.(?:eu\.)?lever\.co\/([A-Za-z0-9_.-]+)/],
  ["ashby", /jobs\.ashbyhq\.com\/([^/?#]+)/],
  ["workday", /https:\/\/([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([A-Za-z0-9_-]+)/],
  ["smartrecruiters", /jobs\.smartrecruiters\.com\/([A-Za-z0-9_-]+)/]
];

const key = (source, token) => `${source}:${decodeURIComponent(token).toLowerCase()}`;
const have = new Set(COMPANIES.map((c) => key(c.source, c.token)));
const boards = new Map();

for (const url of LISTS) {
  const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  for (const x of await r.json()) {
    if (!x.active || x.is_visible === false || Date.now() - x.date_posted * 1000 > RECENT || !x.url) continue;
    for (const [source, re] of BOARD) {
      const m = x.url.match(re);
      if (!m) continue;
      const token = source === "workday" ? m.slice(1, 4).join("|") : decodeURIComponent(m[1]);
      const k = key(source, token);
      if (have.has(k) || token.length > 80) break;
      const b = boards.get(k) ?? { source, token, name: String(x.company_name).slice(0, 60), roles: 0 };
      b.roles++;
      boards.set(k, b);
      break;
    }
  }
}

const list = [...boards.values()].sort((a, b) => b.roles - a.roles || a.name.localeCompare(b.name));
await writeFile("scripts/boards.json", JSON.stringify({ updatedAt: new Date().toISOString(), boards: list.map(({ source, token, name }) => ({ source, token, name })) }, null, 1));
console.log(`${list.length} more company boards`, Object.entries(Object.groupBy(list, (b) => b.source)).map(([s, v]) => `${s} ${v.length}`).join(", "));
