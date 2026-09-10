// Generate a self-contained SVG from GitHub's public contribution calendar.
// No token or third-party image service is needed. Failures preserve the last SVG.
import { mkdir, writeFile } from 'node:fs/promises';

const username = process.env.PROFILE_USERNAME || 'DevPabloOliveira';
if (!/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(username)) throw new Error('Invalid GitHub username');
const source = `https://github.com/users/${username}/contributions`;
const response = await fetch(source, { headers: { 'Accept-Language': 'en-US', 'User-Agent': 'profile-contribution-svg' }, signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`GitHub calendar: HTTP ${response.status}`);
const html = await response.text();
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
const counts = new Map();
for (const match of html.matchAll(/<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/g)) {
  const text = match[2].replace(/<[^>]*>/g, '').trim();
  const count = text.match(/^([\d,]+) contributions?\b/);
  if (count || /^No contributions\b/.test(text)) counts.set(attr(match[1], 'for'), count ? Number(count[1].replaceAll(',', '')) : 0);
}
const days = [];
for (const [tag] of html.matchAll(/<td\b[^>]*data-date="[^"]+"[^>]*>/g)) {
  const date = attr(tag, 'data-date');
  const level = Number(attr(tag, 'data-level'));
  const count = counts.get(attr(tag, 'id'));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(count) || ![0,1,2,3,4].includes(level)) throw new Error('Unrecognized contribution day; keeping previous SVG');
  days.push({ date, level, count });
}
days.sort((a,b) => a.date.localeCompare(b.date));
if (days.length < 350 || days.length > 371 || new Set(days.map(d => d.date)).size !== days.length) throw new Error('Incomplete GitHub calendar; keeping previous SVG');
const total = days.reduce((sum,d) => sum + d.count, 0);
const maximum = Math.max(1, ...days.map(d => d.count));
const start = Date.parse(days[0].date);
const offset = new Date(start).getUTCDay();
const palette = ['#293229', '#526047', '#74845B', '#96A977', '#BCC798'];
const escape = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const points = arr => arr.map(p => p.map(n => n.toFixed(2)).join(',')).join(' ');
const blocks = days.map(d => {
  const index = Math.round((Date.parse(d.date)-start)/86400000) + offset;
  const week = Math.floor(index/7), row = index%7;
  const x = 130 + week*12.4 - row*10.4;
  const y = 240 + week*2.25 + row*8.5;
  const height = d.count ? 4 + 92*d.count/maximum : 1;
  const top = [[x,y-height],[x+10.7,y+1.95-height],[x+1.8,y+9.25-height],[x-8.9,y+7.3-height]];
  return { depth:y, svg:`<g><title>${d.date}: ${d.count} contribuições</title><polygon points="${points([top[3],top[2],[x+1.8,y+9.25],[x-8.9,y+7.3]])}" fill="${palette[d.level]}"/><polygon points="${points([top[2],top[1],[x+10.7,y+1.95],[x+1.8,y+9.25]])}" fill="#3B4835"/><polygon points="${points(top)}" fill="${palette[d.level]}" stroke="#171B19" stroke-width=".5"/></g>` };
}).sort((a,b) => a.depth-b.depth).map(b => b.svg).join('\n');
const formatDate = date => date.split('-').reverse().join('/');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="530" viewBox="0 0 900 530" fill="none" role="img" aria-labelledby="title desc">
<title id="title">Contribuições de ${escape(username)} em 3D</title>
<desc id="desc">${total} contribuições de ${formatDate(days[0].date)} a ${formatDate(days.at(-1).date)}. Cada bloco representa um dia; blocos mais altos indicam mais contribuições. Fonte: calendário público do GitHub.</desc>
<style>text { font-family: 'Segoe UI', Arial, sans-serif; fill: #E2E2D8; } .mono { font-family: Consolas, 'Liberation Mono', monospace; } .index { fill: #BCC798; font-size: 13px; letter-spacing: 1.5px; } .note { fill: #A4AAA0; font-size: 16px; }</style>
<rect x=".5" y=".5" width="899" height="529" rx="3" fill="#171B19" stroke="#3B423A"/>
<path d="M40 39H67" stroke="#BCC798" stroke-width="3"/>
<text x="80" y="44" class="mono index">ATIVIDADE / CONTRIBUIÇÕES</text>
<text x="40" y="98" font-size="30" font-weight="500" letter-spacing="-.8">Histórico de contribuições</text>
<text x="40" y="132" class="note">${total} contribuições · ${formatDate(days[0].date)} — ${formatDate(days.at(-1).date)}</text>
<text x="860" y="44" text-anchor="end" class="mono index">${escape(username)}</text>
${blocks}
<text x="40" y="452" class="note">Um bloco por dia. Blocos mais altos indicam mais contribuições.</text>
<text x="684" y="452" class="mono" font-size="12" fill="#A4AAA0">Menos</text>
${palette.map((color,i)=>`<rect x="${727+i*19}" y="440" width="13" height="13" fill="${color}"/>`).join('')}
<text x="860" y="452" text-anchor="end" class="mono" font-size="12">Mais</text>
<path d="M40 477H860" stroke="#41483E"/>
<text x="40" y="510" class="note">Calendário público do GitHub · atualização diária</text>
<text x="860" y="510" text-anchor="end" class="mono index">VER CONTRIBUIÇÕES ↗</text>
</svg>\n`;
await mkdir(new URL('../assets/', import.meta.url), { recursive:true });
await writeFile(new URL('../assets/activity.svg', import.meta.url), svg);
console.log(`Generated activity.svg: ${days.length} days, ${total} contributions for ${username}`);
