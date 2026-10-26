// Gera assets/stack.svg e os botões sociais a partir dos ícones do Devicon (MIT).
// Uso: npm i devicon && node scripts/build-stack.mjs node_modules/devicon/icons
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ICONS = process.argv[2] ?? "node_modules/devicon/icons";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
mkdirSync(OUT, { recursive: true });

const FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";
const C = { bg: "#0d1117", tile: "#161b22", line: "#30363d", text: "#e6edf3", muted: "#8b949e", accent: "#A388FF" };

const GROUPS = [
  { title: "Languages", items: [
    ["html5", "HTML"], ["css3", "CSS"], ["javascript", "JavaScript"], ["python", "Python"],
    ["java", "Java"], ["php", "PHP"], ["r", "R"], ["solidity", "Solidity", "#e6edf3", true],
  ]},
  { title: "Frameworks, data & cloud", items: [
    ["bootstrap", "Bootstrap"], ["mysql", "MySQL", "#5BA4D9", true], ["firebase", "Firebase"], ["vercel", "Vercel", "#ffffff"],
  ]},
  { title: "Tools", items: [
    ["git", "Git"], ["github", "GitHub", "#ffffff"], ["vscode", "VS Code"], ["intellij", "IntelliJ"],
    ["figma", "Figma"], ["windows11", "Windows"],
  ]},
];

let uid = 0;
function icon(name, x, y, size, color, force) {
  const dir = join(ICONS, name);
  let src;
  for (const v of ["original", "plain"]) {
    try { src = readFileSync(join(dir, `${name}-${v}.svg`), "utf8"); break; } catch {}
  }
  if (!src) throw new Error(`ícone não encontrado: ${name}`);
  const vb = (src.match(/viewBox="([^"]+)"/) || [])[1] || "0 0 128 128";
  let inner = src.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const p = `i${uid++}_`;
  inner = inner.replace(/\bid="([^"]+)"/g, `id="${p}$1"`)
               .replace(/url\(#([^)]+)\)/g, `url(#${p}$1)`)
               .replace(/(xlink:)?href="#([^"]+)"/g, (_m, x, id) => `${x ?? ""}href="#${p}${id}"`);
  const fill = color ? ` fill="${color}"` : "";
  if (force) inner = inner.replace(/fill="#[0-9a-f]{3,6}"/gi, `fill="${color}"`);
  else if (color) inner = inner.replace(/fill="#(000|000000|181616|231f20|1d1d1b)"/gi, `fill="${color}"`);
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${vb}"${fill}>${inner}</svg>`;
}

// ---------- stack.svg ----------
const W = 840, PAD = 28, TILE = 86, GAP = 12, PER_ROW = 8;
let y = PAD, body = "", n = 0;
for (const g of GROUPS) {
  body += `<text x="${PAD}" y="${y + 14}" font-size="13" font-weight="700" letter-spacing="1.6" fill="${C.accent}">${g.title.toUpperCase().replace(/&/g, "&amp;")}</text>`;
  y += 28;
  g.items.forEach(([name, label, color, force], i) => {
    const col = i % PER_ROW, row = Math.floor(i / PER_ROW);
    const x = PAD + col * (TILE + GAP), ty = y + row * (TILE + GAP);
    body += `<g>`
      + `<rect x="${x}" y="${ty}" width="${TILE}" height="${TILE}" rx="14" fill="${C.tile}" stroke="${C.line}"/>`
      + icon(name, x + 25, ty + 14, 36, color, force)
      + `<text x="${x + TILE / 2}" y="${ty + 72}" font-size="12" text-anchor="middle" fill="${C.muted}">${label}</text></g>`;
  });
  y += Math.ceil(g.items.length / PER_ROW) * (TILE + GAP) + 14;
}
const H = y + PAD - 26;
writeFileSync(join(OUT, "stack.svg"),
`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="16" fill="${C.bg}" stroke="${C.line}"/>
${body}
</svg>
`);

// ---------- botões sociais ----------
const instagramGlyph = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s / 24})" fill="none" stroke="#fff" stroke-width="2.2">
<rect x="2.5" y="2.5" width="19" height="19" rx="5.5"/><circle cx="12" cy="12" r="4.3"/><circle cx="17.4" cy="6.6" r="1.1" fill="#fff" stroke="none"/></g>`;

function button(file, label, bg, glyph, width) {
  writeFileSync(join(OUT, file),
`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="40" viewBox="0 0 ${width} 40" font-family="${FONT}">
<defs>${bg.defs ?? ""}</defs>
<rect width="${width}" height="40" rx="10" fill="${bg.fill}"/>
${glyph}
<text x="46" y="25.5" font-size="14" font-weight="700" fill="#fff" letter-spacing=".3">${label}</text>
</svg>
`);
}
button("btn-instagram.svg", "Instagram", {
  defs: `<linearGradient id="ig" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#F58529"/><stop offset=".5" stop-color="#DD2A7B"/><stop offset="1" stop-color="#8134AF"/></linearGradient>`,
  fill: "url(#ig)",
}, instagramGlyph(14, 9, 22), 136);
button("btn-linkedin.svg", "LinkedIn", { fill: "#0A66C2" },
  `<rect x="14" y="9" width="22" height="22" rx="4" fill="#fff"/>` + icon("linkedin", 16, 11, 18), 128);

console.log("ok:", join(OUT, "stack.svg"));
