#!/usr/bin/env node
/**
 * repo-links.cjs — GitHub repo link inventory (zero-dep, Node 18+, CommonJS)
 * ==========================================================================
 * Kisi bhi public GitHub repo ki poori file tree + README/docs ke saare
 * hyperlinks nikalta hai: json / csv / txt.
 *
 * Usage:
 *   node repo-links.cjs --repo jacebrowning/memegen
 *   node repo-links.cjs --repo jacebrowning/memegen --format csv --out ./repo-links
 *   node repo-links.cjs --repo Jalalkhan96/merepo --docs README.md,docs/guide.md
 *
 *   Common: [--format json|csv|txt] [--out dir] [--docs file1,file2] [--branch main]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/vnd.github+json' } });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' : ' + url);
  return await res.json();
}
async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' : ' + url);
  return await res.text();
}
function scrapeLinks(md, label, store) {
  const urls = new Set();
  for (const m of md.matchAll(/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)) urls.add(m[1]);
  for (const m of md.matchAll(/<(https?:\/\/[^>\s]+)>/g)) urls.add(m[1]);
  for (const m of md.matchAll(/(?<![(<])(https?:\/\/[^\s)\]"'<>]+)/g)) urls.add(m[1].replace(/[.,]+$/, ''));
  for (const u of urls) {
    const clean = u.replace(/<redacted>/g, '');
    if (!store[clean]) store[clean] = new Set();
    store[clean].add(label);
  }
  return urls.size;
}
function cat(u) {
  if (u.includes('api.memegen.link') || u.includes('memegen.link')) return 'memegen API/docs';
  if (u.includes('github.com')) return 'github';
  if (u.includes('shields.io') || u.includes('coveralls') || u.includes('circleci')) return 'badges/CI';
  if (u.includes('buymeacoffee') || u.includes('sponsors')) return 'support';
  return 'external';
}
function toCSV(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const q = v => '"' + String(v).replace(/"/g, '""') + '"';
  return [cols.join(',')].concat(rows.map(r => cols.map(c => q(r[c])).join(','))).join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  let repo = null, format = 'json', outDir = null, branch = null, docs = ['README.md'];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--repo') repo = args[++i];
    else if (a === '--format') format = args[++i];
    else if (a === '--out') outDir = args[++i];
    else if (a === '--branch') branch = args[++i];
    else if (a === '--docs') docs = args[++i].split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node repo-links.cjs --repo owner/name [--format json|csv|txt] [--out dir] [--branch main] [--docs README.md,docs/x.md]');
      return;
    }
  }
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) { console.error('Usage: node repo-links.cjs --repo owner/name'); process.exit(1); }

  console.error('repo meta: ' + repo);
  const meta = await fetchJSON('https://api.github.com/repos/' + repo);
  branch = branch || meta.default_branch || 'main';
  console.error('description:', meta.description || 'Not stated', '| license:', (meta.license || {}).spdx_id || 'Not stated', '| stars:', meta.stargazers_count);

  console.error('tree fetch (recursive)...');
  const treeData = await fetchJSON('https://api.github.com/repos/' + repo + '/git/trees/' + branch + '?recursive=1');
  const GH = 'https://github.com/' + repo + '/blob/' + branch + '/';
  const RAW = 'https://raw.githubusercontent.com/' + repo + '/' + branch + '/';
  const fileRows = (treeData.tree || []).filter(t => t.type === 'blob').map(t => ({
    path: t.path,
    folder: t.path.includes('/') ? t.path.split('/')[0] : '(root)',
    size_bytes: t.size != null ? t.size : '',
    github_url: GH + t.path,
    raw_url: RAW + t.path,
  }));
  console.error('files: ' + fileRows.length + (treeData.truncated ? ' (WARNING: tree truncated)' : ''));

  const store = {};
  for (const d of docs) {
    try {
      const md = await fetchText(RAW + d);
      const n = scrapeLinks(md, d, store);
      console.error(d + ': ' + n + ' links');
    } catch (e) { console.error('docs skip: ' + d + ' — ' + e.message); }
    await sleep(400);
  }
  const linkRows = Object.keys(store).sort().map(u => ({ url: u, category: cat(u), found_in: [...store[u]].join(', ') }));
  console.error('unique hyperlinks: ' + linkRows.length);

  const payload = {
    repo, description: meta.description || 'Not stated',
    license: (meta.license || {}).spdx_id || 'Not stated',
    stars: meta.stargazers_count, forks: meta.forks_count,
    homepage: meta.homepage || 'Not stated', branch,
    file_count: fileRows.length, hyperlink_count: linkRows.length,
    files: fileRows, hyperlinks: linkRows,
  };

  let outText;
  if (format === 'csv') outText = '== FILES ==\n' + toCSV(fileRows) + '\n\n== HYPERLINKS ==\n' + toCSV(linkRows);
  else if (format === 'txt') {
    outText = repo + ' — ALL LINKS\n== HYPERLINKS (' + linkRows.length + ') ==\n' +
      linkRows.map(r => '[' + r.category + '] ' + r.url + '  (' + r.found_in + ')').join('\n') +
      '\n\n== FILES (' + fileRows.length + ') ==\n' +
      fileRows.map(r => r.path + '\n  ' + r.github_url + '\n  ' + r.raw_url).join('\n');
  } else outText = JSON.stringify(payload, null, 2);

  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    const f = path.join(outDir, 'repo-links.' + format);
    fs.writeFileSync(f, outText);
    console.error('saved: ' + f);
  } else console.log(outText);
  console.error('done. files=' + fileRows.length + ' links=' + linkRows.length);
}

main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
