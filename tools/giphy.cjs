#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const G = 'https://' + 'giphy' + '.com';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function unesc(s) {
  return String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
async function fetchText(url, retries = 3) {
  let last;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html' }, redirect: 'follow' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.text();
    } catch (e) { last = e; await sleep(1200 * (i + 1)); }
  }
  throw last;
}
function parseCards(html) {
  // Giphy do forms me markup deta hai: raw HTML aur JSON-escaped — dono handle.
  const out = [], seen = new Set();
  const re = /data-giphy-id=\\?"([a-zA-Z0-9]+)\\?"/g;
  let m;
  while ((m = re.exec(html))) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    const hrefWin = html.slice(Math.max(0, m.index - 250), m.index + 60);
    const href = (hrefWin.match(/href=\\?"((?:https?:\/\/[^"\\]+)?\/gifs\/[^"\\]+)\\?"/) || [])[1] || '';
    const win = html.slice(m.index, m.index + 3000);
    const srcM = win.match(/src=\\?"([^"\\]*giphy\.gif)\\?"/);
    const src = srcM ? srcM[1] : '';
    let alt = 'Not stated';
    const tail = srcM ? win.slice(srcM.index) : win;
    const altM = tail.match(/alt=\\?"([^"\\]*)\\?"/) || win.match(/alt=\\?"([^"\\]*)\\?"/);
    if (altM) alt = unesc(altM[1]);
    out.push({
      id,
      title: alt.replace(/\s+GIF$/i, '').trim() || 'Not stated',
      page_url: href ? (href.startsWith('http') ? href : G + href) : 'Not stated',
      gif_url: src || ('https://media.giphy.com/media/' + id + '/giphy.gif'),
      scraped_at: new Date().toISOString(),
    });
  }
  return out;
}
async function scrapeOne(url) {
  const idm = url.match(/-([a-zA-Z0-9]+)\/?$/);
  if (!idm) throw new Error('Giphy URL me id nahi mili');
  const id = idm[1];
  const html = await fetchText(url);
  const og = (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] || '';
  const alt = unesc((html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1] || 'Not stated');
  return [{ id, title: alt.replace(/\s+GIF$/i, '').trim() || 'Not stated', page_url: url,
    gif_url: og || ('https://media.giphy.com/media/' + id + '/giphy.gif'), scraped_at: new Date().toISOString() }];
}
function toCSV(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const q = v => '"' + String(v).replace(/"/g, '""') + '"';
  return [cols.join(',')].concat(rows.map(r => cols.map(c => q(r[c])).join(','))).join('\n');
}
function toTXT(rows) {
  return rows.map(r => [r.title, r.id, r.page_url, r.gif_url].join('\n')).join('\n\n');
}
function safeName(s) {
  return String(s).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'gif';
}
async function main() {
  const args = process.argv.slice(2);
  let mode = null, query = null, url = null;
  let top = 10, format = 'json', outDir = null, download = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--search') { mode = 'search'; query = args[++i]; }
    else if (a === '--trending') mode = 'trending';
    else if (a === '--url') { mode = 'url'; url = args[++i]; }
    else if (a === '--top') top = Math.max(1, parseInt(args[++i], 10) || 10);
    else if (a === '--format') format = args[++i];
    else if (a === '--out') outDir = args[++i];
    else if (a === '--download') download = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node giphy.cjs --search "funny cat" --top 10 | --trending --top 10 | --url <giphy-url>');
      return;
    }
  }
  if (!mode) { console.error('Usage: node giphy.cjs --search "text" --top 10 | --trending | --url <giphy-url>'); process.exit(1); }
  let rows = [];
  if (mode === 'url') {
    console.error('fetching: ' + url);
    rows = await scrapeOne(url);
  } else {
    const pageUrl = mode === 'trending' ? G + '/' : G + '/search/' + encodeURIComponent((query || '').trim().replace(/\s+/g, '-'));
    console.error('fetching: ' + pageUrl);
    const html = await fetchText(pageUrl);
    rows = parseCards(html).slice(0, top);
    if (!rows.length) throw new Error('koi GIF nahi mili');
    console.error('found: ' + rows.length);
  }
  const outText = format === 'csv' ? toCSV(rows) : format === 'txt' ? toTXT(rows) : JSON.stringify(rows, null, 2);
  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    const f = path.join(outDir, 'giphy.' + (format === 'json' ? 'json' : format));
    fs.writeFileSync(f, outText);
    console.error('saved: ' + f);
  } else console.log(outText);
  if (download && rows.length) {
    const d = outDir ? path.join(outDir, 'gifs') : './giphy-gifs';
    fs.mkdirSync(d, { recursive: true });
    for (const r of rows) {
      const dest = path.join(d, safeName(r.id + '-' + r.title) + '.gif');
      try {
        const res = await fetch(r.gif_url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 1000) throw new Error('file bahut chhoti');
        fs.writeFileSync(dest, buf);
        console.error('downloaded: ' + dest + ' (' + (buf.length / 1024).toFixed(0) + ' KB)');
      } catch (e) { console.error('dl FAIL: ' + r.id + ' — ' + e.message); }
      await sleep(800);
    }
  }
  console.error('done. rows=' + rows.length);
}
main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
