# Meme Toolkit

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)

Zero-dependency Node.js CLI tools for memes and GIFs. No API keys required.

## Tools

| Tool | What it does |
| :--- | :--- |
| [`tools/memegen.cjs`](tools/memegen.cjs) | Generate memes from all 210 [memegen.link](https://memegen.link) templates: template list, search, blank template downloads, and custom meme creation with a configurable watermark stamp (default: `9696`). |
| [`tools/giphy.cjs`](tools/giphy.cjs) | Search [Giphy](https://giphy.com) and download GIFs: title, page URL, direct GIF URL. |
| [`tools/repo-links.cjs`](tools/repo-links.cjs) | Inventory every link in any public GitHub repo: full file tree (GitHub + raw URLs) and every hyperlink in its README/docs. |

## Install

```bash
git clone https://github.com/Jalalkhan96/meme-toolkit.git
cd meme-toolkit
# no npm install needed for the scrapers. tools/memegen.cjs needs jimp only for the watermark stamp:
npm i jimp@0.22.12
```

Requires Node.js 18+.

## Usage

### memegen.cjs

```bash
node tools/memegen.cjs --templates                     # all 210 templates (json)
node tools/memegen.cjs --search "drake"                # search templates
node tools/memegen.cjs --download-templates            # download all blank templates
node tools/memegen.cjs --make drake --top "hello" --bottom "world"
#   -> meme with a "9696" stamp over the original bottom-left mark
#   --watermark "TEXT" (custom) | --nowm (no stamp)
```

> The memegen.link API adds its own server-side mark to generated images.
> Removing it at the source needs the paid API key (`?watermark=` parameter).
> This tool covers it with your own stamp instead.

### giphy.cjs

```bash
node tools/giphy.cjs --search "funny cat" --top 10
node tools/giphy.cjs --search "cat" --top 5 --download          # + download the GIFs
node tools/giphy.cjs --trending --top 10
node tools/giphy.cjs --url https://giphy.com/gifs/<slug>-<id>
#   [--format json|csv|txt] [--out dir]
```

> Giphy's official API now requires a developer key; this tool reads
> Giphy's public search pages instead. GIFs are user uploads — licenses vary.

### repo-links.cjs

```bash
node tools/repo-links.cjs --repo jacebrowning/memegen
node tools/repo-links.cjs --repo jacebrowning/memegen --docs README.md,docs/clients.md --format csv --out ./repo-links
```

## Notes

- All scrapers fail loudly on rate limits instead of faking data.
- Scraped media (memes, GIFs) belongs to its original uploaders — check
  licenses before reuse. Template images on memegen.link are user uploads.

## License

MIT — see [LICENSE](LICENSE).
