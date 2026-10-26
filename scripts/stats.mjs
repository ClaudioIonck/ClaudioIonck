// Gera assets/stats.svg e assets/langs.svg direto da API do GitHub (sem serviços de terceiros).
// Rodado pelo workflow .github/workflows/profile.yml com o GITHUB_TOKEN do próprio Actions.
// Uso local: GH_TOKEN=xxx node scripts/stats.mjs   |   node scripts/stats.mjs --mock (dados de exemplo)
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const USER = process.env.GH_USER || "ClaudioIonck";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
const FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";
const C = { bg: "#0d1117", line: "#30363d", text: "#e6edf3", muted: "#8b949e", accent: "#A388FF", accent2: "#2DD4BF" };
const IGNORE_LANGS = new Set((process.env.IGNORE_LANGS || "").split(",").filter(Boolean));

const CONTRIB_QUERY = `query($login:String!){ user(login:$login){
  contributionsCollection{
    totalCommitContributions restrictedContributionsCount
    totalPullRequestContributions totalIssueContributions
    contributionCalendar{ totalContributions weeks{ contributionDays{ contributionCount date } } }
  }
}}`;

// Mensagens "::warning::" / "::error::" aparecem como anotações na aba Actions.
const warn = m => console.log(`::warning::${String(m).replace(/\n/g, " ").slice(0, 900)}`);

async function load() {
  if (process.argv.includes("--mock")) return mock();
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) throw new Error("defina GH_TOKEN");
  const headers = { Authorization: `Bearer ${token}`, "User-Agent": USER, Accept: "application/vnd.github+json" };

  async function rest(path) {
    const r = await fetch(`https://api.github.com${path}`, { headers });
    if (!r.ok) throw new Error(`GET ${path} -> ${r.status} ${(await r.text()).slice(0, 300)}`);
    return r.json();
  }

  // Repositórios e linguagens via REST (sempre disponível com o GITHUB_TOKEN para dados públicos)
  const repos = (await rest(`/users/${USER}/repos?type=owner&per_page=100`)).filter(r => !r.fork);
  const nodes = [];
  for (const r of repos) {
    let langs = {};
    try { langs = await rest(`/repos/${r.full_name}/languages`); } catch (e) { warn(e.message); }
    nodes.push({
      stargazerCount: r.stargazers_count,
      languages: { edges: Object.entries(langs).map(([name, size]) => ({ size, node: { name, color: LANG_COLORS[name] } })) },
    });
  }

  // Contribuições via GraphQL; se falhar, os cards saem sem esses números em vez de quebrar
  let cc = null;
  try {
    const r = await fetch("https://api.github.com/graphql", {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ query: CONTRIB_QUERY, variables: { login: USER } }),
    });
    const j = await r.json();
    if (j.errors) warn(`GraphQL: ${JSON.stringify(j.errors)}`);
    cc = j.data?.user?.contributionsCollection ?? null;
  } catch (e) { warn(`GraphQL: ${e.message}`); }

  return { contributionsCollection: cc, repositories: { totalCount: repos.length, nodes } };
}

const LANG_COLORS = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", HTML: "#e34c26", CSS: "#663399", Python: "#3572A5",
  Java: "#b07219", PHP: "#4F5D95", R: "#198CE7", Solidity: "#AA6746", Shell: "#89e051", "C#": "#178600",
  C: "#555555", "C++": "#f34b7d", Go: "#00ADD8", Rust: "#dea584", Kotlin: "#A97BFF", Dart: "#00B4AB",
  Vue: "#41b883", SCSS: "#c6538c", Batchfile: "#C1F12E", PowerShell: "#012456", "Jupyter Notebook": "#DA5B0B",
  GLSL: "#5686a5", Dockerfile: "#384d54", Ruby: "#701516", Swift: "#F05138",
};

function streaks(weeks) {
  const days = weeks.flatMap(w => w.contributionDays);
  let longest = 0, run = 0;
  for (const d of days) { run = d.contributionCount > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
  // sequência atual: hoje sem contribuição ainda não quebra a sequência
  let i = days.length - 1, current = 0;
  if (i >= 0 && days[i].contributionCount === 0) i--;
  for (; i >= 0 && days[i].contributionCount > 0; i--) current++;
  return { current, longest };
}

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const fmt = n => Number.isNaN(n) ? "—" : n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n);

const ICON = {
  star: "M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z",
  commit: "M12 8a4 4 0 100 8 4 4 0 000-8zM1 12h6m10 0h6",
  pr: "M6 3v12m0 0a3 3 0 100 6 3 3 0 000-6zM18 21V9a3 3 0 00-3-3h-4m0 0l3-3m-3 3l3 3",
  issue: "M12 3a9 9 0 100 18 9 9 0 000-18zm0 5v5m0 3v.5",
  repo: "M4 4h12a3 3 0 013 3v13H7a3 3 0 01-3-3zm0 13a3 3 0 013-3h12",
  flame: "M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 2-5 5-5 8 0 4 3 7 7 7z",
  cal: "M4 6h16v14H4zM4 10h16M8 3v4m8-4v4",
};

function card(w, h, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="14" fill="${C.bg}" stroke="${C.line}"/>
<text x="24" y="38" font-size="17" font-weight="700" fill="${C.text}">${esc(title)}</text>
${body}
</svg>
`;
}

function statsSvg(u) {
  const cc = u.contributionsCollection ?? {
    totalCommitContributions: NaN, restrictedContributionsCount: 0, totalPullRequestContributions: NaN,
    totalIssueContributions: NaN, contributionCalendar: { totalContributions: NaN, weeks: [] },
  };
  const stars = u.repositories.nodes.reduce((a, r) => a + r.stargazerCount, 0);
  const { current, longest } = streaks(cc.contributionCalendar.weeks);
  const rows = [
    [ICON.commit, "Commits (last year)", cc.totalCommitContributions + cc.restrictedContributionsCount],
    [ICON.pr, "Pull requests", cc.totalPullRequestContributions],
    [ICON.issue, "Issues", cc.totalIssueContributions],
    [ICON.repo, "Public repos", u.repositories.totalCount],
    [ICON.star, "Stars earned", stars],
  ];
  let body = rows.map(([d, label, v], i) => {
    const y = 72 + i * 25;
    return `<g>
<svg x="24" y="${y - 13}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${C.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>
<text x="48" y="${y}" font-size="14" fill="${C.muted}">${label}</text>
<text x="262" y="${y}" font-size="14" font-weight="700" fill="${C.text}" text-anchor="end">${fmt(v)}</text></g>`;
  }).join("\n");

  // anel de contribuições + sequências
  const total = cc.contributionCalendar.totalContributions;
  body += `
<line x1="290" y1="56" x2="290" y2="182" stroke="${C.line}"/>
<g>
<circle cx="392" cy="108" r="44" fill="none" stroke="url(#g)" stroke-width="7" stroke-linecap="round" />
<text x="392" y="113" font-size="${total >= 1000 ? 22 : 26}" font-weight="800" fill="${C.text}" text-anchor="middle">${fmt(total)}</text>
<text x="392" y="174" font-size="12" fill="${C.muted}" text-anchor="middle">contributions · last year</text>
</g>`;
  const defs = `<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="348" y1="64" x2="436" y2="152"><stop offset="0" stop-color="${C.accent}"/><stop offset="1" stop-color="${C.accent2}"/></linearGradient></defs>`;
  const streak = `
<g>
<rect x="24" y="200" width="447" height="40" rx="10" fill="#161b22" stroke="${C.line}"/>
<svg x="38" y="211" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF8A3D" stroke-width="2" stroke-linejoin="round"><path d="${ICON.flame}"/></svg>
<text x="62" y="225" font-size="13" fill="${C.muted}">Current streak <tspan font-weight="700" fill="${C.text}">${current} ${current === 1 ? "day" : "days"}</tspan></text>
<svg x="262" y="211" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${C.accent2}" stroke-width="2" stroke-linecap="round"><path d="${ICON.cal}"/></svg>
<text x="286" y="225" font-size="13" fill="${C.muted}">Longest streak <tspan font-weight="700" fill="${C.text}">${longest} ${longest === 1 ? "day" : "days"}</tspan></text>
</g>`;
  return card(495, 262, "GitHub stats", defs + body + streak);
}

function langsSvg(u) {
  const tot = new Map();
  for (const r of u.repositories.nodes) for (const e of r.languages.edges) {
    if (IGNORE_LANGS.has(e.node.name)) continue;
    const cur = tot.get(e.node.name) ?? { size: 0, color: e.node.color || "#8b949e" };
    cur.size += e.size; tot.set(e.node.name, cur);
  }
  const all = [...tot.entries()].sort((a, b) => b[1].size - a[1].size);
  const sum = all.reduce((a, [, v]) => a + v.size, 0) || 1;
  const top = all.slice(0, 8);
  const W = 447;
  let x = 24, bar = "";
  top.forEach(([, v], i) => {
    const w = Math.max(2, (v.size / sum) * W);
    bar += `<rect x="${x.toFixed(1)}" y="58" width="${w.toFixed(1)}" height="10" fill="${v.color}"/>`;
    x += w;
  });
  const list = top.map(([name, v], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const lx = 24 + col * 232, ly = 102 + row * 32;
    const pct = ((v.size / sum) * 100).toFixed(1);
    return `<g>
<circle cx="${lx + 6}" cy="${ly - 5}" r="6" fill="${v.color}"/>
<text x="${lx + 20}" y="${ly}" font-size="14" fill="${C.text}">${esc(name)}</text>
<text x="${lx + 214}" y="${ly}" font-size="13" fill="${C.muted}" text-anchor="end">${pct}%</text></g>`;
  }).join("\n");
  const body = `<defs><clipPath id="r"><rect x="24" y="58" width="${W}" height="10" rx="5"/></clipPath></defs>
<g clip-path="url(#r)"><rect x="24" y="58" width="${W}" height="10" fill="#21262d"/>${bar}</g>
${list || `<text x="24" y="110" font-size="14" fill="${C.muted}">No data yet</text>`}`;
  return card(495, 262, "Most used languages", body);
}

function mock() {
  const days = [];
  for (let i = 0; i < 365; i++) days.push({ date: "", contributionCount: (i * 7919) % 5 > 1 || i > 352 ? (i % 6) + 1 : 0 });
  const weeks = []; for (let i = 0; i < days.length; i += 7) weeks.push({ contributionDays: days.slice(i, i + 7) });
  const L = (n, c, s) => ({ size: s, node: { name: n, color: c } });
  return {
    name: "Claudio Ionck", followers: { totalCount: 0 },
    contributionsCollection: { totalCommitContributions: 412, restrictedContributionsCount: 0, totalPullRequestContributions: 23, totalIssueContributions: 6,
      contributionCalendar: { totalContributions: 486, weeks } },
    repositories: { totalCount: 24, nodes: [
      { stargazerCount: 5, languages: { edges: [L("JavaScript", "#f1e05a", 520), L("HTML", "#e34c26", 260), L("CSS", "#663399", 180)] } },
      { stargazerCount: 3, languages: { edges: [L("Python", "#3572A5", 210), L("PHP", "#4F5D95", 90), L("Java", "#b07219", 70), L("R", "#198CE7", 30)] } },
    ] },
  };
}

let u;
try { u = await load(); }
catch (e) { console.log(`::error::${String(e.message).replace(/\n/g, " ").slice(0, 900)}`); process.exit(1); }
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "stats.svg"), statsSvg(u));
writeFileSync(join(OUT, "langs.svg"), langsSvg(u));
console.log("cards gerados para", USER);
