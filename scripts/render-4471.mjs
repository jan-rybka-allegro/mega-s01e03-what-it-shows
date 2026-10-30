// Render the new .svx page with this export's data, without installing a build tool.
// This is a static review copy; the .svx and its component remain the KB source.
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupByCause, uniqueById } from '../src/lib/kb/causes.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const data = join(root, 'src/lib/data');
const source = readFileSync(join(root, 'src/routes/kb/incidents/4471-split/+page.svx'), 'utf8');
const exported = JSON.parse(readFileSync(join(data, 'reports-4471.json'), 'utf8'));
const notes = JSON.parse(readFileSync(join(data, 'desk-notes.json'), 'utf8'));
const tenants = Object.fromEntries(
  readdirSync(join(data, 'tenants')).map((name) => {
    const tenant = JSON.parse(readFileSync(join(data, 'tenants', name), 'utf8'));
    return [tenant.handle, tenant];
  }),
);

const escape = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[ch]);

const inline = (value) => escape(value)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n/);
if (!frontmatter) throw new Error('Missing .svx frontmatter');
const meta = Object.fromEntries(frontmatter[1].split('\n').map((line) => {
  const at = line.indexOf(':');
  return [line.slice(0, at), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '')];
}));
for (const field of ['title', 'owner', 'status', 'reviewed', 'signature']) {
  if (!meta[field]) throw new Error(`Missing ${field}`);
}

const unique = uniqueById(exported);
const merged = unique.filter((report) => report.mergedInto === 4471);
const groups = groupByCause(merged, (report) => tenants[report.tenant]);
const oneDay = merged.filter((report) => notes.oneDayMove.includes(report.id)).length;

const summary = `<p><strong>${merged.length}</strong> unique reports merged into #4471, across
<strong>${groups.length}</strong> causes. The export has ${exported.length} rows;
${exported.length - unique.length} repeat an ID and are counted once.</p>
<table><thead><tr><th>cause</th><th>reports</th><th>tenants</th><th>intake tags</th><th>first → last</th></tr></thead>
<tbody>${groups.map((group) => `<tr><td><code>${escape(group.cause)}</code></td><td>${group.reports.length}</td><td>${group.tenants}</td><td>${escape(Object.entries(group.taggedAs).sort((a, b) => b[1] - a[1]).map(([tag, n]) => `${tag} ×${n}`).join(' · '))}</td><td>${group.firstSeen} → ${group.lastSeen}</td></tr>`).join('')}</tbody></table>
<p class="note">The desk described ${oneDay} reports as a one-day move. They stay in their
tenant-derived cause group; that description alone does not establish another cause.</p>`;

function fnv1a(value, seed) {
  let hash = seed >>> 0;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}
const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
let bits = (BigInt(fnv1a(meta.signature.trim(), 0x811c9dc5)) << 8n)
  | BigInt(fnv1a(meta.signature.trim(), 0x9e3779b9) & 0xff);
let ref = '';
for (let i = 0; i < 8; i++) { ref = alphabet[Number(bits & 31n)] + ref; bits >>= 5n; }
ref = `DR-${ref.slice(0, 4)}-${ref.slice(4)}`;

let body = source.slice(frontmatter[0].length).replace(/<script>[\s\S]*?<\/script>\s*/, '').trim();
body = body.replace('<IncidentSplit ticket={4471} />', '\n\n@@SUMMARY@@\n\n');
body = body.replace(/<Callout>\s*([\s\S]*?)\s*<\/Callout>/, (_match, content) => `\n\n@@CALLOUT:${content.replace(/\n/g, ' ')}@@\n\n`);
body = body.replace('<RenderStamp {signature} />', '\n\n@@STAMP@@\n\n');
body = body.split(/\n\s*\n/).map((block) => {
  const text = block.trim();
  if (!text) return '';
  if (text === '@@SUMMARY@@') return summary;
  if (text === '@@STAMP@@') return `<p class="stamp">desk ref <b>${ref}</b></p>`;
  if (text.startsWith('@@CALLOUT:')) return `<aside>${inline(text.slice(10, -2))}</aside>`;
  if (text.startsWith('## ')) return `<h2>${inline(text.slice(3))}</h2>`;
  return `<p>${inline(text.replace(/\n/g, ' '))}</p>`;
}).join('\n');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(meta.title)} · support kb</title>
<style>
:root { --bg:#fbfaf7; --fg:#1d1d1b; --muted:#6b6a66; --line:#e3e0d8; --accent:#2f6f5e; --note-bg:#eef5f2; --mono:ui-monospace,Menlo,monospace; }
@media (prefers-color-scheme:dark) { :root { --bg:#171716; --fg:#ecebe6; --muted:#9c9a93; --line:#34332f; --accent:#6fbfa6; --note-bg:#1d2c27; } }
body { margin:0; background:var(--bg); color:var(--fg); font:16px/1.6 system-ui,sans-serif; }
.kb { max-width:760px; margin:0 auto; padding:2rem 16px 4rem; }
.crumb { font:.8rem var(--mono); text-decoration:none; color:var(--muted); }
h1 { margin:.25rem 0 .5rem; line-height:1.2; }
.meta { display:flex; flex-wrap:wrap; gap:.5rem 1rem; color:var(--muted); font-size:.85rem; margin:0; }
.status { border:1px solid var(--line); border-radius:99px; padding:0 .6rem; }
table { border-collapse:collapse; width:100%; margin:1rem 0; font-size:.92rem; }
th,td { border-bottom:1px solid var(--line); padding:.35rem .5rem; text-align:left; }
code { font-family:var(--mono); font-size:.88em; }
a { color:var(--accent); }
aside { border-left:4px solid var(--accent); padding:.5rem 1rem; margin:1rem 0; background:var(--note-bg); }
.note { color:var(--muted); font-size:.9rem; }
.stamp { margin:2rem 0 0; font:.85rem var(--mono); color:var(--muted); }
.stamp b { color:var(--accent); letter-spacing:.04em; }
footer { margin-top:3rem; color:var(--muted); font-size:.8rem; border-top:1px solid var(--line); padding-top:1rem; }
@media (max-width:600px) { table { display:block; overflow-x:auto; } }
</style></head><body><div class="kb"><header><a class="crumb" href="/kb">support desk · kb</a>
<h1>${escape(meta.title)}</h1><p class="meta"><span>owner <b>${escape(meta.owner)}</b></span>
<span class="status">${escape(meta.status)}</span><span>reviewed ${escape(meta.reviewed)}</span></p></header>
<main>${body}</main><footer>Pages are written by people. Tables and charts are built from data at render time.</footer>
</div></body></html>
`;
const output = join(root, 'rendered/4471-split.html');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, html);
console.log(`${output}: ${merged.length} unique reports, ${groups.map((g) => `${g.cause} ${g.reports.length}`).join(', ')}, ${ref}`);
