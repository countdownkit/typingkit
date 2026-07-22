/*
 * Live typing test. The passage is server-rendered for SEO / no-JS; this drives
 * the interactive run: it reads keystrokes from a hidden textarea, flags each
 * character correct/incorrect, updates live WPM + accuracy + time, and shows a
 * results panel on finish. Restart and the length / difficulty controls rebuild
 * the passage via the shared TYPE module so client output matches the server.
 */
(function () {
  const test = document.querySelector("[data-test]");
  if (!test || !window.TYPE) return;
  const DATA = window.TYPING_DATA || {};
  const T = window.TYPE;

  const passageEl = test.querySelector("[data-passage]");
  const input = test.querySelector("[data-input]");
  const resultsEl = test.querySelector("[data-results]");
  // controls live in the .controls block (a sibling of .test), so look them up
  // document-wide; stats + results are inside .test.
  const ctl = name => document.querySelector(`[data-ctl="${name}"]`);
  const statEl = name => test.querySelector(`[data-stat="${name}"]`);
  const resEl = name => test.querySelector(`[data-res="${name}"]`);

  let mode = test.dataset.mode;                 // "passage" | "timed"
  let limitSec = +test.dataset.limit || 60;
  let difficulty = test.dataset.difficulty || "sentences";

  let chars = [];        // the .ch spans, in order
  let expected = "";     // the string they spell out
  let started = false, finished = false, startTime = 0, timerId = null, lastCorrect = 0;

  const limitMs = () => limitSec * 1000;
  function fmt(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  function collect() {
    chars = Array.prototype.slice.call(passageEl.querySelectorAll(".ch"));
    expected = chars.map(c => c.textContent).join("");
  }

  function baseClass(c) { return "ch" + (c.dataset.sp ? " space" : ""); }

  function paint(typedLen) {
    let correct = 0;
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      let cls = baseClass(c);
      if (i < typedLen) {
        if (input.value[i] === expected[i]) { cls += " correct"; correct++; }
        else cls += " incorrect";
      } else if (i === typedLen) {
        cls += " current";
      }
      c.className = cls;
    }
    lastCorrect = correct;
    return correct;
  }

  function setStats(correct, typedLen, elapsed) {
    statEl("wpm").textContent = String(T.wpm(correct, elapsed));
    statEl("acc").textContent = T.accuracy(correct, typedLen) + "%";
    statEl("time").textContent = mode === "timed" ? fmt(limitMs() - elapsed) : fmt(elapsed);
  }

  function resetState() {
    if (timerId) { clearInterval(timerId); timerId = null; }
    started = false; finished = false; startTime = 0; lastCorrect = 0;
    input.value = "";
    input.disabled = false;
    collect();
    for (const c of chars) c.className = baseClass(c);
    if (chars[0]) chars[0].className = baseClass(chars[0]) + " current";
    resultsEl.hidden = true;
    test.classList.remove("done");
    setStats(0, 0, 0);
  }

  function rebuild() {
    const words = T.targetWords(mode, limitSec);
    const text = T.buildPassage({ difficulty, seed: "r" + Math.random(), words, data: DATA });
    passageEl.innerHTML = T.renderPassage(text);
    resetState();
  }

  // Timed runs: keep enough text ahead of the typist so they never run out.
  function maybeExtend(typedLen) {
    if (mode !== "timed") return;
    if (expected.length - typedLen > 60) return;
    const more = T.buildPassage({ difficulty, seed: "x" + Math.random(), words: 40, data: DATA });
    passageEl.insertAdjacentHTML("beforeend",
      `<span class="ch space" data-sp="1"> </span>` + T.renderPassage(more));
    collect();
  }

  function startTimer() {
    timerId = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (mode === "timed" && elapsed >= limitMs()) { finish(); return; }
      setStats(lastCorrect, input.value.length, elapsed);
    }, 150);
  }

  function finish() {
    if (finished) return;
    finished = true;
    if (timerId) { clearInterval(timerId); timerId = null; }
    const elapsed = mode === "timed" ? limitMs() : (started ? Date.now() - startTime : 0);
    const typedLen = input.value.length;
    const correct = lastCorrect;
    input.disabled = true;
    for (const c of chars) c.classList.remove("current");

    resEl("wpm").textContent = String(T.wpm(correct, elapsed));
    resEl("acc").textContent = T.accuracy(correct, typedLen) + "%";
    resEl("time").textContent = fmt(elapsed);
    resEl("chars").textContent = correct + " / " + typedLen;
    statEl("time").textContent = mode === "timed" ? "0:00" : fmt(elapsed);
    resultsEl.hidden = false;
    test.classList.add("done");
  }

  function onInput() {
    if (finished) return;
    if (input.value.length > expected.length) input.value = input.value.slice(0, expected.length);
    const typedLen = input.value.length;
    if (!started && typedLen > 0) { started = true; startTime = Date.now(); startTimer(); }
    const correct = paint(typedLen);
    const elapsed = started ? Date.now() - startTime : 0;
    setStats(correct, typedLen, elapsed);
    if (mode === "timed") maybeExtend(typedLen);
    else if (typedLen >= expected.length && expected.length > 0) finish();
  }

  // ---- wiring ----------------------------------------------------------------
  input.addEventListener("input", onInput);
  passageEl.addEventListener("mousedown", () => setTimeout(() => input.focus(), 0));
  test.addEventListener("click", e => { if (!e.target.closest("[data-ctl], [data-results]")) input.focus(); });

  // both the main Restart button and the results-panel "Try again" button
  document.querySelectorAll('[data-ctl="restart"]').forEach(b =>
    b.addEventListener("click", () => { rebuild(); input.focus(); }));

  const lenCtl = ctl("length");
  if (lenCtl) lenCtl.addEventListener("change", e => {
    const v = e.target.value;
    if (v === "passage") { mode = "passage"; }
    else { mode = "timed"; limitSec = +v; }
    test.dataset.mode = mode; test.dataset.limit = String(limitSec);
    rebuild(); input.focus();
  });

  const diffCtl = ctl("difficulty");
  if (diffCtl) diffCtl.addEventListener("change", e => {
    difficulty = e.target.value; test.dataset.difficulty = difficulty;
    rebuild(); input.focus();
  });

  // sync controls to the page's starting config, then arm the initial state
  if (lenCtl) lenCtl.value = mode === "timed" ? String(limitSec) : "passage";
  if (diffCtl) diffCtl.value = difficulty;
  resetState();
})();
