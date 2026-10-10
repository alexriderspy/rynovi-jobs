import { mkdir, writeFile } from "node:fs/promises";
import { COMPANIES } from "./companies.mjs";

const MAX_AGE_DAYS = 45;

const INTERN = /\b(intern|internship|co-?op|summer 20\d\d|winter 20\d\d)\b/i;
const NEW_GRAD = /\b(new grad(uate)?|graduate|university|campus|early[- ]career|entry[- ]level|junior|jr\.?|apprentice|residency|resident|fellow(ship)?|associate (software|engineer|data|ml|machine)|engineer,? i\b|engineer 1\b|(software|ml|data) engineer i\b|level 1|grad\b|20(25|26|27) start|sde[- ]?(1|i)|software development engineer[- ]?(1|i)|(sde|swe|engineer|developer)[- ]1|fresher|freshers|trainee|graduate engineer trainee)\b/i;
const ALWAYS_SENIOR = /\b(senior|sr\.?|staff|principal|lead|leader|manager|management|director|head|vp|vice president|chief|architect|distinguished|expert)\b/i;
const LEVEL_UP = /\b(ii|iii|iv|2|3|4|5)\b/i;
const NOT_TECH = /\b(sales|account (executive|manager)|recruit(er|ing)|marketing|legal|counsel|finance|accounting|payroll|people|hr\b|talent|customer success|support|office|facilities|executive assistant|communications|policy|partnerships|business development|events|content|copywriter|designer)\b/i;

const ML = /\b(machine learning|ml|ai|artificial intelligence|deep learning|llm|nlp|computer vision|perception|research (engineer|scientist)|applied scientist|data scien(ce|tist)|inference|model|training|robotics|autonomy|quant(itative)? research)\b/i;
const DATA = /\b(data (analyst|engineer|engineering|platform)|analytics|business intelligence|quantitative analyst)\b/i;
const SWE = /\b(software|engineer|engineering|developer|sde|swe|backend|back-end|frontend|front-end|full[- ]?stack|infrastructure|platform|mobile|ios|android|security|devops|sre|site reliability|systems|trader|trading|quant)\b/i;

const YEARS = /(\d{1,2})\s*\+?\s*(?:-|–|to)?\s*(?:\d{1,2})?\s*\+?\s*years?(?:'|’)?\s*(?:of\s+)?(?:\w+\s+){0,4}?(?:experience|exp\b)/gi;
const NEW_GRAD_TEXT = /\b(new grad(uate)?s?|recent graduates?|graduating in|early[- ]career|0\s*(?:-|–|to)\s*[12]\s*years|no (prior )?experience required|entry[- ]level|freshers?|0\s*(?:-|–|to)\s*1\s*years?)\b/i;

const REGIONS = [
  ["India", /\b(india|bengaluru|bangalore|hyderabad|pune|mumbai|delhi|gurgaon|gurugram|noida|chennai|kolkata|ahmedabad)\b/i],
  ["Canada", /\b(canada|toronto|vancouver|montreal|ontario|waterloo|ottawa|calgary)\b/i],
  ["Europe", /\b(london|united kingdom|uk|england|scotland|glasgow|edinburgh|manchester|belfast|canary wharf|knutsford|northampton|germany|berlin|munich|frankfurt|paris|france|amsterdam|netherlands|dublin|ireland|zurich|switzerland|spain|madrid|barcelona|europe|emea|poland|pol|warsaw|krak[oó]w|stockholm|sweden|copenhagen|denmark|lisbon|portugal|milan|milano|italy|prague|czech|belgium|brussels|bucharest|romania|greece|athens|bulgaria|sofia|luxembourg|vienna|austria|budapest|hungary|helsinki|finland|oslo|norway)\b/i],
  ["Asia-Pacific", /\b(singapore|tokyo|japan|sydney|australia|seoul|korea|hong kong|apac|melbourne|taiwan|taipei|hsinchu|china|prc|shanghai|beijing|chengdu|shenzhen|malaysia|penang|kulim|kuala lumpur|vietnam|hanoi|ho chi minh|philippines|manila|indonesia|jakarta|thailand|bangkok)\b/i],
  ["Latin America", /\b(mexico|jalisco|brazil|s[aã]o paulo|costa rica|heredia|argentina|buenos aires|colombia|bogot[aá]|chile|santiago|peru|lima)\b/i],
  ["Middle East", /\b(qatar|doha|israel|tel aviv|haifa|dubai|uae|abu dhabi|saudi|riyadh)\b/i],
  ["US", /\b(united states|usa|u\.s\.|us\b|new york|nyc|san francisco|sf|bay area|seattle|austin|boston|chicago|los angeles|denver|atlanta|miami|palo alto|mountain view|menlo park|sunnyvale|san jose|santa clara|redmond|washington|dc|california|texas|ca|ny|wa|ma|co|il|nj|new jersey|whippany|missouri|o'fallon|oregon|hillsboro|arizona|phoenix|chandler|virginia|carolina|raleigh|pittsburgh|pennsylvania|utah|salt lake|colorado|minnesota|ohio|michigan|georgia|florida|tennessee|nashville)\b/i]
];

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
  const category = ML.test(t) ? "ml" : DATA.test(t) ? "data" : SWE.test(t) ? "swe" : null;
  if (!category) return null;
  return { level, category, years: yrs };
}

function region(loc) {
  const out = /\bIND\b/.test(loc) ? ["India"] : [];
  for (const [name, re] of REGIONS) if (re.test(loc) && !out.includes(name)) out.push(name);
  return out.length ? out : ["Other"];
}

async function getJSON(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { "User-Agent": "proofpal-jobs (+https://github.com/alexriderspy)" } });
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
  for (const term of WD_TERMS) {
    for (let offset = 0; offset < 100; offset += 20) {
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

const FETCH = { greenhouse: fromGreenhouse, lever: fromLever, ashby: fromAshby, workday: fromWorkday };

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

const now = Date.now();
const results = await pool(COMPANIES, 8, async (c) => {
  const raw = await FETCH[c.source](c).catch(() => []);
  const jobs = [];
  for (const r of raw) {
    if (!r.title || !r.url) continue;
    const posted = Date.parse(r.postedAt);
    if (!Number.isFinite(posted) || now - posted > MAX_AGE_DAYS * 864e5) continue;
    const cls = classify(r.title, r.text ?? "");
    if (!cls) continue;
    const loc = r.location || (r.remote ? "Remote" : "");
    jobs.push({
      id: r.id,
      title: r.title.trim(),
      company: c.name,
      domain: c.domain,
      location: loc,
      remote: r.remote === true || /\bremote\b/i.test(loc),
      regions: region(loc),
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

const jobs = results.flatMap((r) => r.jobs).sort((a, b) => b.postedAt.localeCompare(a.postedAt));
const out = {
  updatedAt: new Date().toISOString(),
  companies: results.filter((r) => r.total > 0).length,
  scanned: results.reduce((a, r) => a + r.total, 0),
  count: jobs.length,
  jobs
};
await mkdir("public", { recursive: true });
await writeFile("public/jobs.json", JSON.stringify(out));
console.log(`scanned ${out.scanned} jobs at ${out.companies} companies -> kept ${out.count}`);
for (const r of results.filter((r) => r.kept).sort((a, b) => b.kept - a.kept).slice(0, 15)) console.log(`  ${r.company}: ${r.kept}/${r.total}`);
const failed = results.filter((r) => r.total === 0).map((r) => r.company);
if (failed.length) console.log("no data from:", failed.join(", "));
