/*
 * Static generator for the typing-test site.
 * Run: node generate.js   ->   writes everything into ./public
 *
 * The tool IS the page: each page server-renders a real typing passage (as
 * per-character spans) plus the test UI, so the passage is present for SEO and
 * with no JavaScript. `assets/tool.js` then runs the live test — reading
 * keystrokes, scoring WPM + accuracy, timing, and showing results.
 *
 * Passage selection + WPM math live in `assets/typing.js` (a UMD module used by
 * BOTH this generator and the browser). The server seeds passage selection from
 * the page slug, so every build emits byte-identical HTML.
 *
 * Page families:
 *   /<slug>/   one typing-test page per real search (tests / timed / practice)
 *   /          homepage, grouped by kind
 */
const fs = require("fs");
const path = require("path");
const TYPE = require("./assets/typing.js");

// ---- config -------------------------------------------------------------
const DOMAIN = process.env.DOMAIN || "https://typing.elevatedprogress.com";
const BASE = process.env.BASE || "";
const SITE = "Typing Test";
const OUT = path.join(__dirname, "public");
const ASSETS = path.join(__dirname, "assets");
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "typing.json"), "utf8"));

const LENGTHS = [
  { value: "passage", label: "Full passage" },
  { value: "60", label: "1 minute" },
  { value: "120", label: "2 minutes" },
  { value: "180", label: "3 minutes" },
  { value: "300", label: "5 minutes" },
];

// ---- html layout --------------------------------------------------------
function layout({ title, desc, urlPath, h1, body }) {
  const canonical = DOMAIN + BASE + urlPath;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="website">
<link rel="stylesheet" href="${BASE}/styles.css">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5580575158570188" crossorigin="anonymous"></script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-TJY4TRRKD6"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-TJY4TRRKD6');</script>
</head>
<body>
<header class="site-head"><div class="wrap">
  <a class="brand" href="${BASE}/">⌨️ ${SITE}</a>
  <nav class="nav"><a href="${BASE}/#tests">Tests</a><a href="${BASE}/#timed">Timed</a><a href="${BASE}/#practice">Practice</a></nav>
</div></header>
<main class="wrap">
  <div class="crumbs"><a href="${BASE}/">Home</a> ›&nbsp;${h1}</div>
  <h1>${h1}</h1>
  ${body}
</main>
<footer class="site-foot"><div class="wrap">
  <a href="${BASE}/">Home</a><a href="${BASE}/#tests">Typing tests</a><a href="${BASE}/#timed">Timed tests</a><a href="${BASE}/#practice">Practice</a>
  <span>· ${SITE} — free online typing speed tests. Measure your words per minute and accuracy, no signup. Part of <a href="https://elevatedprogress.com/">Elevated Progress</a>. · <a href="https://elevatedprogress.com/privacy/">Privacy Policy</a></span>
</div></footer>
<script src="${BASE}/data.js" defer></script>
<script src="${BASE}/typing.js" defer></script>
<script src="${BASE}/tool.js" defer></script>
</body>
</html>`;
}

function grid(links) {
  return `<div class="grid">` + links.map(l =>
    `<a href="${BASE}${l.href}">${l.emoji ? `<span class="chip-emoji">${l.emoji}</span>` : ""}${l.label}</a>`).join("") + `</div>`;
}

// ---- controls -----------------------------------------------------------
function controls(page) {
  const curLen = page.mode === "timed" ? String(page.limit) : "passage";
  const lenOpts = LENGTHS.map(o => `<option value="${o.value}"${o.value === curLen ? " selected" : ""}>${o.label}</option>`).join("");
  const diffOpts = [["sentences", "Sentences"], ["words", "Common words"]]
    .map(([v, l]) => `<option value="${v}"${v === page.difficulty ? " selected" : ""}>${l}</option>`).join("");
  return `<div class="controls">
    <div class="row">
      <div><label for="len">Test length</label><select id="len" data-ctl="length">${lenOpts}</select></div>
      <div><label for="diff">Text</label><select id="diff" data-ctl="difficulty">${diffOpts}</select></div>
      <div class="restcell"><label>&nbsp;</label><button type="button" class="print-btn" data-ctl="restart">↻ Restart</button></div>
    </div>
  </div>`;
}

// ---- the test block -----------------------------------------------------
function testBlock(page) {
  const mode = page.mode;
  const limit = page.mode === "timed" ? page.limit : 60;
  const words = TYPE.targetWords(mode, limit);
  // Seeded from the slug so the server-rendered default passage is reproducible.
  const passage = TYPE.buildPassage({ difficulty: page.difficulty, seed: page.slug, words, data: DATA });
  const initTime = mode === "timed" ? `${Math.floor(limit / 60)}:${String(limit % 60).padStart(2, "0")}` : "0:00";
  const timeLabel = mode === "timed" ? "Time left" : "Time";
  return `<div class="test" data-test data-mode="${mode}" data-limit="${limit}" data-difficulty="${page.difficulty}" data-slug="${page.slug}">
    <div class="stats">
      <div class="stat"><span class="stat-num" data-stat="wpm">0</span><span class="stat-lab">WPM</span></div>
      <div class="stat"><span class="stat-num" data-stat="acc">100%</span><span class="stat-lab">Accuracy</span></div>
      <div class="stat"><span class="stat-num" data-stat="time">${initTime}</span><span class="stat-lab">${timeLabel}</span></div>
    </div>
    <div class="type-area">
      <div class="passage" data-passage tabindex="0">${TYPE.renderPassage(passage)}</div>
      <textarea class="type-input" data-input aria-label="Type the passage here" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"></textarea>
    </div>
    <p class="hint">Click the text and start typing — the timer begins on your first keystroke. Correct letters turn dark, mistakes turn red.</p>
    <div class="results" data-results hidden>
      <h2 class="res-head">Your result</h2>
      <div class="res-grid">
        <div class="res"><span class="res-num" data-res="wpm">0</span><span class="res-lab">Words / minute</span></div>
        <div class="res"><span class="res-num" data-res="acc">100%</span><span class="res-lab">Accuracy</span></div>
        <div class="res"><span class="res-num" data-res="time">0:00</span><span class="res-lab">Time</span></div>
        <div class="res"><span class="res-num" data-res="chars">0 / 0</span><span class="res-lab">Correct / typed chars</span></div>
      </div>
      <button type="button" class="print-btn" data-ctl="restart">↻ Try again</button>
    </div>
  </div>`;
}

// ---- write helpers ------------------------------------------------------
const urls = [];
function writePage(urlPath, html) {
  const dir = path.join(OUT, urlPath.replace(/^\/+|\/+$/g, ""));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
  urls.push(urlPath);
}

// ---- page builder -------------------------------------------------------
const pageLink = p => ({ href: `/${p.slug}/`, label: p.h1 });

function toolPage(page, related, relatedLabel) {
  const body = `${controls(page)}
  ${testBlock(page)}
  <div class="ad-slot">Advertisement</div>
  <div class="prose">
    ${page.blurb ? `<p>${page.blurb}</p>` : ""}
    ${page.tip ? `<p>${page.tip}</p>` : ""}
    <p><b>How it is scored:</b> WPM is your correct characters divided by five (the standard word length), over the minutes you spent typing — so <b>accuracy is baked into the number</b>. Typos count against both your accuracy percentage and your speed. Everything runs in your browser; nothing is uploaded and there is no account to create.</p>
  </div>
  <h2>More typing tests</h2>
  ${grid(related)}
  <div class="ad-slot">Advertisement</div>`;
  writePage(`/${page.slug}/`, layout({
    title: page.title, desc: page.desc, urlPath: `/${page.slug}/`, h1: page.h1, body,
  }));
}

// ---- build --------------------------------------------------------------
fs.mkdirSync(OUT, { recursive: true });
for (const entry of fs.readdirSync(OUT)) {
  if (entry === ".git" || entry === "CNAME") continue;
  fs.rmSync(path.join(OUT, entry), { recursive: true, force: true });
}
for (const f of fs.readdirSync(ASSETS)) fs.copyFileSync(path.join(ASSETS, f), path.join(OUT, f));

const PAGES = DATA.pages;
for (const page of PAGES) {
  // related = the other pages, this page's own group first for relevance
  const related = PAGES.filter(p => p.slug !== page.slug)
    .sort((a, b) => (a.group === page.group ? -1 : 0) - (b.group === page.group ? -1 : 0))
    .slice(0, 8)
    .map(pageLink);
  toolPage(page, related, "More typing tests");
}

// -- homepage --
{
  const title = `Typing Test — Free Online WPM & Typing Speed Tests`;
  const desc = `Free online typing tests: check your words-per-minute and accuracy with a live typing speed test. One-, two-, three-, and five-minute timed tests plus common-word practice. No signup.`;
  const groups = [
    ["tests", "Typing tests", "Type a passage and get your WPM and accuracy — go as long as you like."],
    ["timed", "Timed tests", "Fixed-length runs — the classic way to benchmark and compare your speed."],
    ["practice", "Practice", "Loose drills to build speed and muscle memory before you test."],
  ];
  let sections = "";
  for (const [id, heading, blurb] of groups) {
    const links = grid(PAGES.filter(p => p.group === id).map(pageLink));
    sections += `<h2 id="${id}">${heading}</h2><p class="lead">${blurb}</p>${links}`;
  }
  const body = `<p class="lead">Free, no-signup typing tests. Pick a test, start typing, and watch your words-per-minute and accuracy update live — with a full score when you finish. Every test runs entirely in your browser.</p>
  ${sections}
  <div class="ad-slot">Advertisement</div>
  <div class="prose"><p>These are real, working typing tests, not a page about typing tests: the passage on each page is the one you type. Speed is measured the standard way — five correct characters make one word — so your words-per-minute here lines up with results anywhere else. Miss a key and it counts against both your accuracy and your speed, exactly as a real test should.</p></div>`;
  writePage(`/`, layout({ title, desc, urlPath: `/`, h1: `Free Online Typing Tests`, body }));
}

// -- client data (word + sentence banks, so the browser can rebuild passages) --
fs.writeFileSync(path.join(OUT, "data.js"),
  `window.TYPING_DATA=${JSON.stringify({ words: DATA.words, sentences: DATA.sentences })};\n`);

// -- sitemap + robots + meta files --
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${DOMAIN}${BASE}${u}</loc></url>`).join("\n")}
</urlset>`;
fs.writeFileSync(path.join(OUT, "sitemap.xml"), sitemap);
fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${DOMAIN}${BASE}/sitemap.xml\n`);
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
fs.writeFileSync(path.join(OUT, "CNAME"), "typing.elevatedprogress.com\n");
fs.writeFileSync(path.join(OUT, "ads.txt"), "google.com, pub-5580575158570188, DIRECT, f08c47fec0942fa0\n");

console.log(`Generated ${urls.length} pages into ./public`);
