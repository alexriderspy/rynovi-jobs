// Where a job is: the countries in its location text, and whether it's remote.
// Location strings come in every shape ("San Francisco, CA", "Toronto, ON, CAN", "Remote in USA",
// "London; Berlin", "Bengaluru, Karnataka, India"), so we look for every country, region or city we know.

// [country, flag, pattern of names, states and cities that mean it]
const COUNTRIES = [
  ["India", "🇮🇳", /\b(india|ind|bengaluru|bangalore|hyderabad|pune|mumbai|delhi|new delhi|gurgaon|gurugram|noida|chennai|kolkata|ahmedabad|karnataka|telangana|maharashtra|tamil nadu|haryana|kochi|jaipur|indore|coimbatore|thiruvananthapuram|trivandrum|mohali|chandigarh)\b/i],
  ["United States", "🇺🇸", /\b(united states( of america)?|usa|u\.s\.a?\.?|us|new york|nyc|san francisco|sf|bay area|silicon valley|seattle|austin|boston|chicago|los angeles|denver|atlanta|miami|palo alto|mountain view|menlo park|sunnyvale|san jose|santa clara|san mateo|redwood city|cupertino|redmond|bellevue|washington,? d\.?c\.?|california|texas|new jersey|massachusetts|illinois|pennsylvania|virginia|north carolina|south carolina|georgia, us|colorado|oregon|arizona|utah|michigan|ohio|minnesota|wisconsin|florida|tennessee|missouri|maryland|connecticut|indiana|kentucky|louisiana|alabama|iowa|kansas|nebraska|nevada|new mexico|oklahoma|idaho|montana|vermont|new hampshire|rhode island|delaware|hawaii|alaska|arkansas|mississippi|west virginia|wyoming|north dakota|south dakota|maine|pittsburgh|philadelphia|raleigh|durham|charlotte|nashville|dallas|houston|san diego|irvine|sacramento|portland|salt lake|phoenix|chandler|tempe|scottsdale|detroit|ann arbor|columbus|cleveland|cincinnati|minneapolis|st\.? louis|kansas city|baltimore|tampa|orlando|jersey city|hoboken|cambridge, ma|somerville|waltham|princeton|reston|arlington|mclean|herndon|plano|irving|boulder|lehi|provo|hillsboro|beaverton|madison|indianapolis|richmond|new orleans|las vegas|honolulu|whippany|o'fallon|washington|georgia)\b/i],
  ["Canada", "🇨🇦", /\b(canada|can|toronto|vancouver|montr[eé]al|ontario|british columbia|qu[eé]bec|alberta|manitoba|saskatchewan|nova scotia|new brunswick|waterloo|kitchener|ottawa|calgary|edmonton|winnipeg|halifax|victoria, bc|mississauga|markham|burnaby|hamilton, on)\b/i],
  ["United Kingdom", "🇬🇧", /\b(united kingdom|uk|u\.k\.|great britain|britain|england|scotland|wales|northern ireland|london|manchester|edinburgh|glasgow|cambridge, uk|oxford|bristol|birmingham|leeds|belfast|reading|canary wharf|knutsford|northampton|sheffield|nottingham|newcastle|liverpool|cardiff|brighton|milton keynes|guildford|guernsey|jersey, uk)\b/i],
  ["Ireland", "🇮🇪", /\b(ireland|dublin|cork|galway|limerick)\b/i],
  ["Germany", "🇩🇪", /\b(germany|deutschland|berlin|munich|m[uü]nchen|frankfurt|hamburg|cologne|k[oö]ln|stuttgart|d[uü]sseldorf|heidelberg|karlsruhe|walldorf|dresden|leipzig|nuremberg|n[uü]rnberg|bavaria|bayern)\b/i],
  ["France", "🇫🇷", /\b(france|paris|lyon|toulouse|grenoble|nice|sophia antipolis|marseille|bordeaux|lille|nantes)\b/i],
  ["Netherlands", "🇳🇱", /\b(netherlands|holland|amsterdam|rotterdam|eindhoven|utrecht|the hague|delft|leiden)\b/i],
  ["Switzerland", "🇨🇭", /\b(switzerland|zurich|z[uü]rich|geneva|gen[eè]ve|basel|lausanne|bern|zug)\b/i],
  ["Spain", "🇪🇸", /\b(spain|espa[ñn]a|madrid|barcelona|valencia|seville|sevilla|malaga|m[aá]laga)\b/i],
  ["Portugal", "🇵🇹", /\b(portugal|lisbon|lisboa|porto|braga)\b/i],
  ["Italy", "🇮🇹", /\b(italy|italia|milan|milano|rome|roma|turin|torino|bologna)\b/i],
  ["Poland", "🇵🇱", /\b(poland|polska|warsaw|warszawa|krak[oó]w|cracow|wroc[lł]aw|gda[nń]sk|pozna[nń]|[lł][oó]d[zź])\b/i],
  ["Sweden", "🇸🇪", /\b(sweden|stockholm|gothenburg|g[oö]teborg|malm[oö]|lund)\b/i],
  ["Denmark", "🇩🇰", /\b(denmark|copenhagen|k[oø]benhavn|aarhus)\b/i],
  ["Norway", "🇳🇴", /\b(norway|oslo|bergen|trondheim)\b/i],
  ["Finland", "🇫🇮", /\b(finland|helsinki|espoo|tampere|oulu)\b/i],
  ["Belgium", "🇧🇪", /\b(belgium|brussels|antwerp|ghent|leuven)\b/i],
  ["Austria", "🇦🇹", /\b(austria|vienna|wien|graz|linz)\b/i],
  ["Czechia", "🇨🇿", /\b(czechia|czech republic|prague|praha|brno)\b/i],
  ["Romania", "🇷🇴", /\b(romania|bucharest|bucure[sș]ti|cluj|ia[sș]i|timi[sș]oara)\b/i],
  ["Hungary", "🇭🇺", /\b(hungary|budapest)\b/i],
  ["Greece", "🇬🇷", /\b(greece|athens|thessaloniki)\b/i],
  ["Bulgaria", "🇧🇬", /\b(bulgaria|sofia)\b/i],
  ["Estonia", "🇪🇪", /\b(estonia|tallinn|tartu)\b/i],
  ["Lithuania", "🇱🇹", /\b(lithuania|vilnius|kaunas)\b/i],
  ["Serbia", "🇷🇸", /\b(serbia|belgrade|novi sad)\b/i],
  ["Ukraine", "🇺🇦", /\b(ukraine|kyiv|kiev|lviv|kharkiv)\b/i],
  ["Armenia", "🇦🇲", /\b(armenia|yerevan)\b/i],
  ["Luxembourg", "🇱🇺", /\b(luxembourg)\b/i],
  ["Israel", "🇮🇱", /\b(israel|tel aviv|haifa|jerusalem|herzliya|petah tikva)\b/i],
  ["United Arab Emirates", "🇦🇪", /\b(united arab emirates|uae|dubai|abu dhabi)\b/i],
  ["Saudi Arabia", "🇸🇦", /\b(saudi arabia|saudi|riyadh|jeddah)\b/i],
  ["Qatar", "🇶🇦", /\b(qatar|doha)\b/i],
  ["Turkey", "🇹🇷", /\b(turkey|t[uü]rkiye|istanbul|ankara)\b/i],
  ["Egypt", "🇪🇬", /\b(egypt|cairo)\b/i],
  ["Nigeria", "🇳🇬", /\b(nigeria|lagos|abuja)\b/i],
  ["Kenya", "🇰🇪", /\b(kenya|nairobi)\b/i],
  ["South Africa", "🇿🇦", /\b(south africa|cape town|johannesburg)\b/i],
  ["Singapore", "🇸🇬", /\b(singapore)\b/i],
  ["Japan", "🇯🇵", /\b(japan|tokyo|osaka|kyoto|yokohama)\b/i],
  ["South Korea", "🇰🇷", /\b(south korea|korea|seoul|pangyo)\b/i],
  ["China", "🇨🇳", /\b(china|prc|shanghai|beijing|shenzhen|hangzhou|chengdu|guangzhou|suzhou|nanjing|wuhan)\b/i],
  ["Hong Kong", "🇭🇰", /\b(hong kong)\b/i],
  ["Taiwan", "🇹🇼", /\b(taiwan|taipei|hsinchu|taichung)\b/i],
  ["Australia", "🇦🇺", /\b(australia|sydney|melbourne|brisbane|perth|adelaide|canberra|nsw|victoria, au)\b/i],
  ["New Zealand", "🇳🇿", /\b(new zealand|auckland|wellington|christchurch)\b/i],
  ["Malaysia", "🇲🇾", /\b(malaysia|kuala lumpur|penang|kulim|cyberjaya)\b/i],
  ["Indonesia", "🇮🇩", /\b(indonesia|jakarta|bandung)\b/i],
  ["Philippines", "🇵🇭", /\b(philippines|manila|makati|cebu|taguig)\b/i],
  ["Vietnam", "🇻🇳", /\b(vietnam|viet nam|hanoi|ho chi minh|saigon|da nang)\b/i],
  ["Thailand", "🇹🇭", /\b(thailand|bangkok)\b/i],
  ["Pakistan", "🇵🇰", /\b(pakistan|karachi|lahore|islamabad)\b/i],
  ["Bangladesh", "🇧🇩", /\b(bangladesh|dhaka)\b/i],
  ["Sri Lanka", "🇱🇰", /\b(sri lanka|colombo)\b/i],
  ["Mexico", "🇲🇽", /\b(mexico|m[eé]xico|guadalajara|monterrey|jalisco|cdmx)\b/i],
  ["Brazil", "🇧🇷", /\b(brazil|brasil|s[aã]o paulo|rio de janeiro|belo horizonte|campinas|florian[oó]polis|curitiba)\b/i],
  ["Argentina", "🇦🇷", /\b(argentina|buenos aires|c[oó]rdoba, ar)\b/i],
  ["Colombia", "🇨🇴", /\b(colombia|bogot[aá]|medell[ií]n)\b/i],
  ["Chile", "🇨🇱", /\b(chile|santiago)\b/i],
  ["Peru", "🇵🇪", /\b(peru|per[uú]|lima)\b/i],
  ["Costa Rica", "🇨🇷", /\b(costa rica|heredia|san jos[eé], cr)\b/i]
];

// Two-letter codes after a comma: US states and Canadian provinces ("Austin, TX", "Toronto, ON").
const US_STATES = new Set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" "));
const CA_PROVINCES = new Set("ON BC QC AB MB SK NS NB NL PE".split(" "));

export const FLAGS = Object.fromEntries(COUNTRIES.map(([name, flag]) => [name, flag]));

// Broad regions, for the "elsewhere" search links and older clients that read `regions`.
const REGION_OF = {
  India: "India",
  "United States": "US",
  Canada: "Canada",
  ...Object.fromEntries(["United Kingdom", "Ireland", "Germany", "France", "Netherlands", "Switzerland", "Spain", "Portugal", "Italy", "Poland", "Sweden", "Denmark", "Norway", "Finland", "Belgium", "Austria", "Czechia", "Romania", "Hungary", "Greece", "Bulgaria", "Estonia", "Lithuania", "Serbia", "Ukraine", "Armenia", "Luxembourg"].map((c) => [c, "Europe"])),
  ...Object.fromEntries(["Singapore", "Japan", "South Korea", "China", "Hong Kong", "Taiwan", "Australia", "New Zealand", "Malaysia", "Indonesia", "Philippines", "Vietnam", "Thailand", "Pakistan", "Bangladesh", "Sri Lanka"].map((c) => [c, "Asia-Pacific"])),
  ...Object.fromEntries(["Israel", "United Arab Emirates", "Saudi Arabia", "Qatar", "Turkey", "Egypt"].map((c) => [c, "Middle East"])),
  ...Object.fromEntries(["Mexico", "Brazil", "Argentina", "Colombia", "Chile", "Peru", "Costa Rica"].map((c) => [c, "Latin America"])),
  ...Object.fromEntries(["Nigeria", "Kenya", "South Africa"].map((c) => [c, "Africa"]))
};

// Country codes, as Workday and others write them: "GBR", "GB - Luton", "Petaling Jaya, my", "CA-QC-Longueuil".
const CODES = {
  IN: "India", IND: "India", US: "United States", USA: "United States", CA: "Canada", CAN: "Canada", GB: "United Kingdom", GBR: "United Kingdom", UK: "United Kingdom",
  IE: "Ireland", IRL: "Ireland", DE: "Germany", DEU: "Germany", FR: "France", FRA: "France", NL: "Netherlands", NLD: "Netherlands", CH: "Switzerland", CHE: "Switzerland",
  ES: "Spain", ESP: "Spain", PT: "Portugal", PRT: "Portugal", IT: "Italy", ITA: "Italy", PL: "Poland", POL: "Poland", SE: "Sweden", SWE: "Sweden", DK: "Denmark", DNK: "Denmark",
  NO: "Norway", NOR: "Norway", FI: "Finland", FIN: "Finland", BE: "Belgium", BEL: "Belgium", AT: "Austria", AUT: "Austria", CZ: "Czechia", CZE: "Czechia", RO: "Romania", ROU: "Romania",
  HU: "Hungary", HUN: "Hungary", GR: "Greece", GRC: "Greece", IL: "Israel", ISR: "Israel", AE: "United Arab Emirates", ARE: "United Arab Emirates", SG: "Singapore", SGP: "Singapore",
  JP: "Japan", JPN: "Japan", KR: "South Korea", KOR: "South Korea", CN: "China", CHN: "China", HK: "Hong Kong", HKG: "Hong Kong", TW: "Taiwan", TWN: "Taiwan", AU: "Australia", AUS: "Australia",
  NZ: "New Zealand", NZL: "New Zealand", MY: "Malaysia", MYS: "Malaysia", ID: "Indonesia", IDN: "Indonesia", PH: "Philippines", PHL: "Philippines", VN: "Vietnam", VNM: "Vietnam",
  TH: "Thailand", THA: "Thailand", MX: "Mexico", MEX: "Mexico", BR: "Brazil", BRA: "Brazil", AR: "Argentina", ARG: "Argentina", CO: "Colombia", COL: "Colombia", CL: "Chile", CHL: "Chile",
  CR: "Costa Rica", CRI: "Costa Rica", ZA: "South Africa", ZAF: "South Africa", EG: "Egypt", EGY: "Egypt", TR: "Turkey", TUR: "Turkey", PK: "Pakistan", PAK: "Pakistan"
};
function fromCodes(loc) {
  const out = [];
  // Three letters in capitals anywhere ("SGP", "Bengaluru, IND"): unambiguous.
  for (const m of loc.matchAll(/\b([A-Z]{3})\b/g)) if (CODES[m[1]]) out.push(CODES[m[1]]);
  // Two letters at the start ("GB - Luton", "CA-QC-Longueuil"), or in lower case at the end ("Penang, my").
  const lead = loc.match(/^([A-Z]{2})\s*-/);
  if (lead && CODES[lead[1]]) out.push(CODES[lead[1]]);
  const tail = loc.match(/,\s*([a-z]{2})\s*$/);
  if (tail && CODES[tail[1].toUpperCase()]) out.push(CODES[tail[1].toUpperCase()]);
  return out;
}

const REMOTE = /\b(remote|anywhere|distributed|work from home|wfh|home[- ]based|virtual)\b/i;

export function place(location = "", remoteFlag = false) {
  const found = new Set();
  for (const [name, , re] of COUNTRIES) if (re.test(location)) found.add(name);
  for (const c of fromCodes(location)) found.add(c);
  for (const m of location.matchAll(/,\s*([A-Z]{2})\b(?!\w)/g)) {
    if (CA_PROVINCES.has(m[1])) found.add("Canada");
    else if (US_STATES.has(m[1])) found.add("United States");
  }
  // "Toronto, ON, CA": CA is the country code there, not California.
  if (found.has("Canada") && found.has("United States") && !/\b(united states|usa|u\.s\.)\b/i.test(location) && /,\s*CA\b/.test(location) && !/\b(california|san francisco|los angeles|san jose|san diego|palo alto|mountain view|sunnyvale|menlo park|santa clara)\b/i.test(location))
    found.delete("United States");
  const countries = [...found];
  const remote = remoteFlag || REMOTE.test(location);
  const regions = [...new Set(countries.map((c) => REGION_OF[c] ?? "Other"))];
  return { countries, remote, regions: regions.length ? regions : [remote ? "Remote" : "Other"] };
}

// Signals that matter to someone applying from another country, read from the description.
const NO_VISA = /\b((will not|won['’]?t|cannot|can['’]?t|can ?not|unable to|do(es)? not|don['’]?t|not able to) (currently )?(provide|offer|support|sponsor)( any)?( employment)?( visa)?( sponsorship)?|sponsorship (is )?not (available|provided|offered)|no (visa )?sponsorship|without (the )?(need for )?(current or future |present or future |any )?(employer |visa |employment )?sponsorship|not eligible for (visa )?sponsorship)\b/i;
const YES_VISA = /\b(visa sponsorship (is )?(available|provided|offered|possible)|(we|will|can|do) (also )?(sponsor|offer sponsorship|provide (visa )?sponsorship)|sponsorship (is )?available|relocation (and|&) visa|visa support|sponsor(ing)? (work )?visas)\b/i;
const CITIZENS = /\b(u\.?s\.? citizen(ship)?( status)? (is )?required|must (be|hold) (a )?u\.?s\.? citizen(ship)?|requires? u\.?s\.? citizenship|security clearance|itar|export[- ]control(led)?|u\.?s\.? persons?)\b/i;

export function visa(text = "") {
  const citizensOnly = CITIZENS.test(text);
  if (citizensOnly || NO_VISA.test(text)) return { visa: "no", citizensOnly };
  if (YES_VISA.test(text)) return { visa: "yes", citizensOnly: false };
  return { visa: null, citizensOnly: false };
}
