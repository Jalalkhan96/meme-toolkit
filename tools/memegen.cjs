#!/usr/bin/env node
/**
 * memegen.cjs — memegen.link FULL scraper + meme maker (Node 18+, CommonJS)
 * ==========================================================================
 * memegen.link ka public API: 210 meme templates, meme generation.
 *
 *   Templates scrape:  node memegen.cjs --templates [--format json|csv|txt]
 *   Template search:   node memegen.cjs --search "drake"
 *   Blanks download:   node memegen.cjs --download-templates
 *   Meme banao:        node memegen.cjs --make drake --top "hello" --bottom "world"
 *   Watermark:         --watermark "9696" (default) | --nowm (skip)
 *
 * WATERMARK NOTE:
 *   memegen.link har generated meme par bottom-left me "Memegen.link" ka
 *   server-side mark lagata hai (source par change nahi ho sakta). Ye tool
 *   use COVER karke "9696" stamp karta hai (image-edit approach).
 *   Iske liye `jimp` chahiye:  npm i jimp@0.22.12
 *   (bina jimp ke --nowm use karo — meme phir bhi banega.)
 *
 * Usage examples:
 *   node memegen.cjs --templates --format csv --out ./meme-data
 *   node memegen.cjs --make drake --top "code likho" --bottom "test mat karo"
 *   node memegen.cjs --make drake --top "hello" --bottom "world" --watermark "9696" --out ./out
 */
'use strict';

const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const API = 'https://api.memegen.link';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' : ' + url);
  return await res.json();
}
async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' : ' + url);
  return Buffer.from(await res.arrayBuffer());
}
function safeName(s) {
  return String(s).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'meme';
}
// memegen text encoding: space -> _, baqi URL-encode
function enc(t) {
  t = (t || '').trim();
  if (!t) return '_';
  return encodeURIComponent(t.replace(/ /g, '_')).replace(/%5F/g, '_');
}

/* ---------- templates ---------- */
async function getTemplates() {
  const list = await fetchJSON(API + '/templates/');
  return list.map(t => ({
    id: t.id || 'Not stated',
    name: t.name || 'Not stated',
    lines: t.lines != null ? t.lines : 'Not stated',
    blank: t.blank || 'Not stated',
    example_url: (t.example && t.example.url) || 'Not stated',
    source: t.source || 'Not stated',
    keywords: (t.keywords || []).join(', ') || 'Not stated',
  }));
}
function toCSV(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const q = v => '"' + String(v).replace(/"/g, '""') + '"';
  return [cols.join(',')].concat(rows.map(r => cols.map(c => q(r[c])).join(','))).join('\n');
}
function toTXT(rows) {
  return rows.map(r => [r.id, r.name, 'lines: ' + r.lines, r.blank].join('\n')).join('\n\n');
}

/* ---------- watermark: cover "Memegen.link", stamp custom text ---------- */
async function stampWatermark(file, label) {
  let Jimp;
  try { Jimp = require('jimp'); }
  catch (e) {
    throw new Error('watermark ke liye jimp chahiye: npm i jimp@0.22.12  (ya --nowm use karo)');
  }
  const img = await Jimp.read(file);
  const W = img.bitmap.width, H = img.bitmap.height;
  const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
  const tw = Jimp.measureText(font, label);
  const barH = 40;
  const barW = Math.max(tw + 24, Math.round(W * 0.25));
  const bar = new Jimp(barW, barH, 0x000000ff);
  img.composite(bar, 0, H - barH);          // purana mark cover
  img.print(font, 12, H - barH + 4, label); // naya stamp
  await img.writeAsync(file);
}

/* ---------- main ---------- */
async function main() {
  const args = process.argv.slice(2);
  let mode = null, query = null, make = null, top = '', bottom = '',
      format = 'json', outDir = null, delayMs = 800,
      watermark = '9696', nowm = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--templates') mode = 'templates';
    else if (a === '--search') { mode = 'search'; query = args[++i]; }
    else if (a === '--download-templates') mode = 'download-templates';
    else if (a === '--make') { mode = 'make'; make = args[++i]; }
    else if (a === '--top') top = args[++i] || '';
    else if (a === '--bottom') bottom = args[++i] || '';
    else if (a === '--format') format = args[++i];
    else if (a === '--out') outDir = args[++i];
    else if (a === '--delay') delayMs = parseInt(args[++i], 10) || 800;
    else if (a === '--watermark') watermark = args[++i] || '9696';
    else if (a === '--nowm') nowm = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage:\n  node memegen.cjs --templates [--format json|csv|txt] [--out dir]\n  node memegen.cjs --search "drake"\n  node memegen.cjs --download-templates [--out dir]\n  node memegen.cjs --make <template> --top "x" --bottom "y" [--watermark "9696"| --nowm] [--out dir]');
      return;
    }
  }
  if (!mode) { console.error('Usage: node memegen.cjs --templates | --search Q | --download-templates | --make <id> --top X --bottom Y'); process.exit(1); }

  if (mode === 'templates' || mode === 'search') {
    console.error('templates fetch ho rahe hain...');
    let rows = await getTemplates();
    if (mode === 'search') {
      const q = (query || '').toLowerCase();
      rows = rows.filter(r => (r.id + ' ' + r.name + ' ' + r.keywords).toLowerCase().includes(q));
      console.error('match: ' + rows.length);
    } else {
      console.error('total: ' + rows.length);
    }
    let outText;
    if (format === 'csv') outText = toCSV(rows);
    else if (format === 'txt') outText = toTXT(rows);
    else outText = JSON.stringify(rows, null, 2);
    if (outDir) {
      fs.mkdirSync(outDir, { recursive: true });
      const f = path.join(outDir, 'templates.' + (format === 'json' ? 'json' : format));
      fs.writeFileSync(f, outText);
      console.error('saved: ' + f);
    } else console.log(outText);
    return;
  }

  if (mode === 'download-templates') {
    const rows = await getTemplates();
    const d = outDir || './meme-templates';
    fs.mkdirSync(d, { recursive: true });
    let ok = 0, fail = 0;
    for (const r of rows) {
      const dest = path.join(d, safeName(r.id) + '.jpg');
      try {
        fs.writeFileSync(dest, await fetchBuffer(r.blank));
        ok++;
        if (ok % 25 === 0) console.error(ok + '/' + rows.length + '...');
      } catch (e) { fail++; console.error('FAIL: ' + r.id + ' — ' + e.message); }
      await sleep(delayMs);
    }
    console.error('done. ok=' + ok + ' fail=' + fail);
    return;
  }

  if (mode === 'make') {
    if (!make) { console.error('--make ke saath template id do (e.g. --make drake)'); process.exit(1); }
    const url = `${API}/images/${encodeURIComponent(make)}/${enc(top)}/${enc(bottom)}.jpg`;
    console.error('generating: ' + url);
    const buf = await fetchBuffer(url);
    const d = outDir || './memes';
    fs.mkdirSync(d, { recursive: true });
    const dest = path.join(d, safeName(make + '-' + (top || 'top') + '-' + (bottom || 'bottom')) + '.jpg');
    fs.writeFileSync(dest, buf);
    console.error('saved: ' + dest + ' (' + buf.length + 'b)');
    if (!nowm) {
      await stampWatermark(dest, watermark);
      console.error('watermark stamped: "' + watermark + '" (purana Memegen.link mark covered)');
    } else {
      console.error('watermark skipped (--nowm) — original Memegen.link mark maujood rahega');
    }
    return;
  }
}

main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
