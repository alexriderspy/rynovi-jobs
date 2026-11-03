import { mkdir, readFile, writeFile } from "node:fs/promises";
import { COMPANIES } from "./companies.mjs";
import { FLAGS, place, visa } from "./geo.mjs";

const MAX_AGE_DAYS = 45;

const INTERN = /\b(intern|internship|co-?op|summer 20\d\d|winter 20\d\d)\b/i;
const NEW_GRAD = /\b(new grad(uate)?|graduate|university|campus|early[- ]career|entry[- ]level|junior|jr\.?|apprentice|residency|resident|fellow(ship)?|associate (software|engineer|data|ml|machine)|engineer,? i\b|engineer 1\b|(software|ml|data) engineer i\b|level 1|grad\b|20(25|26|27) start|sde[- ]?(1|i)|software development engineer[- ]?(1|i)|(sde|swe|engineer|developer)[- ]1|fresher|freshers|trainee|graduate engineer trainee)\b/i;
const ALWAYS_SENIOR = /\b(senior|sr\.?|staff|principal|lead|leader|manager|management|director|head|vp|vice president|chief|architect|distinguished|expert)\b/i;
const LEVEL_UP = /\b(ii|iii|iv|2|3|4|5)\b/i;
// Chip, circuit and mechanical roles: the site is for ML, AI, software and data.
const HARDWARE = /\b(hardware|electrical|mechanical|asic|rtl|fpga|analog|mixed[- ]signal|rf|silicon|soc|vlsi|layout|pcb|manufacturing|process engineer|chemical|civil|structural|optical|photonics|test engineer|validation engineer|technician)\b/i;
// Chip design stays out even when the title says AI ("GPU & AI Accelerator Hardware Design Intern").
const CHIP_DESIGN = /\b(hardware design|asic|rtl|vlsi|silicon|pcb|fpga|physical design|design verification|analog|circuit)\b/i;
const NOT_TECH = /\b(sales|account (executive|manager)|recruit(er|ing)|marketing|legal|counsel|finance|accounting|payroll|people|hr\b|talent|customer success|support|office|facilities|executive assistant|communications|policy|partnerships|business development|events|content|copywriter|designer)\b/i;

const ML = /\b(machine learning|ml|ai|artificial intelligence|deep learning|llm|nlp|computer vision|perception|research (engineer|scientist)|applied scientist|data scien(ce|tist)|inference|model|training|robotics|autonomy|quant(itative)? research)\b/i;
const DATA = /\b(data (analyst|engineer|engineering|platform)|analytics|business intelligence|quantitative analyst)\b/i;
const SWE = /\b(software|engineer|engineering|developer|sde|swe|backend|back-end|frontend|front-end|full[- ]?stack|infrastructure|platform|mobile|ios|android|security|devops|sre|site reliability|systems|trader|trading|quant)\b/i;
// "Engineer" alone isn't software: a software role names it (bridge, transit or field engineers don't).
const SOFTWARE = /\b(software|developer|programmer|programming|sde|swe|back[- ]?end|front[- ]?end|full[- ]?stack|web|mobile|ios|android|devops|sre|site reliability|cloud|platform|infrastructure engineer|security engineer|cyber ?security|application|api|embedded software|firmware|computer science|game|graphics|compiler|distributed|database|automation engineer|test automation|tools engineer|it engineer|quant(itative)? (developer|engineer|trader|research)|trading|trader)\b/i;
const NOT_SOFTWARE = /\b(construction|civil|bridge|transit|water|wastewater|environmental|geotechnical|industrial|quality engineer|quality engineering|process engineer|process engineering|field service|field engineer|loads|propulsion|structures|thermal|avionics|aerospace|mechanical|manufacturing|production|supply chain|logistics|technician|tech writer|technical writer|manuals|nuclear|chemical|biomedical|clinical|laboratory|lasers?|supportability|resident engineer|building|hvac|power systems|energy|utilities|mining|petroleum|marine|automotive engineer|systems engineering apprentice)\b/i;

const YEARS = /(\d{1,2})\s*\+?\s*(?:-|–|to)?\s*(?:\d{1,2})?\s*\+?\s*years?(?:'|’)?\s*(?:of\s+)?(?:\w+\s+){0,4}?(?:experience|exp\b)/gi;
const NEW_GRAD_TEXT = /\b(new grad(uate)?s?|recent graduates?|graduating in|early[- ]career|0\s*(?:-|–|to)\s*[12]\s*years|no (prior )?experience required|entry[- ]level|freshers?|0\s*(?:-|–|to)\s*1\s*years?)\b/i;


const strip = (html = "") =>
  html
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

function reqYears(text) {
  let min = null;
  for (const m of text.matchAll(YEARS)) {
    const n = Number(m[1]);
    if (n <= 15 && (min === null || n > min)) min = n;
  }
  return min;
}

function classify(title, text) {
  const t = title.replace(/[()|,\-–]/g, " ");
  if (NOT_TECH.test(t) && !ML.test(t)) return null;
  if ((HARDWARE.test(t) && !ML.test(t)) || CHIP_DESIGN.test(t)) return null;
  const isIntern = INTERN.test(t);
  const titleNewGrad = NEW_GRAD.test(t);
  const plain = t.replace(/\b20\d\d\b/g, "");
  if (ALWAYS_SENIOR.test(plain) && !/\b(intern|new grad)\b/i.test(plain)) return null;
  if (LEVEL_UP.test(plain) && !titleNewGrad && !isIntern) return null;
  const yrs = reqYears(text);
  let level = null;
  if (isIntern) level = "intern";
  else if (titleNewGrad) level = yrs !== null && yrs >= 3 ? null : "newgrad";
  else if (NEW_GRAD_TEXT.test(text) && (yrs === null || yrs <= 2)) level = "newgrad";
  else if (yrs !== null && yrs <= 2 && SWE.test(t)) level = "newgrad";
  if (!level) return null;
  if (NOT_SOFTWARE.test(t) && !ML.test(t) && !/\bsoftware\b/i.test(t)) return null;
  const category = ML.test(t) ? "ml" : DATA.test(t) ? "data" : SOFTWARE.test(t) ? "swe" : null;
  if (!category) return null;
  return { level, category, years: yrs };
}


async function getJSON(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { "User-Agent": "Mozilla/5.0 (compatible; rynovi-jobs)", Accept: "application/json" } });
      if (r.ok) return await r.json();
    } catch {
      /* retry */
    }
    await new Promise((res) => setTimeout(res, 1000 * (i + 1)));
  }
  return null;
}

async function fromGreenhouse(c) {
  const j = await getJSON(`https://boards-api.greenhouse.io/v1/boards/${c.token}/jobs?content=true`);
  return (j?.jobs ?? []).map((x) => ({
    id: `gh-${c.token}-${x.id}`,
    title: x.title,
    location: x.location?.name ?? "",
    url: x.absolute_url,
    postedAt: x.first_published || x.updated_at,
    team: x.departments?.[0]?.name ?? "",
    text: strip(x.content)
  }));
}

async function fromLever(c) {
  const j = await getJSON(`https://api.lever.co/v0/postings/${c.token}?mode=json`);
  return (Array.isArray(j) ? j : []).map((x) => ({
    id: `lv-${c.token}-${x.id}`,
    title: x.text,
    location: [x.categories?.location, ...(x.categories?.allLocations ?? [])].filter(Boolean).join(", "),
    url: x.hostedUrl,
    postedAt: new Date(x.createdAt).toISOString(),
    team: x.categories?.team ?? "",
    remote: x.workplaceType === "remote",
    text: `${x.descriptionPlain ?? ""} ${(x.lists ?? []).map((l) => `${l.text} ${strip(l.content)}`).join(" ")} ${x.additionalPlain ?? ""}`
  }));
}

async function fromAshby(c) {
  const j = await getJSON(`https://api.ashbyhq.com/posting-api/job-board/${c.token}`);
  return (j?.jobs ?? [])
    .filter((x) => x.isListed !== false)
    .map((x) => ({
      id: `ab-${c.token}-${x.id}`,
      title: x.title,
      location: [x.location, ...(x.secondaryLocations ?? []).map((l) => l.location)].filter(Boolean).join(", "),
      url: x.jobUrl,
      postedAt: x.publishedAt,
      team: x.department ?? x.team ?? "",
      remote: x.isRemote === true,
      text: x.descriptionPlain ?? strip(x.descriptionHtml)
    }));
}

const WD_TERMS = ["intern", "internship", "graduate", "new grad", "university", "early career", "campus", "fresher", "associate", "entry level"];
// Boards found through discovery get a lighter scan (there are hundreds): the main searches, first page only.
const WD_TERMS_LIGHT = ["intern", "graduate", "university", "entry level"];

async function postJSON(url, body) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
      if (r.ok) return await r.json();
      if (r.status < 500) return null;
    } catch {
      /* retry */
    }
    await new Promise((res) => setTimeout(res, 1000 * (i + 1)));
  }
  return null;
}

async function fromWorkday(c) {
  const [tenant, wd, site] = c.token.split("|");
  const host = `https://${tenant}.${wd}.myworkdayjobs.com`;
  const api = `${host}/wday/cxs/${tenant}/${site}`;
  const seen = new Map();
  for (const term of c.light ? WD_TERMS_LIGHT : WD_TERMS) {
    for (let offset = 0; offset < (c.light ? 20 : 100); offset += 20) {
      const j = await postJSON(`${api}/jobs`, { appliedFacets: {}, limit: 20, offset, searchText: term });
      const posts = j?.jobPostings ?? [];
      for (const p of posts) if (p.externalPath && (INTERN.test(p.title) || NEW_GRAD.test(p.title))) seen.set(p.externalPath, p);
      if (posts.length < 20) break;
    }
  }
  const out = [];
  await pool([...seen.values()], 4, async (p) => {
    const d = (await getJSON(`${api}${p.externalPath}`))?.jobPostingInfo;
    if (!d) return;
    out.push({
      id: `wd-${tenant}-${d.jobReqId ?? p.externalPath}`,
      title: d.title ?? p.title,
      location: [d.location, ...(d.additionalLocations ?? [])].filter(Boolean).join(", ") || p.locationsText,
      url: `${host}/en-US/${site}${p.externalPath}`,
      postedAt: d.startDate ?? new Date().toISOString(),
      team: "",
      remote: /remote/i.test(d.remoteType ?? ""),
      text: strip(d.jobDescription)
    });
  });
  return out;
}

function worthDetail(title) {
  const t = title.replace(/[()|,\-–]/g, " ");
  if (NOT_TECH.test(t) && !ML.test(t)) return false;
  if (ALWAYS_SENIOR.test(t) && !INTERN.test(t)) return false;
  return INTERN.test(t) || NEW_GRAD.test(t) || ML.test(t) || DATA.test(t) || SWE.test(t);
}

async function fromSmartRecruiters(c) {
  const list = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const j = await getJSON(`https://api.smartrecruiters.com/v1/companies/${c.token}/postings?limit=100&offset=${offset}`);
    const page = j?.content ?? [];
    list.push(...page);
    if (page.length < 100) break;
  }
  const out = [];
  await pool(list.filter((p) => p.function?.id !== "sales" && worthDetail(p.name)), 6, async (p) => {
    const d = await getJSON(p.ref);
    if (!d) return;
    const sec = d.jobAd?.sections ?? {};
    const loc = [p.location?.city, p.location?.region, p.location?.country?.toUpperCase() === "IN" ? "India" : p.location?.country].filter(Boolean).join(", ");
    const lvl = p.experienceLevel?.id;
    out.push({
      id: `sr-${c.token}-${p.id}`,
      title: p.name,
      location: loc,
      url: d.postingUrl ?? `https://jobs.smartrecruiters.com/${c.token}/${p.id}`,
      postedAt: p.releasedDate,
      team: p.department?.label ?? "",
      remote: p.location?.remote === true,
      text: `${lvl === "entry_level" ? "entry level" : lvl === "internship" ? "internship" : ""} ${strip(sec.jobDescription?.text)} ${strip(sec.qualifications?.text)}`
    });
  });
  return out;
}

const AMAZON_TERMS = ["SDE I", "software development engineer", "intern", "university", "new grad", "graduate", "applied scientist", "data engineer", "machine learning"];

async function fromAmazon(c) {
  const seen = new Map();
  for (const term of AMAZON_TERMS) {
    for (let offset = 0; offset < 300; offset += 100) {
      const q = new URLSearchParams({ base_query: term, result_limit: "100", offset: String(offset), sort: "recent" });
      q.append("normalized_country_code[]", c.token);
      const j = await getJSON(`https://www.amazon.jobs/en/search.json?${q}`);
      const page = j?.jobs ?? [];
      for (const x of page) seen.set(x.id_icims, x);
      if (page.length < 100) break;
    }
  }
  return [...seen.values()].map((x) => ({
    id: `amz-${x.id_icims}`,
    title: x.title,
    location: x.normalized_location || x.location || "",
    url: `https://www.amazon.jobs${x.job_path}`,
    postedAt: new Date(Date.parse(x.posted_date) || Date.now()).toISOString(),
    team: x.job_category ?? "",
    text: strip(`${x.basic_qualifications ?? ""} ${x.preferred_qualifications ?? ""} ${x.description ?? ""}`)
  }));
}

const MS_TERMS = ["intern", "software engineer", "data scientist", "applied scientist", "research", "new grad", "university", "data engineer"];

async function fromMicrosoft(c) {
  const seen = new Map();
  const base = "https://apply.careers.microsoft.com/api/pcsx";
  for (const term of MS_TERMS) {
    for (let start = 0; start < 100; start += 10) {
      const q = new URLSearchParams({ domain: "microsoft.com", query: term, location: c.token, start: String(start), sort_by: "timestamp" });
      const page = (await getJSON(`${base}/search?${q}`))?.data?.positions ?? [];
      for (const p of page) if (worthDetail(p.name)) seen.set(p.id, p);
      if (page.length < 10) break;
    }
  }
  const out = [];
  await pool([...seen.values()], 4, async (p) => {
    const d = (await getJSON(`${base}/position_details?position_id=${p.id}&domain=microsoft.com`))?.data;
    if (!d) return;
    const intern = /internship/i.test(String(d.efcustomTextEmploymentType ?? ""));
    out.push({
      id: `ms-${p.id}`,
      title: intern && !INTERN.test(p.name) ? `${p.name} (Intern)` : p.name,
      location: (p.locations ?? []).join(", "),
      url: d.publicUrl ?? `https://apply.careers.microsoft.com/careers/job/${p.id}`,
      postedAt: new Date(Number(p.postedTs) * 1000).toISOString(),
      team: p.department ?? "",
      remote: /remote/i.test(String(p.workLocationOption)),
      text: strip(d.jobDescription)
    });
  });
  return out;
}

async function fromAtlassian() {
  const j = await getJSON("https://www.atlassian.com/endpoint/careers/listings");
  return (Array.isArray(j) ? j : [])
    .filter((x) => x.category !== "Sales")
    .map((x) => ({
      id: `atl-${x.id}`,
      title: x.title,
      location: (x.locations ?? []).map((l) => l.replace(/\s+/g, " ").trim()).join(", "),
      url: x.applyUrl || x.portalJobPost?.portalUrl,
      postedAt: x.portalJobPost?.updatedDate ? new Date(x.portalJobPost.updatedDate).toISOString() : new Date().toISOString(),
      team: x.category ?? "",
      remote: (x.locations ?? []).some((l) => /remote/i.test(l)),
      text: strip(`${x.qualifications ?? ""} ${x.responsibilities ?? ""}`)
    }));
}

const FETCH = { greenhouse: fromGreenhouse, lever: fromLever, ashby: fromAshby, workday: fromWorkday, smartrecruiters: fromSmartRecruiters, amazon: fromAmazon, microsoft: fromMicrosoft, atlassian: fromAtlassian };

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    })
  );
  return out;
}

// Our own list first, then the boards found by discover-boards.mjs (the same company is never read twice).
let discovered = [];
try {
  discovered = JSON.parse(await readFile("scripts/boards.json", "utf8")).boards ?? [];
} catch {
  /* not discovered yet */
}
const ALL = [...COMPANIES, ...discovered.map((b) => ({ ...b, domain: "", light: true }))];

// The company's own site, for its logo, when the board doesn't say (career pages often live on it).
const ATS = /(greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|smartrecruiters\.com|workday\.com)$/i;
function siteOf(url) {
  try {
    const host = new URL(url).hostname.replace(/^(www|careers|jobs|boards|job-boards)\./, "");
    return ATS.test(host) ? "" : host;
  } catch {
    return "";
  }
}

const now = Date.now();
const started = Date.now();
const results = await pool(ALL, 10, async (c) => {
  const raw = await FETCH[c.source](c).catch(() => []);
  const jobs = [];
  for (const r of raw) {
    if (!r.title || !r.url) continue;
    const posted = Date.parse(r.postedAt);
    if (!Number.isFinite(posted) || now - posted > MAX_AGE_DAYS * 864e5) continue;
    const cls = classify(r.title, r.text ?? "");
    if (!cls) continue;
    const loc = (r.location || (r.remote ? "Remote" : "")).replace(/\s+/g, " ").trim();
    const where = place(loc, r.remote === true);
    jobs.push({
      id: r.id,
      title: r.title.trim(),
      company: c.name,
      domain: c.domain || siteOf(r.url),
      location: loc,
      countries: where.countries,
      remote: where.remote,
      regions: where.regions,
      ...visa(r.text ?? ""),
      level: cls.level,
      category: cls.category,
      years: cls.years,
      team: r.team,
      url: r.url,
      postedAt: new Date(posted).toISOString()
    });
  }
  return { company: c.name, total: raw.length, kept: jobs.length, jobs };
});

let previous = [];
try {
  previous = JSON.parse(await readFile("public/jobs.json", "utf8")).jobs ?? [];
} catch {
  /* first run */
}
// A company whose board didn't answer this time keeps its earlier jobs (Amazon and Microsoft count as down
// only when every country came back empty).
const up = new Set(results.filter((r) => r.total > 0).map((r) => r.company));
const down = [...new Set(results.map((r) => r.company))].filter((c) => !up.has(c));
const kept = previous.filter((j) => down.includes(j.company) && now - Date.parse(j.postedAt) <= MAX_AGE_DAYS * 864e5);
// One listing per role: boards often post the same opening twice (two requisitions, or two countries'
// Amazon searches). Same company, title and place counts as the same role; the newest stays.
const byRole = new Map();
for (const j of [...results.flatMap((r) => r.jobs), ...kept].sort((a, b) => b.postedAt.localeCompare(a.postedAt))) {
  const k = `${j.company}|${j.title.toLowerCase()}|${j.location.toLowerCase()}`;
  if (!byRole.has(k)) byRole.set(k, j);
}
const jobs = [...byRole.values()];
const out = {
  updatedAt: new Date().toISOString(),
  companies: up.size,
  scanned: results.reduce((a, r) => a + r.total, 0),
  count: jobs.length,
  // For the country picker: every country with roles, most first, with its flag.
  countries: Object.entries(Object.groupBy(jobs.flatMap((j) => j.countries), (c) => c))
    .map(([name, list]) => ({ name, flag: FLAGS[name] ?? "🌍", count: list.length }))
    .sort((a, b) => b.count - a.count),
  jobs
};
await mkdir("public", { recursive: true });
await writeFile("public/jobs.json", JSON.stringify(out));
console.log(`scanned ${out.scanned} jobs at ${out.companies} companies -> kept ${out.count} in ${Math.round((Date.now() - started) / 1000)}s`);
for (const r of results.filter((r) => r.kept).sort((a, b) => b.kept - a.kept).slice(0, 15)) console.log(`  ${r.company}: ${r.kept}/${r.total}`);
if (down.length) console.log(`no data from ${down.length} companies (kept ${kept.length} earlier jobs from them):`, down.slice(0, 30).join(", "));
