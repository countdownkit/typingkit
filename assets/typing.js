/*
 * Shared typing-test logic — used by BOTH generate.js (Node, server render) and
 * tool.js (browser, re-render on control change / restart) so the server-rendered
 * default passage matches what the client can reproduce.
 * UMD-ish: attaches to module.exports under Node, window.TYPE in the browser.
 *
 * A SEEDED PRNG (mulberry32) drives passage selection, seeded from the page slug,
 * so `node generate.js` emits BYTE-IDENTICAL HTML every build (no git churn). The
 * client "Restart" / control changes reseed from a fresh random string.
 *
 * WPM math is here too and is the single source of truth for both server SEO copy
 * and the live client readout: WPM = (correct characters / 5) / minutes typed.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TYPE = factory();
})(typeof self !== "undefined" ? self : this, function () {

  // ---- seeded PRNG (mulberry32), same construction as worksheetkit -----------
  function hashSeed(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeRng(seedStr) { return mulberry32(hashSeed(String(seedStr))); }
  function randInt(rng, min, max) { return min + Math.floor(rng() * (max - min + 1)); }

  // ---- how much text to lay down for a given run ----------------------------
  // Timed runs need a generous buffer; the client also extends the passage as the
  // typist nears the end, so nobody runs out of words.
  function targetWords(mode, limitSec) {
    if (mode === "timed") return Math.max(120, Math.ceil((limitSec || 60) / 60) * 130);
    return 55;
  }

  // ---- passage building ------------------------------------------------------
  // opts: { difficulty "words"|"sentences", seed, words (target count), data }
  //   "words"     -> a stream of common words (no punctuation, no capitals)
  //   "sentences" -> whole sentences from the bank until the word target is met
  function buildPassage(opts) {
    opts = opts || {};
    const data = opts.data || {};
    const rng = makeRng(opts.seed);
    const target = opts.words || 55;

    if (opts.difficulty === "words") {
      const bank = data.words || [];
      if (!bank.length) return "";
      const out = [];
      for (let i = 0; i < target; i++) out.push(bank[randInt(rng, 0, bank.length - 1)]);
      return out.join(" ");
    }

    const bank = data.sentences || [];
    if (!bank.length) return "";
    const out = [];
    let wc = 0, guard = 0;
    while (wc < target && guard++ < 2000) {
      const s = bank[randInt(rng, 0, bank.length - 1)];
      out.push(s);
      wc += s.split(" ").length;
    }
    return out.join(" ");
  }

  // ---- rendering -------------------------------------------------------------
  // Each character becomes a <span class="ch"> so the client can flag it correct
  // or incorrect. Words are wrapped in .word (nowrap) so lines only ever break at
  // the spaces between words — never in the middle of one.
  function esc(ch) {
    return ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch;
  }
  function renderPassage(text) {
    const words = String(text).split(" ");
    let html = "";
    for (let w = 0; w < words.length; w++) {
      html += `<span class="word">`;
      const word = words[w];
      for (let i = 0; i < word.length; i++) html += `<span class="ch">${esc(word[i])}</span>`;
      html += `</span>`;
      if (w < words.length - 1) html += `<span class="ch space" data-sp="1"> </span>`;
    }
    return html;
  }

  // ---- scoring (single source of truth) --------------------------------------
  // WPM = (correct characters / 5) / minutes typed. Rounded to a whole number.
  function wpm(correctChars, elapsedMs) {
    if (!elapsedMs || elapsedMs <= 0) return 0;
    const minutes = elapsedMs / 60000;
    return Math.round((correctChars / 5) / minutes);
  }
  // Accuracy = correct / typed, as a whole percent. Nothing typed yet -> 100%.
  function accuracy(correctChars, typedChars) {
    if (!typedChars) return 100;
    return Math.round((correctChars / typedChars) * 100);
  }

  return {
    hashSeed, mulberry32, makeRng, randInt,
    targetWords, buildPassage, renderPassage, wpm, accuracy,
  };
});
