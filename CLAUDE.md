# CLAUDE.md — typingkit

Project instructions for Claude Code working in this repo. Inherits the ElevatedProgress
venture playbook from the parent folder's CLAUDE.md.

## What this is

A zero-dependency static-site generator for **free online typing speed tests**. `generate.js`
reads `data/typing.json` + `assets/` and writes one page per real search query into `public/`.
Target: https://typing.elevatedprogress.com/. One SEO page per query (slugs match real
searches): typing-test / typing-speed-test / wpm-test / words-per-minute-test /
typing-practice, plus timed variants (1/2/3/5-minute and one-minute), plus the homepage.

## The product rule

**The tool IS the page.** Unlike the printable tools, this one is *interactive*. Each page
**server-renders the real passage** (as per-character `<span class="ch">`) plus the test UI,
so the text is present for SEO and with JavaScript off. `assets/tool.js` then runs the live
test: it reads keystrokes from a hidden overlay `<textarea>`, flags each character correct
(dark) or incorrect (red), updates **live WPM + accuracy + time**, and shows a results panel
on finish. Restart / the length + difficulty selects rebuild the passage client-side.

Nothing is uploaded; everything runs in the browser. No download or builder flow.

## Reproducible builds (important)

Passage selection uses a **seeded PRNG (mulberry32) in `assets/typing.js`, seeded from the
page slug**, so `node generate.js` emits **byte-identical HTML every build** — no git churn.
Never use `Math.random` for the server-rendered default. The client **Restart** button and
the control changes reseed at random.

`assets/typing.js` is a UMD module required by BOTH `generate.js` (server render + SEO copy)
and `tool.js` (browser). It is the **single source of truth for the WPM math**:
`WPM = (correct characters / 5) / minutes typed`, and `accuracy = correct / typed`. Keep the
formula there so the server copy and the live readout can never drift.

The word + sentence banks are emitted to `public/data.js` (`window.TYPING_DATA`) so the
browser can rebuild passages on Restart / difficulty change without a fetch (self-contained).

## Deploy — just push

`git push` to `main` is the deploy — GitHub Actions (`.github/workflows/deploy.yml`).

- **Never manually build and commit output.** `public/` is git-ignored build output.
- **Never hand-edit anything in `public/`.**
- Commit as the neutral identity:
  `git -c user.name="typingkit" -c user.email="typingkit@users.noreply.github.com" commit …`

## Local build / preview

```
node generate.js     # writes ./public  (prints "Generated N pages")
node server.js       # preview at http://localhost:5084 (5060-5062 are Chrome-blocked ports)
```

## Page families

- `/<slug>/` — one typing-test page per entry in `data/typing.json` `pages[]`. Each sets its
  `group` (tests / timed / practice), `mode` (`passage` | `timed`), optional `limit` seconds,
  `difficulty` (`sentences` | `words`), and SEO copy. Add a page by adding a JSON entry — no
  generator changes needed.
- `/` — homepage, grouped Tests / Timed / Practice.

## Don't break these (generated, must keep serving)

- `ads.txt` + AdSense loader in `<head>` — publisher `ca-pub-5580575158570188`.
- GA4 `G-TJY4TRRKD6` (shared across all EP sites; hostname splits them).
- `sitemap.xml`, `robots.txt`, `.nojekyll`, `CNAME` (typing.elevatedprogress.com).
- `data.js` (client word/sentence banks) — the interactive test needs it.
- GSC verification file once the property is verified.

## Config knobs

`DOMAIN` and `BASE`, same semantics as the other tools. Production values in the workflow.
Passages / word banks live in `data/typing.json`.
