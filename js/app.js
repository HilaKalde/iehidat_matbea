/* =========================================================================
   מנוע הלומדה – חדר כושר פיננסי / יחידת מטבע
   במה קבועה 1200×675. כל מסך = .screen בתוך #screens (מבנה ידידותי להמרה ל-Storyline).
   החלקים המשותפים (כרום, ניווט, פתיחה, תפריט, בוסט, סיכום, מתיחות, אימון מתקדם) – כמו ביחידת אמצעי תשלום.
   ========================================================================= */
(function () {
  "use strict";

  const W = 1200, H = 675;
  const IMG = "assets/img/", UI = "assets/ui/", ICON = "assets/icons/", AUDIO = "assets/audio/", VID = "assets/video/", BN = "assets/bn/";
  const byId = {};
  DATA.screens.forEach((s, i) => { s.index = i; byId[s.id] = s; });

  /* ---------------------------------------------------------------- state */
  const STORE = "currency-gym-v1";
  const fresh = () => ({ answers: {}, done: {}, seen: {}, visited: {}, sound: true });
  let state = fresh();
  let firstVisit = true;
  try { const raw = localStorage.getItem(STORE); if (raw) state = Object.assign(state, JSON.parse(raw)); } catch (e) {}
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} };

  const ans = id => state.answers[id];
  const isDone = id => !!(ans(id) && ans(id).completed);
  const setAns = (id, a) => { state.answers[id] = a; save(); };
  // functional set: 2 points for every correct item (48 items = 96) + 4 bonus points once all six stations are done = 100
  const FN_PT = 2, FN_BONUS = 4;
  const fnBonus = () => DATA.screens.filter(x => x.type === "station").every(x => isDone(x.id)) ? FN_BONUS : 0;
  const setScore = set => DATA.screens.filter(s => s.set === set).reduce((sum, s) => sum + ((ans(s.id) && ans(s.id).points) || 0), 0) + (set === "functional" ? fnBonus() : 0);
  // stretching: 1,000 ₪, 100 ₪ off for every wrong answer (and, at the end, for every unanswered one)
  const STRETCH = DATA.screens.filter(s => s.mode === "stretch");
  const bank = (final) => 1000 - 100 * STRETCH.filter(s => isDone(s.id) ? !ans(s.id).correct : !!final).length;

  /* feedback sound – a quiet extra layer on top of the visual feedback */
  const SFX = { correct: { src: AUDIO + "fb-correct.mp3", vol: .14 }, wrong: { src: AUDIO + "fb-wrong.wav", vol: .21 } };
  const sfx = {}; let sfxNow = null;
  function stopFeedbackSound() { if (!sfxNow) return; try { sfxNow.pause(); sfxNow.currentTime = 0; } catch (e) {} sfxNow = null; }
  function playFeedbackSound(ok) {
    stopFeedbackSound();
    if (!state.sound) return;
    const k = ok ? "correct" : "wrong";
    if (!sfx[k]) { sfx[k] = new Audio(SFX[k].src); sfx[k].volume = SFX[k].vol; }
    sfxNow = sfx[k];
    try { sfxNow.currentTime = 0; const p = sfxNow.play(); if (p) p.catch(() => {}); } catch (e) {}
  }

  /* -------------------------------------------------------------- helpers */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const pos = (l, t, w, h) => `left:${l}px;top:${t}px;` + (w != null ? `width:${w}px;` : "") + (h != null ? `height:${h}px;` : "");
  const A = (kind, d) => `a ${kind}" data-d="${d}`;       // used inside class="…" – entrance animation + delay
  const linkUrl = key => (key && LINKS[key]) || "";
  const MONEY_RE = /([\d][\d,]*(?:\.\d+)?)\s*₪/g;
  const money = html => html.replace(MONEY_RE, (m, a) => `<span class="money-value" dir="ltr"><span class="currency">₪</span><span class="amount">${a}</span></span>`);
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const alive = scr => scr.isConnected && scr.classList.contains("active");

  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.style.display = "block";
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.style.display = "none"), 2200);
  }
  function openLink(key) {
    const url = linkUrl(key);
    if (url) window.open(url, "_blank", "noopener"); else toast("הקישור יתווסף בהמשך");
  }

  /* character images: natural size of each PNG, so any height keeps the ratio */
  const NAT = { "adam": [512, 768], "aya": [512, 768], "adam-hips": [512, 768], "aya-hips": [512, 768],
    "adam-flex": [512, 768], "aya-flex": [512, 768], "aya-adam-like": [512, 768] };
  function hero(name, l, t, h, cls = "", alt = "") {
    const [nw, nh] = NAT[name];
    return `<img class="char ${cls}" data-hero="${name}" src="${IMG + name}.png" alt="${alt}" style="${pos(l, t, Math.round(h * nw / nh), h)}">`;
  }

  /* GIFs restart from frame 1: fetched once, then a fresh object URL every time (file:// falls back to a cache-busting query) */
  const gifBlobs = {};
  function gifUrl(file) {
    if (!gifBlobs[file]) gifBlobs[file] = fetch(IMG + file).then(r => (r.ok ? r.blob() : null)).catch(() => null);
    return gifBlobs[file].then(b => (b ? URL.createObjectURL(b) : IMG + file + "?r=" + Date.now()));
  }
  // one repetition of an exercise GIF, then back to its still (first frame on the same canvas)
  function playOnce(img, base, ms) {
    if (!img) return Promise.resolve();
    return gifUrl(base + ".gif").then(u => {
      if (!img.isConnected) return;
      img.src = u;
      clearTimeout(img._rep);
      return new Promise(r => { img._rep = setTimeout(() => { if (img.isConnected) img.src = IMG + base + ".png"; r(); }, ms); });
    });
  }
  const playWebp = (img, base) => gifUrl(base + ".webp").then(u => { if (img && img.isConnected) img.src = u; });

  const CLOSE_X = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`;
  function layerHtml(id, inner) { return `<div class="layer" data-layer="${id}"><div class="dim"></div>${inner}</div>`; }
  const modalMode = on => $("#stage").classList.toggle("modal-open", on);
  function showLayer(scr, id) { const L = $(`[data-layer="${id}"]`, scr); if (L) { L.classList.add("show"); modalMode(true); fixOrphans(L); const f = $(".close-x", L); if (f) f.focus({ preventScroll: true }); } }
  function hideLayer(L) { L.classList.remove("show"); modalMode(false); $$("iframe", L).forEach(f => f.remove()); }

  function fbHtml(ok, head, body, points, action) {
    return `<div class="ifb-row"><p class="ifb-head">${head}</p>${points ? `<span class="ifb-coins"><span class="coin sm"></span>+${points} מטבעות</span>` : ""}</div>` +
      (body ? `<div class="ifb-body">${money(body)}</div>` : "") + (action || "");
  }
  function showFb(box, ok, html, focus = true) {
    box.classList.remove("ok", "bad"); box.classList.add("inline-fb", ok ? "ok" : "bad");   // keeps the box's own placement class
    box.innerHTML = html; box.hidden = false;
    fixOrphans(box);
    if (focus) box.focus({ preventScroll: true });
  }

  /* a countdown bar: resolves when the time is up or stop() is called */
  function countdown(bar, sec, label) {
    let stopped = false, t0 = performance.now(), raf, resolve;
    const p = new Promise(r => (resolve = r));
    const tick = now => {
      if (stopped) return;
      const left = Math.max(0, sec - (now - t0) / 1000);
      if (bar.isConnected) { bar.style.setProperty("--p", (left / sec * 100) + "%"); bar.classList.toggle("low", left <= Math.min(5, sec / 4)); if (label) label.textContent = Math.ceil(left); }
      if (left <= 0 || !bar.isConnected) { stopped = true; resolve("time"); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return { done: p, stop: () => { if (!stopped) { stopped = true; cancelAnimationFrame(raf); resolve("stop"); } } };
  }
  /* the exercise instruction, highlighted, with a clock badge for its time limit ("2 דקות", "60 שניות", or "ללא הגבלת זמן") */
  function taskBox(text, sec) {
    const badge = !sec ? `<small class="nolimit">ללא<br>זמן</small>` : sec >= 120 && sec % 60 === 0 ? `<b>${sec / 60}</b><small>דקות</small>` : `<b>${sec}</b><small>שניות</small>`;
    return `<div class="task-box"><span class="tb-clock" aria-hidden="true"><svg viewBox="0 0 40 40"><circle cx="20" cy="22" r="15" fill="none" stroke="currentColor" stroke-width="3"/><path d="M20 22V13M20 22l6 4" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M15 4h10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>${badge}</span><p>${text}</p></div>`;
  }
  const timerHtml = (cls = "") => `<div class="tbar ${cls}" data-tbar><span class="tb-fill"></span><span class="tb-sec"><bdi data-tsec></bdi>&nbsp;שנ'</span></div>`;

  /* pointer drag: chips [data-chip] onto targets [data-drop]; a click on a chip and then on a target does the same */
  function dragKit(scr, onDrop) {
    let armed = null;
    const targets = () => $$("[data-drop]:not(.filled), [data-drop].swap", scr);   // .swap: a filled target that can be replaced
    const arm = c => { armed = c; $$("[data-chip]", scr).forEach(x => x.classList.toggle("armed", x === c)); targets().forEach(t => t.classList.toggle("ready", !!c)); };
    $$("[data-chip]", scr).forEach(chip => {
      chip.addEventListener("click", () => { if (chip.disabled || chip.dataset.dragged) { delete chip.dataset.dragged; return; } arm(armed === chip ? null : chip); });
      chip.addEventListener("pointerdown", e => {
        if (chip.disabled || e.button) return;
        e.preventDefault();                                     // no text selection / native drag while dragging
        const st = $("#stage").getBoundingClientRect(), k = st.width / W;
        const r0 = chip.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
        let ghost = null;
        const move = ev => {
          const dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k;
          if (!ghost && Math.hypot(dx, dy) < 6) return;
          if (!ghost) {
            ghost = chip.cloneNode(true); ghost.classList.add("ghost"); ghost.removeAttribute("data-chip");
            ghost.style.cssText = `position:absolute;z-index:70;left:${(r0.left - st.left) / k}px;top:${(r0.top - st.top) / k}px;width:${r0.width / k}px;height:${r0.height / k}px;margin:0;pointer-events:none;transition:none;animation:none;will-change:transform;`;   // no easing: the copy must follow the pointer exactly
            scr.appendChild(ghost); chip.classList.add("lifted"); targets().forEach(t => t.classList.add("ready"));
          }
          ghost.style.transform = `translate(${dx}px,${dy}px)`;
          const hit = document.elementFromPoint(ev.clientX, ev.clientY);
          targets().forEach(t => t.classList.toggle("over", !!hit && t.contains(hit)));
        };
        const up = ev => {
          window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
          if (!ghost) return;
          chip.dataset.dragged = "1"; ghost.remove(); chip.classList.remove("lifted");
          const hit = document.elementFromPoint(ev.clientX, ev.clientY);
          const tgt = hit && hit.closest("[data-drop]:not(.filled), [data-drop].swap");
          targets().forEach(t => t.classList.remove("over", "ready"));
          if (tgt && scr.contains(tgt)) onDrop(chip, tgt);
          setTimeout(() => delete chip.dataset.dragged, 0);
        };
        window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
      });
    });
    scr.addEventListener("click", e => {
      const t = e.target.closest("[data-drop]");
      if (!t || !armed || (t.classList.contains("filled") && !t.classList.contains("swap"))) return;
      const c = armed; arm(null); onDrop(c, t);
    });
    return { reset: () => arm(null) };
  }

  /* banknote image or a placeholder card (a banknote still missing from the assets) */
  const BN_NAT = { "szold-5": [540, 315], "shazar-200": [820, 448], "leah-100": [820, 403], "montefiore-1": [540, 302], "sharett-20": [820, 448], "agnon-50": [820, 451], "alterman-200": [819, 386], "bengurion-50": [519, 258], "einstein-5": [519, 256], "eshkol-5000": [516, 283],
    "golda-10000": [517, 286], "herzl-10": [519, 265], "rachel-20": [820, 447], "rambam-1000": [518, 282], "rothschild-500": [519, 288],
    "tchernichovsky-50": [428, 222] };
  // centre of the portrait on each note (x, y as a fraction) and the width of the crop (fraction of the note)
  const PORTRAIT = { "szold-5": [.74, .5, .38], "shazar-200": [.73, .52, .38], "leah-100": [.74, .42, .25], "montefiore-1": [.72, .52, .34], "sharett-20": [.72, .5, .38], "agnon-50": [.73, .5, .4], "alterman-200": [.65, .42, .36], "bengurion-50": [.63, .48, .4], "einstein-5": [.79, .55, .3], "eshkol-5000": [.8, .42, .36],
    "golda-10000": [.79, .45, .36], "herzl-10": [.5, .52, .34], "rachel-20": [.64, .45, .34], "rambam-1000": [.74, .47, .4],
    "rothschild-500": [.67, .48, .4], "tchernichovsky-50": [.76, .55, .34] };
  const bnImg = (bn, alt, cls = "") => bn ? `<img class="bn ${cls}" src="${BN + bn}.jpg" alt="${alt}">`
    : `<span class="bn bn-missing ${cls}" role="img" aria-label="${alt}"><span>תמונת השטר<br>תתווסף בהמשך</span></span>`;
  function portraitHtml(bn, name, w, h) {
    if (!bn || !PORTRAIT[bn]) return `<span class="portrait missing" style="width:${w}px;height:${h}px" role="img" aria-label="${name}"><svg viewBox="0 0 60 70" aria-hidden="true"><circle cx="30" cy="24" r="13"/><path d="M6 70c2-17 12-25 24-25s22 8 24 25z"/></svg></span>`;
    const [nw, nh] = BN_NAT[bn], [cx, cy, f] = PORTRAIT[bn];
    const imgW = w / f, imgH = imgW * nh / nw;                      // the note scaled so the crop is w wide
    const left = Math.min(0, Math.max(w - imgW, w / 2 - cx * imgW)), top = Math.min(0, Math.max(h - imgH, h / 2 - cy * imgH));
    return `<span class="portrait" style="width:${w}px;height:${h}px" role="img" aria-label="${name} – מתוך השטר">
      <img src="${BN + bn}.jpg" alt="" style="width:${imgW}px;height:${imgH}px;left:${left}px;top:${top}px"></span>`;
  }

  /* ------------------------------------------------------------ renderers */
  const R = {};

  /* the orange title tag, drawn as a vector (title-pill.png is only 249×67 and blurs when enlarged): tilted pill + white star */
  // vector redraw of title-pill.png (249×67): the same tilted pill and 8-ray star, at any width (vw = pill length in the PNG's units)
  const TITLE_PILL = (vw = 249) => `<svg class="pill-svg" viewBox="0 0 ${vw} 67" aria-hidden="true" focusable="false"><rect x="1" y="5" width="${vw - 16}" height="49" rx="24.5" transform="rotate(3.2 ${(vw - 16) / 2} 30)" fill="#FFAA00"/><g stroke="#FFFFFF" stroke-width="3.4" transform="translate(${vw - 22} 17)"><path d="M0-16.5V16.5M-17 0H17M-11.5-11.5L11.5 11.5M-11.5 11.5L11.5-11.5"/></g></svg>`;
  R.intro = s => `
    <img class="bg" src="${IMG}bg-hall.jpg" alt="">
    ${hero("adam", 40, 175, 490, A("fly-l", 300))}
    ${hero("aya", 833, 170, 495, A("fly-r", 450))}
    <div class="intro-title ${A("fly-t", 0)}">${TITLE_PILL()}<span>${s.title}</span></div>
    <div class="card intro-card ${A("fade", 350)}">
      <p class="txt">${s.text}</p><p class="txt">${s.text2}</p>
    </div>
    <div class="start-wrap"><button class="start-btn ${A("pop", 800)}" data-go="${s.next}">${s.button}</button></div>`;

  R.menu = s => {
    const pill = (set, go, p, i) => {
      const st = SETS[set];
      return `<div class="machine-pill ${A("pop", 250 + i * 150)}" data-go="${go}" data-machine="${set}" tabindex="0" role="button"
        aria-label="${st.title} – ${st.sub}" style="${pos(p[0], p[1], 200, 75)}">
        <img src="${UI}pill-chapter.png" alt="">
        <div class="pt"><b>${st.title}</b><small>${st.sub}</small></div>
        ${state.done[set] ? `<div class="check" aria-label="הושלם">✓</div>` : ""}
      </div>`;
    };
    const machines = s.machines.map((m, i) => `
      <img class="machine-img m-${m.set}" src="${IMG + m.img}" alt="" data-machine-hit="${m.set}" data-go-machine="${m.go}" style="${pos(...m.box)}">
      ${pill(m.set, m.go, m.pill, i)}`).join("");
    const tabs = s.tabs.map((t, i) => {
      const icon = `<img class="tab-ic" src="${ICON + t.icon}" alt="">`, label = `<span class="tab-tx">${t.label}</span>`;
      return `<button class="side-tab ${t.side} ${A(t.side === "right" ? "fly-r" : "fly-l", 900 + i * 120)}" data-go="${t.go}"
        style="top:${t.top}px;">${t.side === "right" ? icon + label : label + icon}</button>`;
    }).join("");
    return `
      <img class="bg" src="${IMG}bg-hall.jpg" alt="">
      <div class="hang-panel menu-panel ${A("fly-t", 0)}">
        ${s.title ? `<div class="h-title">${s.title}</div>` : ""}
        <p class="txt">${s.text}</p>
        <p class="instr">${s.instruction}</p>
      </div>
      <div class="intro-title on-menu ${A("fly-r", 150)}">${TITLE_PILL(196)}<span>${s.pillTitle}</span></div>
      <div class="boi-logo ${A("fly-t", 100)}"><img src="${UI}logo-boi.png" alt="בנק ישראל"></div>
      ${machines}
      <img class="char menu-char ${A("fade", 500)}" src="${IMG}adam-sit.png" alt="" style="${pos(300, 340, 330, 330)}">
      <img class="char menu-char ${A("fade", 600)}" src="${IMG}aya-sit.png" alt="" style="${pos(585, 334, 330, 330)}">
      ${tabs}`;
  };

  R.warmup = s => `
    <video class="bg" src="${VID}warmup-aya.mp4" autoplay muted loop playsinline aria-hidden="true" tabindex="-1"></video>
    <div class="warmup-panel ${A("fade", 0)}">
      <p class="txt warmup-intro">${s.text}</p>
      <ul class="warmup-list">${s.items.map(it => `<li>${it}</li>`).join("")}</ul>
      <p class="warmup-outro">${s.outro}</p>
    </div>`;

  /* boost screen (as in the interest-rate and payments units): text on the wall, peeking characters, the TV as a player */
  R.boost = s => `
    <img class="bg" src="${IMG}bg-tv3.jpg" alt="">
    <div class="boost-shade" aria-hidden="true"></div>
    <p class="boost-text ${A("fade", 200)}">${s.text}</p>
    <img class="char boost-peek left ${A("fly-l", 300)}" src="${IMG}boost-adam-peek.webp" alt="">
    <img class="char boost-peek right ${A("fly-r", 400)}" src="${IMG}boost-aya-peek.webp" alt="">
    <div class="tv boost-tv film-box ${A("fade", 500)}" data-film>
      <div class="tv-veil" aria-hidden="true"></div>
      <p class="tv-soon" data-soon hidden>סרטון יתווסף בהמשך</p>
      <button type="button" class="tv-btn play" aria-label="הפעלת הסרטון" title="הפעלת הסרטון"><img src="${UI}play.png" alt=""></button>
    </div>`;
  /* PLAY: the set's film plays inside the lomda, over the whole stage (YouTube embed); ✕ closes it and stops it.
     A set without a film yet shows "סרטון יתווסף בהמשך" on the TV. */
  function openFilm(scr, v) {
    // YouTube refuses to play an embedded video without a referring site (error 153, "שגיאה בהגדרות של נגן הווידאו"),
    // which is the case when the lomda is opened straight from the disk (file://) – then the film opens on YouTube
    if (location.protocol === "file:") { window.open("https://www.youtube.com/watch?v=" + v.yt, "_blank", "noopener"); return; }
    const ov = document.createElement("div");
    ov.className = "film-full"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", v.title);
    ov.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${v.yt}?autoplay=1&rel=0&modestbranding=1&playsinline=1&origin=${encodeURIComponent(location.origin)}" title="${v.title}"
        referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>
      <button type="button" class="close-x film-close" aria-label="סגירת הסרטון">${CLOSE_X}</button>`;
    const close = () => { ov.remove(); modalMode(false); document.removeEventListener("keydown", esc); };
    const esc = e => { if (e.key === "Escape") close(); };
    $(".film-close", ov).addEventListener("click", close);
    document.addEventListener("keydown", esc);
    scr.appendChild(ov); modalMode(true);
    $(".film-close", ov).focus({ preventScroll: true });
  }
  function bindBoost(scr, s) {
    const box = $("[data-film]", scr), playBtn = $(".tv-btn.play", box), v = VIDEOS[s.video];
    playBtn.addEventListener("click", () => {
      if (v && v.yt) { openFilm(scr, v); return; }
      $("[data-soon]", box).hidden = false; playBtn.hidden = true;
    });
  }

  /* ------------------------------------------------ functional: timeline */
  const visited = s => (state.visited[s.id] || []);
  const markVisited = (s, key) => { const v = visited(s); if (!v.includes(key)) { state.visited[s.id] = v.concat(key); save(); } };
  const allVisited = s => (s.eras || []).every(it => visited(s).includes(it.key));
  R.timeline = s => `
    <img class="bg" src="${IMG}bg-clean.jpg" alt="">
    <div class="q-scrim" aria-hidden="true"></div>
    <div class="tl-head ${A("fade", 0)}"><div class="h-title">${s.title}</div><p class="txt">${s.lead}</p></div>
    <div class="tl-line ${A("fade", 200)}" aria-hidden="true"></div>
    <ol class="tl">
      ${s.eras.map((e, i) => `
        <li class="${A("pop", 250 + i * 110)}">
          <button type="button" class="tl-btn ${visited(s).includes(e.key) ? "seen" : ""}" data-era="${e.key}" aria-label="${i + 1}. ${e.label} – ${e.when}">
            <span class="tl-n">${i + 1}</span>
            <span class="tl-img"><img src="${IMG + e.img}" alt=""></span>
            <span class="tl-lbl">${e.label}</span>
            <span class="tick" aria-hidden="true">✓</span>
          </button>
          <span class="tl-when">${e.when}</span>
        </li>`).join("")}
    </ol>
    <p class="ex-progress tl-prog ${allVisited(s) ? "done" : ""}" data-ex-progress>${allVisited(s) ? "כל הכבוד! הכרתם את כל המסלול – אפשר להמשיך." : "לחצו על כל אחד מששת השלבים"}</p>
    ${s.eras.map((e, i) => layerHtml("era-" + e.key, `
      <div class="modal card era-modal" role="dialog" aria-label="${e.label}">
        <button class="close-x" data-close="1" aria-label="סגירה">${CLOSE_X}</button>
        <div class="era-grid">
          <img src="${IMG + e.img}" alt="">
          <div>
            <span class="num-chip">שלב ${i + 1} · ${e.when}</span>
            <div class="h-title">${e.label}</div>
            <p class="exm-p">${e.text}</p>
            <p class="era-st">באימון: <b>תחנת ${e.station}</b></p>
          </div>
        </div>
      </div>`)).join("")}`;
  function bindTimeline(scr, s) {
    $$("[data-era]", scr).forEach(b => b.addEventListener("click", () => { markVisited(s, b.dataset.era); b.classList.add("seen"); showLayer(scr, "era-" + b.dataset.era); }));
    scr._onLayerClose = () => {
      const p = $("[data-ex-progress]", scr);
      if (allVisited(s) && !p.classList.contains("done")) { p.textContent = "כל הכבוד! הכרתם את כל המסלול – אפשר להמשיך."; p.classList.add("done", "a", "pop"); }
      updateChrome(s);
    };
  }

  /* ------------------------------------------------ functional: how-to */
  const stations = () => DATA.screens.filter(x => x.type === "station");
  const ERA_IMG = ["era-barter.png", "era-commodity.png", "era-metal.png", "era-coin.png", "era-note.png", "era-digital.png"];
  const TASK_SHORT = { squat: "בוחרים 2 בכל סעיף", plank: "בוחרים 2 בכל סעיף", situp: "גוררים תכונה אחת", lunge: "3 צעדים, בוחרים רכיב", pushup: "בוחרים מאפיין אחד", sprint: "בוחרים 2 בכל סעיף" };
  R.fhowto = s => `
    <img class="bg" src="${IMG}bg-mats.jpg" alt="">
    <div class="q-scrim" aria-hidden="true"></div>
    <div class="fh-wrap ${A("rise", 100)}">
      <div class="h-title">${s.title}</div>
      <p class="txt fh-lead">${s.lead}</p>
      <ol class="fh-list">
        ${stations().map((x, i) => `<li><img src="${IMG + ERA_IMG[i]}" alt=""><span class="fh-n">תחנה ${i + 1}</span><b>${x.exName}</b><span class="fh-topic">${x.topic}</span><img class="fh-fig fh-${x.ex}" src="${IMG}fh-${x.ex}.webp" alt=""></li>`).join("")}
      </ol>
      ${s.tip ? `<p class="fh-tip">${s.tip}</p>` : ""}
      <div class="wall-actions"><button class="btn practice-btn" data-go="${s.next}">${s.button}</button></div>
    </div>`;

  /* ------------------------------------------------ functional: stations */
  // Adam and Aya on the two mats of bg-mats (feet on y ≈ 640). still = frame 1 of each GIF, same canvas.
  // intro: the station's opening card only – one figure does the exercise ("gif": its GIF loops, "bob": a still pose moving
  // gently up and down, "still": the pose as is), the other stands (Adam arms crossed / Aya hands on hips);
  // once the practice starts both are back to the practice figures. Sprint: no intro change.
  const STAND = { m: ["adam-arms", [872, 226, 274, 410]], w: ["aya-hips", [54, 226, 274, 410]] };
  const EX = {
    squat:  { w: ["squat-w", [0, 232, 315, 420]], m: ["squat-m", [885, 232, 315, 420]], ms: 3240, intro: { does: "w", how: "gif", gif: ["squat-w", [45, 232, 315, 420]] } },   // on the opening card Aya a little right, on the mat
    situp:  { w: ["situp-w", [50, 292, 285, 380]], m: ["situp-m", [830, 292, 285, 380]], ms: 1680, intro: { does: "w", how: "gif" } },
    pushup: { w: ["pushup-w", [85, 440, 330, 186]], m: ["pushup-m", [790, 440, 330, 186]], ms: 2200, intro: { does: "m", how: "gif" } },
    plank:  { w: ["aya-plank", [78, 398, 315, 210]], m: ["adam-plank", [820, 398, 315, 210]], intro: { does: "m", how: "still" } },   // centred on the two mats
    // lunges – both GIFs on a 1280×720 transparent canvas (לאנגים.gif: Aya, feet at y ≈ 690; בחור עושה לאנגים.gif: Adam,
    // feet at y ≈ 684, mirrored so he faces left); both GIFs rotated to start (and end) standing, the stills = their first frames. Opening card: Aya lunges, Adam stands;
    // the practice: both still, one lunge round after a correct answer
    lunge:  { w: ["lunge-w", [-154, 250, 704, 396]], m: ["lunge-m", [577, 194, 813, 457]], ms: 5080, wide: true, flipM: true,
            intro: { does: "w", how: "gif" } },
    // sprint: Adam stands with his arms crossed; Aya crouches (ספרינט אישה) → gets ready (אישה מתכוננת לרוץ) → runs out to the left
    sprint: { w: ["sprint-w", [40, 372, 390, 260]], m: ["adam-arms", [850, 268, 248, 372]], ready: "sprint-ready", run: "sprint-run",
              playBox: [60, 398, 351, 234] }   // in the questions Aya ~10% smaller (same feet line and centre)
  };
  function stepperHtml(cur) {
    const steps = stations().map((x, i) => {
      const a = ans(x.id), done = !!(a && a.completed), here = x.id === cur.id;
      return `<button type="button" class="stp ${done ? "done" : ""} ${here ? "here" : ""}" data-go="${x.id}" ${here ? 'aria-current="step"' : ""}
          aria-label="תחנה ${i + 1} – ${x.exName}, ${x.topic}${done ? `, הושלמה (${a.points} מטבעות)` : ""}">
        <span class="stp-dot"><img src="${IMG + ERA_IMG[i]}" alt="">${done ? `<span class="stp-ok" aria-hidden="true">✓</span>` : ""}</span>
        <span class="stp-lbl">${i + 1}. ${x.exName}</span>
      </button>`;
    }).join("");
    return `<nav class="st-stepper six" aria-label="התקדמות בתחנות"><span class="stp-line" aria-hidden="true"></span>${steps}</nav>`;
  }
  const maxPoints = s => s.rows.reduce((n, r) => n + r.correct.length, 0);
  R.station = s => {
    const ex = EX[s.ex], first = firstVisit;
    const fig = (k, cls) => `<img class="char ex-fig ${ex.wide ? "ex-nohit" : ""} ${first ? A(k === "w" ? "fly-l" : "fly-r", 200) : ""}" data-fig="${k}" data-base="${ex[k][0]}" src="${IMG + ex[k][0]}.png" alt="" style="${pos(...ex[k][1])}">`;
    return `
      <img class="bg" src="${IMG}bg-mats.jpg" alt="">
      <div class="q-scrim light" aria-hidden="true"></div>
      ${fig("w")}${fig("m")}
      <div class="stepper-wrap" data-stepper>${stepperHtml(s)}</div>
      <div class="card st-card ${first ? A("fly-b", 0) : ""}" data-card>
        <div class="st-head"><span class="num-chip">תחנה ${s.num}</span><span class="st-title">${s.exName} – ${s.topic}</span></div>
        <div data-phase="intro">
          <p class="st-intro">${s.intro}</p>
          <p class="st-task"><span class="ic-task sec" aria-label="${s.sec} שניות לכל סעיף"><b>${s.sec}</b><small>שניות</small></span><span>${s.task}</span></p>
          <div class="st-actions"><button type="button" class="btn practice-btn" data-start>מתחילים!</button></div>
        </div>
        <div data-phase="play" hidden>
          <div class="st-meta"><span class="st-rowno" data-rowno></span>${timerHtml()}<span class="st-pts" aria-live="polite"><span class="coin sm"></span><bdi data-pts>0</bdi></span></div>
          <p class="st-q" data-q hidden></p>
          <div class="st-items ${s.drag ? "drag" : ""}" data-items></div>
          ${s.drag ? `<div class="bars-drop" data-drop="bars"><img src="${IMG}era-metal.png" alt="בצעי כסף"><span>גררו לכאן</span></div>` : ""}
          <p class="st-need" data-need></p>
        </div>
        <div data-phase="done" hidden>
          <div class="inline-fb" data-inline-fb role="status" aria-live="polite" tabindex="-1"></div>
          <div class="st-review" data-review hidden></div>
          <div class="st-actions">
            <button type="button" class="link-btn" data-showrev>לצפייה בתשובות</button>
            <button type="button" class="link-btn" data-again>תרגול חוזר</button>
            <button type="button" class="btn" data-go="${s.next}">${byId[s.next].type === "summary" ? "לסיכום האימון" : "לתחנה הבאה"}</button>
          </div>
        </div>
      </div>`;
  };
  function bindStation(scr, s) {
    const card = $("[data-card]", scr), ph = k => $(`[data-phase="${k}"]`, card);
    const figs = { w: $('[data-fig="w"]', scr), m: $('[data-fig="m"]', scr) }, ex = EX[s.ex];
    const itemsBox = $("[data-items]", scr), need = $("[data-need]", scr), qEl = $("[data-q]", scr), ptsEl = $("[data-pts]", scr), rowNo = $("[data-rowno]", scr);
    let run = 0, timer = null, results = [], points = 0, lungeStep = 0;
    ["squat-w", "squat-m", "situp-w", "situp-m", "pushup-w", "pushup-m"].filter(b => b.startsWith(s.ex)).forEach(b => gifUrl(b + ".gif"));
    if (s.ex === "plank") ["aya-plank-ok", "adam-plank-ok", "aya-plank-bad", "adam-plank-bad"].forEach(n => (new Image().src = IMG + n + ".png"));
    const show = k => ["intro", "play", "done"].forEach(x => (ph(x).hidden = x !== k));
    const both = f => ["w", "m"].forEach(k => f(figs[k], k));
    // the characters' movement after a row
    const animate = (rowOk, nCorrect) => {
      // squat, push-ups: a repetition only after a correctly answered item
      if (s.ex === "squat" || s.ex === "pushup") { if (rowOk) both((img, k) => playOnce(img, ex[k][0], ex.ms)); }
      else if (s.ex === "situp") { if (nCorrect) both((img, k) => playOnce(img, ex[k][0], ex.ms)); }
      else if (s.ex === "plank") {
        // after each item both show its result pose ("פלאנק נכון" thumbs-up / "פלאנק לא נכון" fallen), then back to the plank
        both((img, k) => {
          img.src = IMG + ex[k][0] + (rowOk ? "-ok" : "-bad") + ".png";
          clearTimeout(img._pose);
          img._pose = setTimeout(() => { if (img.isConnected) img.src = IMG + ex[k][0] + ".png"; }, 1500);
        });
      } else if (s.ex === "sprint") {
        if (rowOk) sprintOut();                            // only Aya runs; Adam keeps standing, arms crossed
      }
      else if (s.ex === "lunge") { if (rowOk) both((img, k) => playOnce(img, ex[k][0], ex.ms)); }   // one lunge round after a correct answer
    };
    /* sprint: "אישה מתכוננת לרוץ" for a moment, then the running GIF (mirrored – it faces right) carries her out of the
       frame to the left; she comes back in the ready pose for the next item */
    // the running GIF draws Aya smaller on its 1280×720 canvas – its box is enlarged (×1.32, same bottom line) so she
    // runs at the size of the ready pose
    const box0 = ex.playBox || ex.w[1], RUN_K = 1.6;
    const pos0 = img => Object.assign(img.style, { left: box0[0] + "px", top: box0[1] + "px", width: box0[2] + "px", height: box0[3] + "px" });
    const posRun = img => { const w = box0[2] * RUN_K, h = box0[3] * RUN_K;
      Object.assign(img.style, { left: (box0[0] - (w - box0[2]) / 2) + "px", top: (box0[1] + box0[3] - h) + "px", width: w + "px", height: h + "px" }); };
    const sprintReady = () => {
      const img = figs.w; clearTimeout(img._pose); clearInterval(img._raf);
      img.classList.remove("running"); img.style.translate = ""; pos0(img); img.src = IMG + ex.ready + ".png";
    };
    function sprintOut() {
      const img = figs.w;
      sprintReady();
      img._pose = setTimeout(() => {
        if (!img.isConnected) return;
        gifUrl(ex.run + ".gif").then(u => {
          if (!img.isConnected) return;
          img.src = u; img.classList.add("running"); posRun(img);
          // she runs 640px to the left (off the stage) in 2.2s, then waits off-frame and comes back ready
          const t0 = performance.now(), dist = 640, dur = 1150;
          clearInterval(img._raf);
          img._raf = setInterval(() => {
            if (!img.isConnected || !img.classList.contains("running")) return clearInterval(img._raf);
            const k = Math.min(1, (performance.now() - t0) / dur);
            img.style.translate = `${-dist * k}px 0`;
            if (k >= 1) clearInterval(img._raf);
          }, 16);
          img._pose = setTimeout(() => { if (img.isConnected) sprintReady(); }, 1250);
        });
      }, 200);
    }
    if (s.ex === "sprint") { gifUrl(ex.run + ".gif"); new Image().src = IMG + ex.ready + ".png"; }
    // the opening card: one figure does the exercise, the other stands (see EX.intro); leaveIntro() puts the practice figures back
    const setFig = (img, [base, box]) => { img.src = IMG + base + ".png"; Object.assign(img.style, { left: box[0] + "px", top: box[1] + "px", width: box[2] + "px", height: box[3] + "px" }); };
    let introLoop = !!ex.intro && !isDone(s.id);
    if (introLoop) {
      const d = ex.intro.does, other = d === "w" ? "m" : "w", img = figs[d];
      setFig(figs[other], STAND[other]);
      if (ex.intro.gif) { const b = ex.intro.gif[1]; Object.assign(img.style, { left: b[0] + "px", top: b[1] + "px", width: b[2] + "px", height: b[3] + "px" }); img.classList.add("ex-wide"); img.style.visibility = "hidden"; }
      if (ex.intro.how === "gif") gifUrl((ex.intro.gif ? ex.intro.gif[0] : ex[d][0]) + ".gif").then(u => { if (introLoop && img.isConnected) { img.src = u; img.style.visibility = ""; } });
      if (ex.intro.how === "bob") img.classList.add("ex-bob");
    }
    const leaveIntro = () => { if (!introLoop) return; introLoop = false; both(img => { img.classList.remove("ex-bob", "ex-wide"); img.style.visibility = ""; }); setFig(figs.w, ex.w); setFig(figs.m, ex.m); syncFlip(); };
    // Adam's lunge GIF faces right – mirrored in the practice so he faces left (not on the opening card, where he stands)
    const syncFlip = () => figs.m.classList.toggle("ex-flip", !!ex.flipM && !introLoop);
    syncFlip();
    const rowHtml = (r, i) => r.items.map((t, j) => `<button type="button" class="st-item" ${s.drag ? "data-chip" : ""} data-j="${j}">${money(t)}</button>`).join("");
    async function playRow(i, myRun) {
      const r = s.rows[i], picks = [];
      rowNo.textContent = `${s.steps ? "צעד" : "סעיף"} ${i + 1} מתוך ${s.rows.length}`;
      qEl.hidden = !r.q; qEl.textContent = r.q || "";
      itemsBox.innerHTML = rowHtml(r, i); itemsBox.classList.remove("a", "rise"); void itemsBox.offsetWidth; itemsBox.classList.add("a", "rise");
      const k = r.correct.length;
      need.textContent = s.drag ? "" : (k === 1 ? "בחרו פריט אחד" : `בחרו ${k} פריטים`);
      timer = countdown($("[data-tbar]", scr), s.sec, $("[data-tsec]", scr));
      const pick = btn => {
        if (btn.disabled || picks.length >= k) return;
        const j = +btn.dataset.j; picks.push(j); btn.disabled = true;
        const ok = r.correct.includes(j);
        btn.classList.add(ok ? "ok" : "bad"); btn.setAttribute("aria-label", btn.textContent + (ok ? " – נכון" : " – לא נכון"));
        if (ok) { points += FN_PT; ptsEl.textContent = points; bumpEl(ptsEl.parentElement); }
        if (picks.length >= k) timer.stop();
      };
      if (s.drag) dragKit(scr, (chip, tgt) => pick(chip));
      else $$(".st-item", itemsBox).forEach(b => b.addEventListener("click", () => pick(b)));
      await timer.done;
      if (myRun !== run) return false;
      if (abort) { results[i] = picks; return false; }
      // close the row: missed correct items are outlined, the rest locked
      $$(".st-item", itemsBox).forEach(b => { b.disabled = true; const j = +b.dataset.j; if (r.correct.includes(j) && !picks.includes(j)) b.classList.add("should"); });
      const nOk = picks.filter(j => r.correct.includes(j)).length, rowOk = nOk === k;
      need.innerHTML = rowOk ? `<span class="row-ok">✓ כל הכבוד!</span>` : picks.length ? `<span class="row-bad">✗ ${nOk ? "חלקית" : "לא נכון"}</span>` : `<span class="row-bad">✗ הזמן נגמר</span>`;
      playFeedbackSound(rowOk);
      animate(rowOk, nOk);
      results[i] = picks;
      await wait(1500);
      return myRun === run;
    }
    let abort = false;
    async function start() {
      leaveIntro();
      const myRun = ++run; results = []; points = 0; lungeStep = 0; abort = false; ptsEl.textContent = 0;
      both(img => { img.style.removeProperty("--step"); img.classList.remove("stepping"); });
      if (s.ex === "sprint") sprintReady();                // the practice starts: Aya gets ready (she runs only on a correct answer)
      show("play");
      for (let i = 0; i < s.rows.length; i++) {
        if (s.ex === "sprint") sprintReady();           // every new item: Aya is back in the ready pose at once
        const go = await playRow(i, myRun);
        if (myRun !== run || !alive(scr)) return;
        if (!go) break;
      }
      finish();
    }
    function finish() {
      run++; if (timer) timer.stop();
      for (let i = 0; i < s.rows.length; i++) if (!results[i]) results[i] = [];
      setAns(s.id, { completed: true, points, correct: points / FN_PT, results: results.slice() });
      updateChrome(s); $("[data-stepper]", scr).innerHTML = stepperHtml(s);
      renderDone(true);
    }
    function renderDone(focus) {
      const a = ans(s.id), max = maxPoints(s), n = a.correct != null ? a.correct : a.points;   // n = correct items (2 points each)
      show("done");
      const head = s.fb.replace("{n}", n).replace("{t}", max);
      showFb($("[data-inline-fb]", scr), n >= max * .5, fbHtml(n >= max * .5, head, s.explain, a.points), focus);
      $("[data-review]", scr).innerHTML = s.rows.map((r, i) => `<div class="rv-row">${r.q ? `<span class="rv-q">${r.q}</span>` : ""}${r.items.map((t, j) => {
        const picked = (a.results[i] || []).includes(j), c = r.correct.includes(j);
        return `<span class="rv-it ${picked ? (c ? "ok" : "bad") : (c ? "should" : "")}">${t}</span>`; }).join("")}</div>`).join("");
    }
    $("[data-start]", scr).addEventListener("click", start);
    // "סיום התרגיל": the current row closes and the station ends – the remaining rows earn nothing
    const stopBtn = $("[data-stop]", scr); if (stopBtn) stopBtn.addEventListener("click", () => { abort = true; if (timer) timer.stop(); });
    // "תרגול חוזר": at most twice per station – after the second retry the button is gone
    const MAX_RETRY = 2, retries = () => (state.retries || {})[s.id] || 0;
    const againBtn = $("[data-again]", scr), syncAgain = () => { againBtn.hidden = retries() >= MAX_RETRY; };
    syncAgain();
    againBtn.addEventListener("click", () => {
      if (retries() >= MAX_RETRY) return;
      state.retries = Object.assign({}, state.retries, { [s.id]: retries() + 1 });
      delete state.answers[s.id]; save(); updateChrome(s); $("[data-stepper]", scr).innerHTML = stepperHtml(s); syncAgain(); start();
    });
    $("[data-showrev]", scr).addEventListener("click", e => { const rv = $("[data-review]", scr); rv.hidden = !rv.hidden; card.classList.toggle("rev-open", !rv.hidden); e.currentTarget.textContent = rv.hidden ? "לצפייה בתשובות" : "הסתרת התשובות"; });
    if (isDone(s.id)) renderDone(false);
    scr._leave = () => { run++; if (timer) timer.stop(); };
  }
  function bumpEl(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }

  /* ---------------------------------------------------------------- ladder */
  const STAGES = [
    { n: 1, name: "הדמויות על השטרות", go: "l1-learn", quiz: "l1-quiz" },
    { n: 2, name: "הסמלים על השטרות", go: "l2-learn", quiz: "l2-quiz" },
    { n: 3, name: "נגישות", go: "l3-intro", quiz: "l3-quiz2" },
    { n: 4, name: "הצבעים", go: "l4-intro", quiz: "l4-quiz" }
  ];
  const stagesDone = () => STAGES.filter(st => isDone(st.quiz)).length;
  // Adam on the ladder: "סרטון אדם מטפס על סולם.mp4" (1280×720, green screen) cut at the frames where he rests –
  // cropped to the ladder, the green keyed out with soft edges, as WebP (_tools/ladder-key.html): lclimb-0..4.webp are the five
  // rest positions (bottom → top), lclimb-seg1..4.webp the climbs between them (played once).
  // A stage's screens show him where the previous stages brought him: opening + stage 1 = 0, stage 2 = 1 … ; finishing
  // stage k plays seg k and leaves him at position k (4 = the top, also on the summary).
  const ladderPos = stage => Math.max(0, Math.min(4, (stage || 1) - 1));
  const CLIMB_MS = [0, 1720, 1000, 1120, 1320];                       // seg1..4: 43 / 25 / 28 / 33 frames × 40ms
  const ladderPic = (p, alt) => `<div class="ladder-anim"><img class="ladder-img" data-ladder-img src="${IMG}lclimb-${p}.webp" alt="${alt}"></div>`;
  function ladderHtml(cur) {
    if (cur >= 1 && cur <= 4) gifUrl("lclimb-seg" + cur + ".webp");   // preload the climb that ends this stage
    return `<div class="ladder ${A("fly-l", 150)}" data-ladder>
      ${ladderPic(ladderPos(cur), `אדם מטפס בסולם הערכים – ${stagesDone()} מתוך 4 שלבים הושלמו`)}
      ${stagesDone() === 4 ? `<span class="ladder-top" aria-hidden="true"><img src="${ICON}star.gif" alt=""></span>` : ""}
      <ol class="ladder-steps" aria-label="שלבי הסולם – לחצו כדי לעבור לשלב">
        ${STAGES.slice().reverse().map(st => {
          const done = isDone(st.quiz), here = cur === st.n;
          return `<li><button type="button" class="lstep ${done ? "done" : ""} ${here ? "here" : ""}" data-go="${st.go}" ${here ? 'aria-current="step"' : ""}>
            <span class="ls-n">${done ? "✓" : st.n}</span><span class="ls-t">${st.name}</span></button></li>`;
        }).join("")}
      </ol>
    </div>`;
  }
  // after a stage is completed: Adam climbs (the GIF segment) up to the next rest position
  function climb(scr, stage) {
    const img = $("[data-ladder-img]", scr); if (!img) return;
    const k = Math.max(1, Math.min(4, stage || 1));
    gifUrl("lclimb-seg" + k + ".webp").then(u => {
      if (!img.isConnected) return;
      img.src = u; clearTimeout(img._climb);
      img._climb = setTimeout(() => { if (img.isConnected) img.src = IMG + "lclimb-" + k + ".webp"; }, CLIMB_MS[k]);
    });
    $$(".lstep", scr).forEach(b => { const st = STAGES.find(x => x.go === b.dataset.go); if (isDone(st.quiz)) { b.classList.add("done"); $(".ls-n", b).textContent = "✓"; } });
  }
  const ladderBg = () => `<img class="bg" src="${IMG}bg-hall.jpg" alt=""><div class="q-scrim strong" aria-hidden="true"></div>`;

  R.ladderText = s => `
    ${ladderBg()}
    ${ladderHtml(s.stage)}
    <div class="lad-content lad-text ${A("rise", 100)}">
      <div class="h-title">${s.title}</div>
      ${s.paras.map(p => `<p class="txt">${p}</p>`).join("")}
      <div class="wall-actions"><button class="btn practice-btn" data-go="${s.next}">${s.button}</button></div>
    </div>`;

  /* stage 1 – the twelve figures */
  R.figures = s => `
    ${ladderBg()}
    ${ladderHtml(s.stage)}
    <div class="lad-content ${A("fade", 0)}">
      <div class="h-title">${s.title}</div>
      <p class="txt lc-lead">${s.lead}</p>
      <div class="fig-grid">
        ${s.list.map((k, i) => `<button type="button" class="fig-btn ${visited(s).includes(k) ? "seen" : ""} ${A("pop", 200 + i * 50)}" data-fig-k="${k}">
          ${portraitHtml(FIGURES[k].bn, FIGURES[k].name, 74, 84)}<span class="fb-name">${FIGURES[k].name}</span><span class="tick" aria-hidden="true">✓</span></button>`).join("")}
      </div>
      ${s.after ? `<p class="lc-after">${s.after}</p>` : ""}
      <div class="wall-actions"><button class="btn practice-btn" data-go="${s.next}">${s.button}</button></div>
    </div>
    ${s.list.map(k => layerHtml("fig-" + k, `
      <div class="modal card bn-modal" role="dialog" aria-label="${FIGURES[k].name}">
        <button class="close-x" data-close="1" aria-label="סגירה">${CLOSE_X}</button>
        <div class="h-title">${FIGURES[k].name}</div>
        <p class="exm-p">${FIGURES[k].def}</p>
        ${bnImg(FIGURES[k].bn, "השטר של " + FIGURES[k].name, "big")}
      </div>`)).join("")}`;
  function bindFigures(scr, s) {
    $$("[data-fig-k]", scr).forEach(b => b.addEventListener("click", () => { markVisited(s, b.dataset.figK); b.classList.add("seen"); showLayer(scr, "fig-" + b.dataset.figK); }));
  }

  /* stage 2 – the five series */
  R.series = s => `
    ${ladderBg()}
    ${ladderHtml(s.stage)}
    <div class="lad-content ${A("fade", 0)}">
      <div class="h-title">${s.title}</div>
      <p class="txt lc-lead">${s.lead}</p>
      <div class="ser-grid">
        ${s.list.map((x, i) => `<button type="button" class="ser-btn ${visited(s).includes(x.key) ? "seen" : ""} ${A("pop", 200 + i * 90)}" data-ser="${x.key}">
          ${bnImg(x.bn, "שטר לדוגמה – " + x.name)}<span class="sb-name">${x.name}</span><span class="tick" aria-hidden="true">✓</span></button>`).join("")}
      </div>
      ${s.after ? `<p class="lc-after">${s.after}</p>` : ""}
      <div class="wall-actions ser-actions"><button class="btn practice-btn" data-go="${s.next}">${s.button}</button>
        ${s.link ? `<button type="button" class="link-btn" data-link="${s.link}">${s.linkLabel} ↗</button>` : ""}</div>
    </div>
    ${s.list.map(x => layerHtml("ser-" + x.key, `
      <div class="modal card bn-modal" role="dialog" aria-label="${x.name}">
        <button class="close-x" data-close="1" aria-label="סגירה">${CLOSE_X}</button>
        <div class="h-title">${x.name}</div>
        <p class="exm-p">${x.text}</p>
        ${bnImg(x.bn, "שטר לדוגמה מתוך " + x.name, "big")}
      </div>`)).join("")}`;
  function bindSeries(scr, s) {
    $$("[data-ser]", scr).forEach(b => b.addEventListener("click", () => { markVisited(s, b.dataset.ser); b.classList.add("seen"); showLayer(scr, "ser-" + b.dataset.ser); }));
  }

  /* timed matching quiz (stage 1 figure → deed, stage 2 note → series, stage 4 figure → colour) */
  const SERIES = () => byId["l2-learn"].list;
  function matchModel(s) {
    if (s.kind === "figure") return {
      items: s.items.map(k => ({ key: k, ans: k, name: FIGURES[k].name, bn: FIGURES[k].bn })),
      options: shuffle(s.items).map(k => ({ key: k, label: FIGURES[k].short })),
      visual: it => `${portraitHtml(it.bn, it.name, 190, 230)}<span class="mq-name">${it.name}</span>`,
      result: it => `${bnImg(it.bn, "השטר של " + it.name, "sm")}<b>${it.name}</b><span>${FIGURES[it.key].def}</span>`
    };
    if (s.kind === "series") return {
      items: shuffle(s.items.map((x, i) => ({ key: "n" + i, ans: x.ans, bn: x.bn }))),   // notes in a random order each time
      options: SERIES().map(x => ({ key: x.key, label: x.name })),
      visual: it => `${bnImg(it.bn, "שטר", "mq-note")}`,
      result: it => `${bnImg(it.bn, "שטר", "sm")}<b>${SERIES().find(x => x.key === it.ans).name}</b>`
    };
    return {
      items: s.items.map((x, i) => ({ key: "c" + i, ans: x.ans, name: x.name, bn: x.bn, hint: x.hint })),
      options: shuffle(Object.keys(s.colors)).map(k => ({ key: k, label: s.colors[k].name, swatch: s.colors[k].hex })),
      visual: it => `${portraitHtml(it.bn, it.name, 190, 230)}<span class="mq-name">${it.name}</span>${it.hint ? `<button type="button" class="mq-hint-btn" data-hint aria-expanded="false">💡 רמז</button><span class="mq-hint" hidden><span class="mh-l">רמז:</span> ${it.hint}</span>` : ""}`,
      result: it => `${bnImg(it.bn, "השטר של " + it.name, "sm")}<b>${it.name} – ${s.colors[it.ans].name}</b><span>${s.colors[it.ans].text}</span>`
    };
  }
  R.match = s => {
    const m = matchModel(s);
    return `
    ${ladderBg()}
    ${ladderHtml(s.stage)}
    <div class="lad-content mq ${A("fade", 0)}" data-mq>
      <div class="mq-top"><div class="h-title">${s.title}</div>${timerHtml("big")}</div>
      <div data-phase="intro">
        ${taskBox(s.task, s.time)}
        <div class="mq-preview" aria-hidden="true">${m.items.map(it => it.bn !== undefined && s.kind !== "series" ? portraitHtml(it.bn, it.name || "", 70, 84) : bnImg(it.bn, "", "mini")).join("")}</div>
        <div class="wall-actions"><button type="button" class="btn practice-btn" data-start>מתחילים!</button></div>
      </div>
      <div data-phase="play" hidden>
        <ol class="mq-dots" data-dots aria-label="התקדמות">${m.items.map((it, i) => `<li data-dot="${i}">${i + 1}</li>`).join("")}</ol>
        <div class="mq-body">
          <div class="mq-visual ${s.kind}" data-visual></div>
          <div class="mq-opts ${s.kind}" data-opts>${m.options.map(o => `<button type="button" class="mq-opt" data-opt="${o.key}">${o.swatch ? `<span class="sw" style="background:${o.swatch}"></span>` : ""}${o.label}</button>`).join("")}</div>
        </div>
      </div>
      <div data-phase="done" hidden>
        <div class="inline-fb" data-inline-fb role="status" aria-live="polite" tabindex="-1"></div>
        <div class="mq-results ${s.kind}" data-results></div>
        <div class="st-actions">
          <button type="button" class="link-btn" data-again>תרגול חוזר</button>
          <button type="button" class="btn" data-go="${s.next}">${byId[s.next].type === "summary" ? "לסיכום הסט" : "לשלב הבא בסולם"}</button>
        </div>
      </div>
    </div>`;
  };
  function bindMatch(scr, s) {
    // slide 27: the clue opens only when the learner asks for it
    scr.addEventListener("click", e => { const b = e.target.closest("[data-hint]"); if (!b) return; b.hidden = true; b.setAttribute("aria-expanded", "true"); b.nextElementSibling.hidden = false; });
    const m = matchModel(s), ph = k => $(`[data-phase="${k}"]`, scr), show = k => ["intro", "play", "done"].forEach(x => (ph(x).hidden = x !== k));
    const bar = $("[data-tbar]", scr), vis = $("[data-visual]", scr), opts = $$("[data-opt]", scr), dots = $$("[data-dot]", scr);
    let run = 0, timer = null;
    bar.hidden = true;
    async function start() {
      const myRun = ++run, picks = {};
      show("play"); bar.hidden = false;
      dots.forEach(d => (d.className = ""));
      timer = countdown(bar, s.time, $("[data-tsec]", scr));
      timer.done.then(() => { if (myRun === run) finish(picks, myRun); });
      for (let i = 0; i < m.items.length; i++) {
        if (myRun !== run) return;
        const it = m.items[i];
        dots.forEach((d, j) => d.classList.toggle("now", j === i));
        vis.innerHTML = m.visual(it); vis.classList.remove("a", "pop"); void vis.offsetWidth; vis.classList.add("a", "pop");
        opts.forEach(o => { o.disabled = false; o.className = "mq-opt"; $$(".mq-right", o).forEach(x => x.remove()); });
        const chosen = await new Promise(res => {
          const h = e => { const o = e.target.closest("[data-opt]"); if (!o || o.disabled) return; scr.removeEventListener("click", h); res(o.dataset.opt); };
          scr.addEventListener("click", h);
          timer.done.then(() => { scr.removeEventListener("click", h); res(null); });
        });
        if (chosen == null || myRun !== run) return;
        const ok = chosen === it.ans; picks[it.key] = chosen;
        // a wrong pick: the chosen answer turns red, the right one green, the rest fade
        opts.forEach(o => {
          o.disabled = true;
          if (o.dataset.opt === chosen) o.classList.add(ok ? "ok" : "bad");
          else if (!ok && o.dataset.opt === it.ans) o.classList.add("ok", "right");
          else o.classList.add("dim");
        });
        dots[i].classList.add(ok ? "ok" : "bad");
        playFeedbackSound(ok);
        await wait(ok ? 900 : 2200);
      }
      if (myRun === run) finish(picks, myRun);
    }
    function finish(picks, myRun) {
      if (myRun !== run) return;
      run++; if (timer) timer.stop(); bar.hidden = true;
      const n = m.items.filter(it => picks[it.key] === it.ans).length;
      const before = stagesDone();
      setAns(s.id, { completed: true, points: n, picks });
      updateChrome(s);
      renderDone(true);
      if (stagesDone() > before) climb(scr, s.stage);
    }
    function renderDone(focus) {
      const a = ans(s.id); show("done");
      const n = a.points, t = m.items.length;
      // s.fbGood / s.fbBad (from s.passAt right answers): separate texts for a good and a weak result
      const good = n >= (s.passAt || t / 2);
      const head = s.fbGood ? (good ? s.fbGood : s.fbBad).replace("{n}", n).replace("{t}", t) : `התאמתם נכון ${n} מתוך ${t}. ${s.done}`;
      showFb($("[data-inline-fb]", scr), good, fbHtml(good, head, "", n), focus);
      $("[data-results]", scr).innerHTML = m.items.map(it => {
        const p = a.picks[it.key], ok = p === it.ans;
        const picked = p == null ? "לא נענה" : (m.options.find(o => o.key === p) || {}).label;
        return `<div class="mr ${ok ? "ok" : "bad"}"><span class="mr-mark" aria-label="${ok ? "נכון" : "לא נכון"}">${ok ? "✓" : "✗"}</span>${m.result(it)}
          ${ok ? "" : `<span class="mr-picked">בחרתם: ${picked}</span>`}</div>`;
      }).join("");
    }
    $("[data-start]", scr).addEventListener("click", start);
    const stopBtn = $("[data-stop]", scr); if (stopBtn) stopBtn.addEventListener("click", () => { if (timer) timer.stop(); });
    // "תרגול חוזר": with s.maxRetry, only that many times – then the button is gone and the last score stays
    const retries = () => (state.retries || {})[s.id] || 0, againBtn = $("[data-again]", scr);
    const syncAgain = () => { if (s.maxRetry) againBtn.hidden = retries() >= s.maxRetry; };
    syncAgain();
    againBtn.addEventListener("click", () => {
      if (s.maxRetry) { if (retries() >= s.maxRetry) return; state.retries = Object.assign({}, state.retries, { [s.id]: retries() + 1 }); save(); syncAgain(); }
      start();
    });
    if (isDone(s.id)) renderDone(false);
    scr._leave = () => { run++; if (timer) timer.stop(); };
  }

  /* stage 3 – vision, accessibility features, drag exercises */
  // four impairment tiles (picture + name); a click opens the picture large with its explanation
  R.vision = s => `
    ${ladderBg()}
    ${ladderHtml(s.stage)}
    <div class="lad-content ${A("fade", 0)}">
      <div class="h-title">${s.title}</div>
      <p class="txt lc-lead">${s.lead}</p>
      <p class="vis-hint">${s.hint}</p>
      <div class="vis-grid">${s.list.map((v, i) => `<button type="button" class="vis-btn ${visited(s).includes("v" + i) ? "seen" : ""} ${A("pop", 200 + i * 120)}" data-vis="${i}" aria-label="${v.name} – לחצו להגדלה ולהסבר"><img src="${IMG + v.img}" alt=""><b>${v.name}</b><span class="tick" aria-hidden="true">✓</span></button>`).join("")}</div>
      <p class="lc-after strong">${s.outro}</p>
      <div class="wall-actions"><button class="btn practice-btn" data-go="${s.next}">המשך</button></div>
    </div>
    ${s.list.map((v, i) => layerHtml("vis-" + i, `
      <div class="modal card vis-modal" role="dialog" aria-label="${v.name}">
        <button class="close-x" data-close="1" aria-label="סגירה">${CLOSE_X}</button>
        <div class="h-title">${v.name}</div>
        <p class="exm-p">${v.text}</p>
        <img class="vis-big" src="${IMG + v.img}" alt="הדמיה: ${v.name}">
      </div>`)).join("")}`;
  function bindVision(scr, s) {
    $$("[data-vis]", scr).forEach(b => b.addEventListener("click", () => { markVisited(s, "v" + b.dataset.vis); b.classList.add("seen"); showLayer(scr, "vis-" + b.dataset.vis); }));
  }
  R.access = s => {
    if (s.kind === "notes") return `
      ${ladderBg()}
      ${ladderHtml(s.stage)}
      <div class="lad-content ${A("fade", 0)}">
        <div class="h-title">${s.title}</div>
        <p class="txt lc-lead">${s.lead}</p>
        <p class="vis-hint">${s.hint}</p>
        <div class="acc-marks">${s.list.map((x, i) => `<button type="button" class="acc-mark ${visited(s).includes(x.key) ? "seen" : ""} ${A("pop", 200 + i * 120)}" data-acc="${x.key}">
          <span class="am-n">${i + 1}</span><span class="am-ic" aria-hidden="true">${x.icon}</span><b>${x.name}</b><span class="am-go">לחצו להסבר</span><span class="tick" aria-hidden="true">✓</span></button>`).join("")}</div>
        <div class="wall-actions"><button class="btn practice-btn" data-go="${s.next}">המשך</button></div>
      </div>
      ${s.list.map((x, i) => layerHtml("acc-" + x.key, `
        <div class="modal card acc-modal" role="dialog" aria-label="${x.name}">
          <button class="close-x" data-close="1" aria-label="סגירה">${CLOSE_X}</button>
          <div class="h-title">${i + 1}. ${x.name}</div>
          <p class="exm-p">${money(x.text)}</p>
          <div class="acc-ill">${accIllustration(s, x)}</div>
          ${x.tip ? `<p class="acc-tip">${x.tip}</p>` : ""}
        </div>`)).join("")}`;
    return `
      ${ladderBg()}
      ${ladderHtml(s.stage)}
      <div class="lad-content ${A("fade", 0)}">
        <div class="h-title">${s.title}</div>
        <p class="txt lc-lead">${s.lead}</p>
        <div class="coin-groups">${s.groups.map((g, gi) => `
          <section class="cg ${A("rise", 200 + gi * 200)}"><h3>${g.name}</h3>${g.sub ? `<p class="cg-sub">${g.sub}</p>` : ""}
            <div class="cg-items">${g.items.map(c => `<div class="cg-it"><img src="${IMG}coin-${c.coin}-all.png" alt="מטבע ${c.label} – צד, חזית וגב"><b>${c.label}</b><span>${c.text}</span></div>`).join("")}</div>
          </section>`).join("")}</div>
        <p class="lc-after strong">${s.outro}</p>
        <div class="wall-actions"><button class="btn practice-btn" data-go="${s.next}">לתרגול</button></div>
      </div>`;
  };
  // the illustration inside each accessibility mark's window (after the Storyline slide 3.30)
  function accIllustration(s, x) {
    if (x.pics) return `<div class="ai-pics n${x.pics.length}">${x.pics.map(p => `<figure><img src="${IMG + p.img}" alt="${p.cap}"><figcaption>${p.cap}</figcaption></figure>`).join("")}</div>`;
    if (x.key === "color") return `<div class="ai-notes">${s.notes.map(n => `<figure>${bnImg(n.bn, "שטר " + n.v + " ₪")}<figcaption><span class="sw" style="background:${n.hex}"></span>${n.v} ₪ – צבע ${n.warm ? "חם" : "קר"}</figcaption></figure>`).join("")}</div>`;
    if (x.key === "length") return `<div class="ai-len">${s.notes.map(n => `<div class="al-row"><span class="al-bar" style="width:${(n.mm - 100) * 9}px;background:${n.hex}"><b>${n.v}</b></span><span class="al-mm">${n.mm} מ"מ</span></div>`).join("")}</div>`;
    return "";
  }
  function bindAccess(scr, s) {
    $$("[data-acc]", scr).forEach(b => b.addEventListener("click", () => { markVisited(s, b.dataset.acc); b.classList.add("seen"); showLayer(scr, "acc-" + b.dataset.acc); }));
  }
  R.dragmatch = s => {
    const coins = s.kind === "coins";
    const target = (t, i) => coins
      // by the rim (10 / 5 / 2 ₪): a magnifier on the edge only; by the diameter (smooth rims): a silhouette at its true relative size + the diameter
      ? `<div class="dm-t coin-t by-${t.by}" data-drop="${i}">${t.by === "edge" ? `<span class="coin-mag big" style="background-image:url(${IMG}rim-${t.coin}.png);background-size:${t.mag[0]} auto;background-position:${t.mag[1]}" role="img" aria-label="תקריב של שולי המעה"></span><span class="coin-dia rim">${t.rim}</span>` : `<span class="coin-sil" style="--d:${t.d}"></span><span class="coin-dia">קוטר ${String(t.d).replace(".", ",")} מ"מ</span>`}<span class="dm-slot" data-slot>?</span></div>`
      : `<div class="dm-t note-t" data-drop="${i}"><img src="${BN + t.img}.jpg" alt="שטר כפי שאדם עם לקות ראייה עשוי לראות אותו"><span class="dm-slot" data-slot>?</span></div>`;
    return `
      ${ladderBg()}
      ${ladderHtml(s.stage)}
      <div class="lad-content dm ${coins ? "coins" : "notes"} ${A("fade", 0)}">
        <div class="mq-top"><div class="h-title">${s.title}</div>${s.time ? timerHtml("big") : ""}</div>
        ${taskBox(s.task, s.time)}
        <div data-phase="intro" ${s.time ? "" : "hidden"}><div class="wall-actions"><button type="button" class="btn practice-btn" data-start>מתחילים!</button></div></div>
        <div data-phase="play" ${s.time ? "hidden" : ""}>
          <div class="dm-targets">${s.targets.map(target).join("")}</div>
          <div class="dm-chips">${shuffle(s.chips).map(c => `<button type="button" class="dm-chip" data-chip data-val="${c}">${c}${s.unit ? " " + s.unit : ""}</button>`).join("")}</div>
          <div class="st-actions"><button type="button" class="btn navy" data-check disabled>בדיקה</button></div>
        </div>
        <div data-phase="done" hidden>
          <div class="inline-fb" data-inline-fb role="status" aria-live="polite" tabindex="-1"></div>
          <div class="st-actions">
            <button type="button" class="link-btn" data-again>תרגול חוזר</button>
            <button type="button" class="btn" data-go="${s.next}">${s.done ? "לשלב הבא בסולם" : "לחלק הבא"}</button>
          </div>
        </div>
      </div>`;
  };
  function bindDragmatch(scr, s) {
    const ph = k => $(`[data-phase="${k}"]`, scr), check = $("[data-check]", scr), bar = $("[data-tbar]", scr);
    let timer = null, placed = {}, run = 0;
    const chipVal = c => c.dataset.val;
    const refresh = () => { check.disabled = Object.keys(placed).length < s.targets.length; };
    /* the placements stay editable until "בדיקה": a placed value can be dragged to another slot (swapping), dragged
       out to the tray or clicked to send it back, and a tray value dropped on a filled slot replaces it */
    const label = v => v + (s.unit ? " " + s.unit : "");
    let locked = false;
    const sync = () => {
      $$("[data-drop]", scr).forEach(t => {
        const v = placed[+t.dataset.drop], slot = $("[data-slot]", t);
        t.classList.toggle("filled", v != null); t.classList.add("swap");
        slot.innerHTML = v != null ? `<span class="dm-placed" data-pval="${v}" title="גררו כדי להעביר, או לחצו כדי להחזיר">${label(v)}<span class="dm-back" aria-hidden="true">↶</span></span>` : "?";
      });
      $$("[data-chip]", scr).forEach(c => c.classList.toggle("used", Object.values(placed).includes(chipVal(c))));
      refresh();
    };
    const place = (chip, tgt) => {
      const v = chipVal(chip);
      Object.keys(placed).forEach(k => { if (placed[k] === v) delete placed[k]; });   // a value placed elsewhere moves here
      placed[+tgt.dataset.drop] = v; sync();                                          // (whatever was in the slot goes back)
    };
    dragKit(scr, place);
    scr.addEventListener("pointerdown", e => {
      const pv = e.target.closest(".dm-placed"); if (!pv || locked || e.button) return;
      e.preventDefault();
      const from = +pv.closest("[data-drop]").dataset.drop, v = placed[from];
      const st = $("#stage").getBoundingClientRect(), k = st.width / W, r0 = pv.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
      let ghost = null;
      const move = ev => {
        const dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k;
        if (!ghost && Math.hypot(dx, dy) < 6) return;
        if (!ghost) {
          ghost = pv.cloneNode(true); ghost.classList.add("ghost");
          ghost.style.cssText = `position:absolute;z-index:70;left:${(r0.left - st.left) / k}px;top:${(r0.top - st.top) / k}px;margin:0;pointer-events:none;transition:none;`;
          scr.appendChild(ghost); pv.classList.add("lifted");
        }
        ghost.style.transform = `translate(${dx}px,${dy}px)`;
        const hit = document.elementFromPoint(ev.clientX, ev.clientY);
        $$("[data-drop]", scr).forEach(t => t.classList.toggle("over", !!hit && t.contains(hit) && +t.dataset.drop !== from));
      };
      const up = ev => {
        window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
        $$("[data-drop]", scr).forEach(t => t.classList.remove("over"));
        delete placed[from];
        if (ghost) {
          ghost.remove();
          const hit = document.elementFromPoint(ev.clientX, ev.clientY), tgt = hit && hit.closest("[data-drop]");
          if (tgt && scr.contains(tgt)) {
            const to = +tgt.dataset.drop;
            if (to !== from && placed[to] != null) placed[from] = placed[to];   // swap with the value that was there
            placed[to] = v;
          }                                                                    // dropped outside the slots: back to the tray
        }                                                                      // a plain click: back to the tray
        sync();
      };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    });
    sync();
    const lock = () => { locked = true; $$("[data-chip]", scr).forEach(c => (c.disabled = true)); $$("[data-drop]", scr).forEach(t => t.classList.remove("swap")); $$(".dm-placed", scr).forEach(p => (p.outerHTML = label(p.dataset.pval))); };
    // checked: the learner's answer stays in the slot (green ✓ / red ✗); a wrong one gets the right value in its own line below
    const mark = () => s.targets.forEach((t, i) => {
      const el = $(`[data-drop="${i}"]`, scr), v = placed[i], ok = v === t.ans;
      el.classList.add(ok ? "ok" : "bad");
      $("[data-slot]", el).innerHTML = `<span class="dm-ans" aria-label="${ok ? "נכון" : "לא נכון"}">${ok ? "✓" : "✗"}</span>${v != null ? label(v) : "לא נענה"}`;
      // every card gets the correction line (hidden when right), so all the answer boxes stay on one line
      $("[data-slot]", el).insertAdjacentHTML("afterend", ok ? `<span class="dm-right empty" aria-hidden="true">&nbsp;</span>` : `<span class="dm-right">תשובה נכונה: <b>${label(t.ans)}</b></span>`);
    });
    function finish() {
      run++; if (timer) timer.stop(); if (bar) bar.hidden = true;
      lock(); mark(); check.hidden = true; $(".dm-chips", scr).hidden = true;
      const n = s.targets.filter((t, i) => placed[i] === t.ans).length;
      const before = stagesDone();
      setAns(s.id, { completed: true, points: n, placed: Object.assign({}, placed) });
      updateChrome(s); playFeedbackSound(n === s.targets.length);
      ph("play").hidden = false; ph("done").hidden = false; ph("intro").hidden = true;
      showFb($("[data-inline-fb]", scr), n === s.targets.length, fbHtml(n === s.targets.length, `זיהיתם נכון ${n} מתוך ${s.targets.length}.${s.done ? " " + s.done : ""}`, "", n), true);
      if (stagesDone() > before) climb(scr, s.stage);
    }
    check.addEventListener("click", finish);
    const startBtn = $("[data-start]", scr);
    if (startBtn) startBtn.addEventListener("click", () => {
      ph("intro").hidden = true; ph("play").hidden = false;
      if (s.time) { bar.hidden = false; const my = ++run; timer = countdown(bar, s.time, $("[data-tsec]", scr)); timer.done.then(r => { if (r === "time" && my === run && alive(scr)) finish(); }); }
    });
    if (bar) bar.hidden = true;
    // "תרגול חוזר": with s.maxRetry, only that many times – then the button is gone and the last result stays
    const retries = () => (state.retries || {})[s.id] || 0, againBtn = $("[data-again]", scr);
    if (s.maxRetry && retries() >= s.maxRetry) againBtn.hidden = true;
    againBtn.addEventListener("click", () => {
      if (s.maxRetry) { if (retries() >= s.maxRetry) return; state.retries = Object.assign({}, state.retries, { [s.id]: retries() + 1 }); }
      delete state.answers[s.id]; save(); goTo(s.id);
    });
    const a = ans(s.id);
    if (a && a.completed) {
      placed = Object.assign({}, a.placed); ph("intro").hidden = true; ph("play").hidden = false; ph("done").hidden = false;
      sync();
      lock(); mark(); check.hidden = true; $(".dm-chips", scr).hidden = true;
      showFb($("[data-inline-fb]", scr), a.points === s.targets.length, fbHtml(a.points === s.targets.length, `זיהיתם נכון ${a.points} מתוך ${s.targets.length}.${s.done ? " " + s.done : ""}`, "", a.points), false);
    }
    scr._leave = () => { run++; if (timer) timer.stop(); };
  }

  /* ---------------------------------------------------------------- pulley */
  R.security = s => `
    <img class="bg" src="${IMG}bg-clean.jpg" alt="">
    <div class="q-scrim" aria-hidden="true"></div>
    <div class="sec-head ${A("fade", 0)}"><div class="h-title">${s.title}</div><p class="txt">${s.lead}</p></div>
    <div class="sec-note ${A("fly-r", 200)}">
      <img src="${BN}alterman-200.jpg" alt="שטר 200 ₪ – צד קדמי">
      ${s.list.filter(x => x.pos).map(x => `<button type="button" class="sec-dot ${x.g} ${visited(s).includes("m" + x.n) ? "seen" : ""}" style="left:${x.pos[0]}%;top:${x.pos[1]}%" data-mark="${x.n}" aria-label="${x.n}. ${x.name}">${x.n}</button>`).join("")}
      <span class="sec-cap">צד קדמי</span>
    </div>
    <div class="sec-groups ${A("rise", 300)}">
      ${s.groups.map(([gn, gk]) => `<section class="sg ${gk}"><h3>${gn}</h3>${s.list.filter(x => x.g === gk).map(x => `
        <button type="button" class="sg-it ${visited(s).includes("m" + x.n) ? "seen" : ""}" data-mark="${x.n}"><span class="sg-n">${x.n}</span>${x.name}<span class="tick" aria-hidden="true">✓</span></button>`).join("")}</section>`).join("")}
    </div>
    <button type="button" class="link-btn sec-link ${A("fade", 600)}" data-link="${s.link}">לאתר בנק ישראל – הכסף שלי ↗</button>
    ${s.list.map(x => layerHtml("mark-" + x.n, `
      <div class="modal card sec-modal ${x.yt ? "has-video" : ""}" role="dialog" aria-label="${x.name}">
        <button class="close-x" data-close="1" aria-label="סגירה">${CLOSE_X}</button>
        <div class="exm-head"><span class="sec-badge ${x.g}">${x.n}</span><div><div class="h-title">${x.name}</div><div class="exm-sub">${s.groups.find(g => g[1] === x.g)[0]}${x.back ? " · בגב השטר" : ""}</div></div></div>
        <p class="exm-p">${money(x.text)}</p>
        ${x.foot ? `<p class="sec-foot">${x.foot}</p>` : ""}
        ${x.yt ? `<div class="sec-video" data-yt="${x.yt}"><button type="button" class="tv-play" data-ytplay aria-label="הפעלת סרטון ההדגמה"><img src="${UI}play.png" alt=""><span>צפו בסרטון ההדגמה</span></button></div>` : ""}
      </div>`)).join("")}`;
  function bindSecurity(scr, s) {
    $$("[data-mark]", scr).forEach(b => b.addEventListener("click", () => {
      const n = b.dataset.mark; markVisited(s, "m" + n);
      $$(`[data-mark="${n}"]`, scr).forEach(x => x.classList.add("seen"));
      showLayer(scr, "mark-" + n);
    }));
    const playBtn = `<button type="button" class="tv-play" data-ytplay aria-label="הפעלת סרטון ההדגמה"><img src="${UI}play.png" alt=""><span>צפו בסרטון ההדגמה</span></button>`;
    scr.addEventListener("click", e => {
      const b = e.target.closest("[data-ytplay]"); if (!b) return;
      const box = b.closest("[data-yt]");
      box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${box.dataset.yt}?autoplay=1&rel=0&modestbranding=1&playsinline=1" title="סרטון הדגמה" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    });
    // closing a layer stops its film (the iframe is removed) – the PLAY button comes back
    scr._onLayerClose = () => $$("[data-yt]", scr).forEach(box => { if (!$("[data-ytplay]", box)) box.innerHTML = playBtn; });
  }

  R.phowto = s => `
    <img class="bg" src="${IMG}bg-clean.jpg" alt="">
    <div class="q-scrim" aria-hidden="true"></div>
    <img class="char ${A("fly-l", 300)}" src="${IMG}aya-pulley-still.png" alt="איה במכשיר הפולי, אוחזת בשתי הידיות" style="${pos(20, 300, 430, 340)}">
    <div class="wall-content ph-wall ${A("rise", 150)}">
      <div class="h-title">${s.title}</div>
      <p class="h-sub ph-sub">${s.sub}</p>
      <p class="txt wall-lead">${s.lead}</p>
      <p class="wall-tip">${s.tip}</p>
      <p class="wall-success"><b class="t">${s.success}</b></p>
      <div class="wall-actions"><button class="btn practice-btn" data-go="${s.next}">${s.button}</button></div>
    </div>`;

  // Aya in the pulley, the real and the counterfeit note on the two sides; she pulls the handle of the note clicked
  const pulleyQs = () => DATA.screens.filter(x => x.type === "pulley");
  R.pulley = s => {
    const first = s.num === 1 && firstVisit;
    const lifted = pulleyQs().filter(x => isDone(x.id) && ans(x.id).correct).length;
    const note = side => {
      const real = s.realSide === side;
      return `<button type="button" class="pl-note ${side}" data-side="${side}" aria-label="השטר ${side === "right" ? "העליון" : "התחתון"}"><span class="pl-letter" aria-hidden="true">${side === "right" ? "א" : "ב"}</span>
        <img src="${BN + s.pair}-${real ? "real" : "fake"}.jpg" alt="">
        <span class="pl-tag" data-tag hidden></span></button>`;
    };
    return `
      <img class="bg" src="${IMG}bg-clean.jpg" alt="">
      <div class="q-scrim light" aria-hidden="true"></div>
      <div class="pl-q ${first ? A("fly-t", 0) : ""}">
        <span class="num-chip">תרגיל ${s.num} מתוך ${pulleyQs().length}</span>
        <div class="pl-title">אמיתי או מזויף?<br>בדקו את <b>${s.mark}</b> (${s.look})</div>
        <p class="pl-hint" data-hint>לחצו על השטר האמיתי מבין השניים שמימין.</p>
      </div>
      ${note("right")}${note("left")}
      <div class="pl-rig ${first ? A("fade", 300) : ""}" data-rig>
        <img class="pl-aya" data-aya src="${IMG}aya-pulley-still.png" alt="איה במכשיר הפולי">
      </div>
      <div class="pl-weights" aria-label="משקולות שהורמו: ${lifted}"><span class="pl-wl">משקל שהורם</span>${pulleyQs().map((x, i) => `<i class="${i < lifted ? "on" : ""}"></i>`).join("")}</div>
      <div class="inline-fb pl-fb" data-inline-fb role="status" aria-live="polite" tabindex="-1" hidden></div>`;
  };
  function bindPulley(scr, s) {
    const btns = $$("[data-side]", scr), aya = $("[data-aya]", scr), fb = $("[data-inline-fb]", scr), rig = $("[data-rig]", scr);
    gifUrl("aya-pulley-pull.webp");                                    // warm the animation
    const nextLbl = byId[s.next].type === "summary" ? "לסיכום הסט" : "לתרגיל הבא";
    const finish = (side, animate) => {
      const ok = side === s.realSide;
      btns.forEach(b => {
        b.disabled = true;
        const real = b.dataset.side === s.realSide, tag = $("[data-tag]", b);
        tag.hidden = false; tag.textContent = real ? "אמיתי" : "מזויף"; tag.className = "pl-tag " + (real ? "real" : "fake");
        if (b.dataset.side === side) b.classList.add("chosen", ok ? "ok" : "bad");
      });
      $("[data-hint]", scr).hidden = true;
      // Aya pulls the handles only on a correct answer; she is never mirrored (always faces the same way)
      // a correct answer: one pass of "איה עושה מתיחות במכשיר" (5s), then back to the still (its first frame)
      if (ok && animate) { playWebp(aya, "aya-pulley-pull"); clearTimeout(aya._t); aya._t = setTimeout(() => { if (aya.isConnected) aya.src = IMG + "aya-pulley-still.png"; }, 5080); }
      const head = ok ? "זיהיתם נכון! מרימים עוד משקל." : "הפעם משכתם את המזויף.";
      const fill = () => showFb(fb, ok, fbHtml(ok, head, s.explain, ok ? 10 : 0, `<div class="ifb-actions"><button type="button" class="btn" data-go="${s.next}">${nextLbl}</button></div>`), animate);
      if (animate) setTimeout(fill, 800); else fill();
    };
    const a = ans(s.id);
    if (a && a.completed) finish(a.answer, false);
    btns.forEach(b => b.addEventListener("click", () => {
      if (isDone(s.id)) return;
      const side = b.dataset.side, ok = side === s.realSide;
      setAns(s.id, { completed: true, answer: side, correct: ok, points: ok ? 10 : 0 });
      updateChrome(s); playFeedbackSound(ok);
      if (ok) { const lit = $$(".pl-weights i", scr).find(i => !i.classList.contains("on")); if (lit) setTimeout(() => lit.classList.add("on", "a", "pop"), 600); }
      finish(side, true);
    }));
  }

  /* ---------------------------------------------------------------- climbing wall */
  R.whowto = s => `
    <img class="bg" src="${IMG}bg-wall.jpg" alt="">
    <img class="wh-wallbg ${A("fade", 200)}" src="${IMG}m-wall.png" alt="">
    <img class="char wh-climber ${A("fly-l", 300)}" src="${IMG}aya-climb4.png" alt="איה מטפסת על קיר הטיפוס">
    <div class="wall-content wh-content ${A("rise", 150)}">
      <div class="h-title">${s.title}</div>
      ${s.paras.map(p => `<p class="txt wall-lead">${p.replace("✔", '<span class="ic-ok" aria-hidden="true">✔</span>').replace("✖", '<span class="ic-bad" aria-hidden="true">✖</span>')}</p>`).join("")}
      <div class="wall-actions"><button class="btn practice-btn" data-go="${s.next}">${s.button}</button></div>
    </div>`;
  /* the climbing wall: the empty wall board (מכשירים/קיר טיפוס בלי אבנים) with the holds placed on it – 10 rows (bottom → top)
     × 3 columns, rows staggered, each hold one of the three supplied colours; a hold touches the holds of the next row
     in columns c-1…c+1 */
  const WALL = { x: 360, y: 40, w: 450, h: 592 }, LANE = 0;   // LANE: a free strip on the left of the board where Aya climbs
  /* the holds of each row are laid out from the widths their texts need, never overlapping: every hold is as wide as its
     text (longer answers → wider holds), the spare room of the row is spread between them unevenly (a fixed pattern per
     row, so the wall looks natural rather than symmetric), and each hold sits a few pixels up or down inside its row */
  const holdW = t => t.length > 40 ? 140 : t.length > 28 ? 126 : t.length > 16 ? 114 : 104;
  const GAPS = [[.15, .5, .2, .15], [.35, .15, .3, .2], [.1, .3, .4, .2], [.3, .35, .1, .25], [.2, .2, .35, .25]];
  const NUDGE = [0, -3, 3, -2, 2, -4, 1, 4, -1, 3];
  let wallRows = null;
  function layoutWall(rowsData) {
    const rows = rowsData.length, rowH = WALL.h / rows, inner = WALL.w - LANE - 44;
    wallRows = rowsData.map((row, r) => {
      const ws = row.map(st => holdW(st[0])), free = Math.max(0, inner - ws.reduce((a, b) => a + b, 0));
      const g = GAPS[r % GAPS.length];
      let x = WALL.x + LANE + 12 + free * g[0];
      return ws.map((w, c) => { const left = x; x += w + free * g[c + 1];
        return { left, top: WALL.y + WALL.h - (r + 1) * rowH + 4 + NUDGE[(r + c) % NUDGE.length] * .6, w, h: rowH - 9 }; });
    });
  }
  const stonePos = (r, c) => wallRows[r][c];
  const HOLDS = ["orange", "blue", "purple"];
  R.wall = s => {
    const rows = s.rows.length;
    layoutWall(s.rows);
    const stones = s.rows.map((row, r) => row.map((st, c) => { const p = stonePos(r, c);
      return `<button type="button" class="stone" data-r="${r}" data-c="${c}" style="${pos(p.left, p.top, p.w, p.h)}" disabled>
        <img src="${IMG}hold-${HOLDS[(r * 2 + c) % 3]}.png" alt=""><span>${st[0]}</span></button>`; }).join("")).join("");
    return `
      <img class="bg" src="${IMG}bg-room.jpg" alt="">
      <img class="climb-board" src="${IMG}wall-empty.png" alt="" style="${pos(WALL.x - 14, WALL.y - 10, WALL.w + 28, WALL.h + 22)}">
      ${stones}
      ${s.rows.map((row, r) => `<span class="wall-num" style="top:${stonePos(r, 0).top + stonePos(r, 0).h / 2 - 13}px" aria-hidden="true">${r + 1}</span>`).join("")}
          <button type="button" class="skip-practice wall-skip" data-stop><span>דילוג – הצגת המסלול</span><svg class="ic" viewBox="0 0 15 17" aria-hidden="true" focusable="false"><path d="M1.7 1.7 10 8.5 1.7 15.3Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="3.2" stroke-linejoin="round"></path><rect x="12" y="0" width="3" height="17" rx="1.5" fill="#FFFFFF"></rect></svg></button>
      <img class="char climber" data-climber hidden src="${IMG}aya-climb4.png" alt="איה מטפסת על קיר הטיפוס" style="${pos(WALL.x + 30, WALL.y + WALL.h + 14, 140, 196)}">
      <div class="wall-panel">
        <div class="wp-title">שלבי ההנפקה</div>
        <p class="wp-instr" data-instr>${s.first}</p>
        <ol class="wp-steps" data-steps></ol>
        <div class="inline-fb wp-fb" data-inline-fb role="status" aria-live="polite" tabindex="-1" hidden></div>
        <div class="st-actions wp-actions">
          <button type="button" class="link-btn" data-again hidden>טיפוס חוזר</button>
        </div>
      </div>`;
  };
  function bindWall(scr, s) {
    const rows = s.rows.length, climber = $("[data-climber]", scr), stepsEl = $("[data-steps]", scr), instr = $("[data-instr]", scr), fb = $("[data-inline-fb]", scr);
    const correctCol = r => s.rows[r].findIndex(x => x[1]);
    const stone = (r, c) => $(`.stone[data-r="${r}"][data-c="${c}"]`, scr);
    let level = 0, cur = null, misses = 0, points = 0;
    // Aya climbs the holds themselves: after each correct step her hands grip the hold just chosen and her body hangs
    // below it (over the rows already climbed, never over the next choice) – a different grip pose each time
    // the poses cropped to the figure (…-crop.png): every one is drawn at the same height, so she never changes size;
    // RATIO = height / width of each crop
    const poses = ["aya-climb1-crop", "aya-climb2-crop", "aya-climb3-crop", "aya-climb5-crop", "aya-climb6-crop"];
    const RATIO = [1.84, 1.74, 1.74, 1.99, 1.70];
    /* where she hangs: her hands at the height of the hold just reached, her body below it. Of all the horizontal
       spots, the one chosen covers none of the next row's holds (the next question) and as little as possible of the
       holds already answered correctly – and is the nearest such spot to the hold she reached */
    const CH = 190;
    const overlap = (a, b) => Math.max(0, Math.min(a.left + a.w, b.left + b.w) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.top + a.h, b.top + b.h) - Math.max(a.top, b.top));
    // only over the holds themselves (never beside the board); one size all the way up – low on the wall her legs are
    // simply cut by the bottom of the frame
    const ROW_L = Math.min(...wallRows.map(row => row[0].left)), ROW_R = Math.max(...wallRows.map(row => row[row.length - 1].left + row[row.length - 1].w));
    const moveClimber = (r, c) => {
      // her raised hands reach just above the hold she took
      const pi = r % poses.length, CW = Math.round(CH / RATIO[pi]), p = stonePos(r, c), top = p.top - 14;
      const next = r + 1 < rows ? s.rows[r + 1].map((x, k) => stonePos(r + 1, k)) : [];
      const done = []; for (let k = Math.max(0, r - 3); k <= r; k++) done.push(stonePos(k, correctCol(k)));
      let best = null;
      for (let x = ROW_L - 10; x <= ROW_R - CW + 10; x += 6) {
        const me = { left: x + 10, top: top + 4, w: CW - 20, h: CH - 8 };
        const score = next.reduce((n, b) => n + overlap(me, b) * 50, 0) + done.reduce((n, b) => n + overlap(me, b) * 4, 0) + Math.abs(x + CW / 2 - (p.left + p.w / 2));
        if (!best || score < best.score) best = { x, score };
      }
      climber.hidden = false;                              // she appears with the first correct step
      Object.assign(climber.style, { left: best.x + "px", top: top + "px", width: CW + "px", height: CH + "px" });
      climber.src = IMG + poses[pi] + ".png";
    };
    const light = () => {
      $$(".stone", scr).forEach(b => { b.disabled = true; b.classList.remove("option"); });
      if (level >= rows) return;
      const cols = [0, 1, 2];                                // the whole next row lights up
      cols.forEach(c => { const b = stone(level, c); if (b) { b.disabled = false; b.classList.add("option"); } });
    };
    const addStep = r => { const li = document.createElement("li"); li.textContent = s.rows[r][correctCol(r)][0]; li.className = "a rise"; stepsEl.appendChild(li); };
    const done = (animate) => {
      instr.textContent = "הגעתם לפסגה!";
      $("[data-stop]", scr).hidden = true; 
      const a = ans(s.id);
      showFb(fb, true, fbHtml(true, "סידרתם נכון את כל שלבי ההנפקה והתפעול של שטר הכסף!", "בחרתם את השלב הנכון והתקדמתם אחיזה אחר אחיזה עד לפסגה.", a.points), animate);
      // the two buttons below the green feedback box, not inside it
      if (!$(".wp-fb-actions", scr)) fb.insertAdjacentHTML("afterend", `<div class="wp-fb-actions"><button type="button" class="link-btn" data-again2>טיפוס חוזר</button><button type="button" class="btn" data-go="${s.next}">לסיכום הסט</button></div>`);
    };
    const finish = () => { setAns(s.id, { completed: true, points }); updateChrome(s); done(true); };
    scr.addEventListener("click", e => {
      const b = e.target.closest(".stone"); if (!b || b.disabled || isDone(s.id)) return;
      const r = +b.dataset.r, c = +b.dataset.c;
      if (s.rows[r][c][1]) {
        b.classList.add("ok"); b.classList.remove("option"); playFeedbackSound(true);
        if (!misses) points += 10; misses = 0; cur = c; level++;
        updatePts(); moveClimber(r, c); addStep(r);
        instr.textContent = level < rows ? s.later : "";
        if (level >= rows) { light(); finish(); } else light();
      } else {
        misses++; playFeedbackSound(false);
        b.classList.remove("shake", "bad"); void b.offsetWidth; b.classList.add("shake", "bad");
        setTimeout(() => b.classList.remove("bad"), 900);
        toast("זה לא השלב הבא – נסו שוב");
      }
    });
    const ptsBadge = () => { const cv = $('[data-c="coins-v"]', $("#chrome")); return cv; };
    const updatePts = () => { const cv = ptsBadge(); if (cv) cv.textContent = setScore("wall") + points; };
    $("[data-stop]", scr).addEventListener("click", () => {
      // skip: the whole route is shown, the steps not climbed earn no points
      for (let r = level; r < rows; r++) { const c = correctCol(r); stone(r, c).classList.add("ok", "shown"); addStep(r); cur = c; }
      level = rows; moveClimber(rows - 1, cur); light(); finish();
    });
    const again = () => { delete state.answers[s.id]; save(); goTo(s.id); };
    $("[data-again]", scr).addEventListener("click", again);
    scr.addEventListener("click", e => { if (e.target.closest("[data-again2]")) again(); });
    if (isDone(s.id)) {
      for (let r = 0; r < rows; r++) { const c = correctCol(r); stone(r, c).classList.add("ok"); addStep(r); cur = c; }
      level = rows; moveClimber(rows - 1, cur); done(false);
    } else light();
  }

  /* ---------------------------------------------------- summaries */
  R.summary = s => {
    const score = setScore(s.set);
    const heroes = { "adam-flex": hero("adam-flex", 40, 200, 460, A("fly-l", 300)), "aya-flex": hero("aya-flex", 40, 200, 460, A("fly-l", 300)) };
    const left = s.ladderTop ? `<div class="ladder ladder-sum ${A("fly-l", 300)}">${ladderPic(4, "אדם בראש הסולם")}</div>` : heroes[s.hero];
    return `
      <img class="bg ${s.ladderTop ? "flip-bg" : ""}" src="${IMG}bg-clean.jpg" alt="">
      ${left}
      <div class="star-badge ${A("pop", 900)}" style="${pos(272, 114, 90, 90)}"><img src="${ICON}star.gif" alt=""></div>
      <div class="card sum-card ${A("fly-b", 0)}">
        <div class="h-title" style="font-size:27px">${s.title}</div>
        <div class="score-line ${A("pop", 500)}"><span class="coin"></span>צברתם <span class="big">${score}</span> מתוך ${SETS[s.set].total} מטבעות</div>
        ${s.set === "functional" && fnBonus() ? `<p class="sum-bonus ${A("fade", 700)}">כולל ${FN_BONUS} מטבעות בונוס על השלמת כל שש התחנות</p>` : ""}
        <p class="h-sub" style="margin-top:8px">מה למדנו בסט?</p>
        <p class="txt" style="font-size:17.5px">${s.learned}</p>
        <ul class="bul">${s.bullets.map(b => `<li>${b}</li>`).join("")}</ul>
        <p class="closing">${s.closing}</p>
      </div>`;
  };

  /* ---------------------------------------------------- stretching */
  R.stretchIntro = s => `
    <img class="bg" src="${IMG}bg-hall.jpg" alt="">
    ${hero("adam", 25, 200, 460, A("fly-l", 300))}
    ${hero("aya", 868, 195, 465, A("fly-r", 400))}
    <div class="warmup-panel stretch-panel ${A("fade", 0)}">
      <div class="h-title" style="font-size:29px">${s.title}</div>
      <p class="txt" style="margin-top:8px;font-size:19px">${s.lead}</p>
      <p class="h-sub" style="margin-top:10px;font-size:20px">איך זה יעבוד?</p>
      <p class="txt" style="font-size:18px">${money(s.how)}</p>
      <div class="chips" style="margin-top:6px">${s.topics.map(t => `<span>${t}</span>`).join("")}</div>
      <div style="display:flex;gap:10px;margin-top:12px">
        ${s.rules.map(r => `<div class="rule ${r.good ? "good" : "badr"}">${money(r.text)}</div>`).join("")}
      </div>
      <p class="txt" style="font-size:18px;margin-top:10px"><b>${s.goal}</b></p>
      <div style="margin-top:12px;text-align:center"><button class="btn practice-btn" data-go="${s.next}">${s.button}</button></div>
    </div>`;

  const STRETCH_FIG = [
    { file: "aya-stretch", box: [-72, 53, 424, 617] },
    { file: "adam-stretch", box: [-82, 88, 464, 587] }
  ];
  const LETTERS = ["א", "ב", "ג", "ד"];
  R.mcq = s => {
    const first = s.num === 1 && firstVisit, g = STRETCH_FIG[(s.num - 1) % 2];
    return `
      <img class="bg" src="${IMG}bg-clean.jpg" alt="">
      <div class="q-scrim" aria-hidden="true"></div>
      <img class="char ${first ? A("fly-l", 150) : ""}" data-hero="${g.file}" src="${IMG + g.file}.png" alt="" style="${pos(...g.box)}">
      <div class="bank ${first ? A("fly-t", 100) : ""}" data-bank><span class="coin"></span><span class="t">יש לכם:</span><span class="v" data-bank-v>${bank().toLocaleString("en-US")}</span><span class="t">₪ בקופה</span></div>
      <div class="q-wall wide-opts">
        <p class="qw-question">${s.question}</p>
        <p class="qw-hint">בחרו בתשובה הנכונה</p>
        <div class="qw-options">
          ${s.options.map((o, i) => `<button type="button" class="qw-opt ${first ? A("fly-r", 250 + i * 150) : ""}" data-opt="${i}"><span class="qw-l">${LETTERS[i]}.</span>${o}</button>`).join("")}
        </div>
        <div class="inline-fb" data-inline-fb role="status" aria-live="polite" tabindex="-1" hidden></div>
      </div>`;
  };
  function bindMcq(scr, s) {
    const opts = $$("[data-opt]", scr), fb = $("[data-inline-fb]", scr);
    const showFinal = chosen => opts.forEach((o, i) => { o.disabled = true; if (i === s.correct) o.classList.add("ok"); else if (i === chosen) o.classList.add("bad"); });
    const fbFor = ok => `<div class="ifb-row"><p class="ifb-head">${ok ? "יפה מאוד! הכסף שלכם נשמר" : "לא נכון, ירדו לכם 100 ₪ מהקופה"}</p><span class="ifb-coins"><span class="coin sm"></span>יש לכם ${bank().toLocaleString("en-US")} ₪ בקופה</span></div><div class="ifb-body">${money(s.explain)}</div>`;
    const heroImg = $("[data-hero]", scr), train = () => playWebp(heroImg, heroImg.dataset.hero);
    const a = ans(s.id);
    if (a && a.completed) { showFinal(a.answer); showFb(fb, a.correct, fbFor(a.correct), false); if (a.correct) train(); }
    opts.forEach(o => o.addEventListener("click", () => {
      if (isDone(s.id)) return;
      const sel = +o.dataset.opt, ok = sel === s.correct;
      setAns(s.id, { completed: true, answer: sel, correct: ok });
      showFinal(sel); playFeedbackSound(ok);
      if (ok) train(); else coinsOut(scr);
      setTimeout(() => showFb(fb, ok, fbFor(ok)), ok ? 500 : 1300);
    }));
  }
  function coinsOut(scr) {
    const bankEl = $("[data-bank]", scr), v = $("[data-bank-v]", scr);
    for (let k = 0; k < 10; k++) {
      const c = document.createElement("span");
      c.className = "coin fly-coin";
      c.style.left = (bankEl.offsetLeft + 12) + "px"; c.style.top = (bankEl.offsetTop + 10) + "px";
      scr.appendChild(c);
      setTimeout(() => { c.style.transform = `translate(${-40 + Math.random() * 220}px, ${260 + Math.random() * 180}px) rotate(${Math.random() * 540}deg)`; c.style.opacity = 0; }, 60 + k * 70);
      setTimeout(() => c.remove(), 1400 + k * 70);
    }
    setTimeout(() => { v.textContent = bank().toLocaleString("en-US"); }, 500);
    bankEl.classList.add("shake"); setTimeout(() => bankEl.classList.remove("shake"), 600);
  }
  R.stretchEnd = s => {
    const b = bank(true), open = STRETCH.filter(x => !isDone(x.id)).length;
    const band = b >= 800 ? "אלופי הכושר הפיננסי! 🏆" : b >= 500 ? "בכושר טוב, יש עוד לאן להשתפר!" : "צריך להמשיך להתאמן…";
    return `
      <img class="bg" src="${IMG}bg-clean.jpg" alt="">
      ${hero("aya-adam-like", 60, 150, 520, A("fly-l", 300), "איה ואדם מחייכים ועושים לייק")}
      <div class="card sum-card narrow end-card ${A("fly-b", 0)}">
        <div class="h-title" style="font-size:25px">${s.title}</div>
        <div class="score-line ${A("pop", 500)}"><span class="coin"></span>נשארו לכם <span class="big">${b.toLocaleString("en-US")} ₪</span> מתוך 1,000 ₪ בקופה</div>
        ${open ? `<p class="open-note">${open} שאלות לא נענו ונספרו כשגויות.</p>` : ""}
        <p class="h-sub" style="margin-top:6px">${band}</p>
        <p class="txt" style="font-size:17.5px;margin-top:4px">${s.learned}</p>
        <ul class="bul">${s.bullets.map(x => `<li>${x}</li>`).join("")}</ul>
      </div>`;
  };

  /* ---------------------------------------------------- advanced */
  const CARD_ART = {
    podcast: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="17" y="6" width="14" height="24" rx="7" fill="#0B2B3B"/><path d="M11 22a13 13 0 0 0 26 0" fill="none" stroke="#0B2B3B" stroke-width="3" stroke-linecap="round"/><path d="M24 35v7M17 42h14" stroke="#0B2B3B" stroke-width="3" stroke-linecap="round"/></svg>`,
    shield: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4l16 6v12c0 11-7 19-16 22C15 41 8 33 8 22V10z" fill="#0B2B3B"/><path d="M17 24l5 5 9-10" fill="none" stroke="#66D1E3" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  };
  R.advanced = s => `
    <img class="bg" src="${IMG}bg-clean.jpg" alt="">
    ${hero("adam-flex", -12, 193, 461, A("fly-l", 200))}
    ${hero("aya-flex", 900, 190, 464, A("fly-r", 200))}
    <div class="adv-shade" aria-hidden="true"></div>
    <div class="adv-lead ${A("fly-t", 0)}">
      <p class="l1">${s.lines[0]}</p>
      ${s.lines.slice(1).map(l => `<p class="l2">${l}</p>`).join("")}
    </div>
    <div class="adv-cards">
      ${s.cards.map((c, i) => `
        <button type="button" class="adv-card ${A("fly-b", 300 + i * 140)}" data-link="${c.url}">
          <span class="thumb ${c.icon}">${CARD_ART[c.icon]}<span class="kind">${c.kind}</span></span>
          <span class="ttl">${c.title}</span>
          <span class="tx">${c.text}</span>
          <span class="go">${linkUrl(c.url) ? "מעבר לתוכן ←" : "קישור יתווסף בהמשך"}</span>
        </button>`).join("")}
    </div>
    <p class="adv-outro ${A("fade", 1000)}">${s.outro}</p>`;

  const BIND = { boost: bindBoost, timeline: bindTimeline, station: bindStation, figures: bindFigures, series: bindSeries, vision: bindVision, match: bindMatch,
    access: bindAccess, dragmatch: bindDragmatch, security: bindSecurity, pulley: bindPulley, wall: bindWall, mcq: bindMcq };

  /* ------------------------------------------------------------ building */
  const screensEl = $("#screens");
  function build(s) {
    const div = document.createElement("div");
    div.className = "screen";
    div.id = "scr-" + s.id;
    div.dataset.type = s.type;
    div.innerHTML = R[s.type](s);
    $$("[data-d]", div).forEach(el => el.style.setProperty("--d", el.dataset.d + "ms"));
    $$(".a", div).forEach(el => {
      el.addEventListener("animationend", e => { if (e.target === el) el.classList.remove("a"); });
      // hovering / focusing an element still in its entrance ends the entrance at once – otherwise leaving it restarted
      // the entrance animation and the button blinked out and back in
      const settle = () => el.classList.remove("a");
      el.addEventListener("pointerenter", settle, { once: true }); el.addEventListener("focusin", settle, { once: true });
    });
    return div;
  }
  /* no lone word on the last line: the last space becomes a no-break space when needed */
  const NO_JOIN = /[A-Za-z=+×÷≈−\/@]/;
  function fixOrphans(root) {
    $$("p, li, .h-title, .ifb-head, .btn, .ttl, .tx", root).forEach(el => {
      if (el.offsetParent === null) return;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodes = []; while (walker.nextNode()) if (walker.currentNode.textContent.trim()) nodes.push(walker.currentNode);
      const last = nodes[nodes.length - 1]; if (!last || last.parentElement.closest("bdi")) return;
      const txt = last.textContent, m = txt.match(/(\S+)\s*$/); if (!m) return;
      const wordStart = m.index, sp = txt.lastIndexOf(" ", wordStart - 1);
      if (sp < 0 || sp !== wordStart - 1) return;
      const prevWord = (txt.slice(0, sp).match(/(\S+)$/) || [""])[0];
      if (!prevWord || NO_JOIN.test(m[1]) || NO_JOIN.test(prevWord)) return;
      const r1 = document.createRange(); r1.setStart(last, wordStart); r1.setEnd(last, wordStart + m[1].length);
      const r0 = document.createRange(); r0.setStart(last, sp - prevWord.length); r0.setEnd(last, sp);
      const a = r0.getClientRects(), b = r1.getClientRects(); if (!a.length || !b.length) return;
      if (b[0].top - a[a.length - 1].top > 2) last.textContent = txt.slice(0, sp) + " " + txt.slice(sp + 1);
    });
  }
  function setMachineHover(scr, set, on) {
    $$(`[data-machine-hit="${set}"]`, scr).forEach(m => m.classList.toggle("hover", on));
    $$(`.machine-pill[data-machine="${set}"]`, scr).forEach(p => p.classList.toggle("hover", on));
  }
  function bindCommon(scr, s) {
    scr.addEventListener("click", e => {
      const go = e.target.closest("[data-go]");
      if (go) return goTo(go.dataset.go);
      const link = e.target.closest("[data-link]");
      if (link) return openLink(link.dataset.link);
      if (e.target.closest("[data-close]") || e.target.classList.contains("dim")) {
        const L = e.target.closest(".layer"); if (L) { hideLayer(L); if (scr._onLayerClose) scr._onLayerClose(); }
      }
    });
    scr.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      const L = $(".layer.show", scr); if (L) { hideLayer(L); if (scr._onLayerClose) scr._onLayerClose(); }
    });
    // menu: machines are transparent PNGs – only their opaque pixels react
    $$("[data-machine-hit]", scr).forEach(el => {
      const set = el.dataset.machineHit;
      let alpha = null;
      const prep = () => {
        const c = document.createElement("canvas"); c.width = el.naturalWidth; c.height = el.naturalHeight;
        const g = c.getContext("2d"); g.drawImage(el, 0, 0);
        try { alpha = g.getImageData(0, 0, c.width, c.height).data; } catch (e) { alpha = null; }
      };
      if (el.complete && el.naturalWidth) prep(); else el.addEventListener("load", prep, { once: true });
      const opaqueAt = e => {
        if (!alpha) return true;
        const r = el.getBoundingClientRect();
        const x = Math.floor((e.clientX - r.left) / r.width * el.naturalWidth), y = Math.floor((e.clientY - r.top) / r.height * el.naturalHeight);
        return alpha[(y * el.naturalWidth + x) * 4 + 3] > 40;
      };
      el.addEventListener("pointermove", e => setMachineHover(scr, set, opaqueAt(e)));
      el.addEventListener("pointerleave", () => setMachineHover(scr, set, false));
      el.addEventListener("click", e => { if (opaqueAt(e)) goTo(el.dataset.goMachine); });
    });
    $$(".machine-pill[data-machine]", scr).forEach(p => {
      const set = p.dataset.machine;
      p.addEventListener("pointerenter", () => setMachineHover(scr, set, true));
      p.addEventListener("pointerleave", () => setMachineHover(scr, set, false));
      p.addEventListener("focus", () => setMachineHover(scr, set, true));
      p.addEventListener("blur", () => setMachineHover(scr, set, false));
      p.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goTo(p.dataset.go); } });
    });
    const bgVideo = $("video.bg[autoplay]", scr);
    if (bgVideo) bgVideo.play().catch(() => {});
    if (BIND[s.type]) BIND[s.type](scr, s);
  }

  DATA.screens.forEach(s => screensEl.appendChild(build(s)));

  /* -------------------------------------------------------------- chrome */
  const chrome = $("#chrome");
  chrome.innerHTML = `
    <div class="chapter-tag hidden" data-c="tag"><img src="${UI}chapter-tag.png" alt=""><span></span></div>
    <button class="btn-img home-btn hidden" data-c="home" title="חזרה למסך הבית"><img src="${UI}btn-home.png" alt="בית"></button>
    <div class="coin-counter hidden" data-c="coins"><span class="coin"></span><span data-c="coins-v">0</span><span class="lbl">מטבעות</span></div>
    <button type="button" class="nav-btn next-btn hidden" data-c="next" aria-label="הבא" title="הבא"><img src="${UI}nav-arrow.png" alt=""></button>
    <button type="button" class="nav-btn prev-btn hidden" data-c="prev" aria-label="הקודם" title="הקודם"><img src="${UI}nav-arrow.png" alt=""></button>
    <button class="btn-img sound-btn" data-c="sound" title="סאונד"><img alt="סאונד"></button>
    <div class="boi-mark hidden" data-c="boi"><img src="${UI}logo-boi.png" alt="בנק ישראל"></div>
    <button type="button" class="skip-practice hidden" data-c="skip" title="דילוג לתרגול">
      <span data-c="skip-t">דלגו לתרגול</span>
      <svg class="ic" viewBox="0 0 15 17" aria-hidden="true" focusable="false">
        <path d="M1.7 1.7 10 8.5 1.7 15.3Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="3.2" stroke-linejoin="round"></path>
        <rect x="12" y="0" width="3" height="17" rx="1.5" fill="#FFFFFF"></rect>
      </svg>
    </button>`;
  const C = k => $(`[data-c="${k}"]`, chrome);
  const soundImg = () => { $("img", C("sound")).src = UI + (state.sound ? "sound-on.png" : "sound-off.png"); };
  soundImg();
  C("sound").addEventListener("click", () => {
    state.sound = !state.sound; save(); soundImg();
    if (!state.sound) stopFeedbackSound();
    toast(state.sound ? "הסאונד הופעל (הקריינות תתווסף בהמשך)" : "הסאונד הושתק");
  });
  C("home").addEventListener("click", () => goTo("menu"));
  C("skip").addEventListener("click", () => { const to = C("skip").dataset.go; if (to) goTo(to); });
  C("next").addEventListener("click", () => current && current.next && goTo(current.next));
  C("prev").addEventListener("click", () => current && current.prev && goTo(current.prev));

  const TOP_LEVEL = ["intro", "menu"];
  const POINT_TYPES = ["station", "timeline", "fhowto", "figures", "series", "match", "ladderText", "vision", "access", "dragmatch", "pulley", "wall"];
  function updateChrome(s) {
    C("tag").classList.toggle("hidden", !s.tag);
    if (s.tag) $("span", C("tag")).textContent = s.mode === "stretch" ? `שאלה ${s.num}` : s.tag;
    const inChapter = !TOP_LEVEL.includes(s.type);
    C("home").classList.toggle("hidden", !inChapter);
    const gated = !!s.gate && !allVisited(s);
    // the values ladder moves on by its own buttons and the ladder rungs only – no "הבא" arrow there (client)
    C("next").classList.toggle("hidden", !inChapter || !byId[s.next] || gated || (s.set === "ladder" && s.type !== "boost" && s.type !== "summary" && !s.showNext));
    C("prev").classList.toggle("hidden", !inChapter || !byId[s.prev]);
    const showCoins = s.set && POINT_TYPES.includes(s.type);
    const cc = C("coins");
    cc.classList.toggle("hidden", !showCoins);
    C("boi").classList.toggle("hidden", s.type === "menu");
    // "דלגו לתרגול" before a set's exercises (in the ladder: up to its opening screen only – no stage skipping, client)
    const sk = C("skip");
    let to = s.skip && byId[s.skip] ? s.skip : "", label = "דלגו לתרגול";
    sk.classList.toggle("hidden", !to); sk.dataset.go = to; C("skip-t").textContent = label;
    sk.classList.toggle("wide", label !== "דלגו לתרגול");
    if (showCoins) {
      const v = setScore(s.set), el = C("coins-v");
      if (+el.textContent !== v) bumpEl(cc);
      el.textContent = v;
    }
  }

  /* ---------------------------------------------------------- navigation */
  let current = null;
  function goTo(id) {
    const s = byId[id]; if (!s) return;
    firstVisit = !state.seen[s.id];
    state.seen[s.id] = true;
    if (s.type === "summary") state.done[s.set] = true;
    save();
    if (current) { const old = $("#scr-" + current.id); if (old) { if (old._leave) old._leave(); old.classList.remove("active"); $$("video, iframe", old).forEach(v => { if (v.pause) v.pause(); else v.remove(); }); } }
    modalMode(false);
    const nw = build(s), old = $("#scr-" + s.id);
    screensEl.replaceChild(nw, old);
    nw.classList.add("active");
    // safety net: the entrance class goes away once its time has passed, even if "animationend" never fired
    $$(".a", nw).forEach(el => setTimeout(() => el.classList.remove("a"), (parseInt(el.dataset.d, 10) || 0) + 900));
    current = s;
    bindCommon(nw, s);
    updateChrome(s);
    requestAnimationFrame(() => fixOrphans(nw));
    try { history.replaceState(null, "", "#" + s.id); } catch (e) {}
    reviewSync();
  }

  /* -------------------------------------------------------------- scaling */
  function fit() {
    const st = $("#stage"), k = Math.min(window.innerWidth / W, window.innerHeight / H);
    st.style.transform = `scale(${k})`;
    st.style.left = (window.innerWidth - W * k) / 2 + "px";
    st.style.top = (window.innerHeight - H * k) / 2 + "px";
  }
  window.addEventListener("resize", fit); fit();

  /* ------------------------------------------------------- review helpers */
  // the production notes panel was removed from the bar (client); the notes stay in data.js for the Storyline build
  const sel = $("#review-jump");
  let lastScene = null, group = null;
  DATA.screens.forEach(s => {
    if (s.scene !== lastScene) { group = document.createElement("optgroup"); group.label = s.scene; sel.appendChild(group); lastScene = s.scene; }
    const o = document.createElement("option"); o.value = s.id; o.textContent = (s.index + 1) + ". " + s.name; group.appendChild(o);
  });
  sel.addEventListener("change", () => goTo(sel.value));
  $("#review-reset").addEventListener("click", () => { state = Object.assign(fresh(), { sound: state.sound }); save(); goTo("intro"); toast("ההתקדמות אופסה"); });
  function reviewSync() { if (current) sel.value = current.id; }

  window.LOMDA = { DATA, SETS, LINKS, goTo, state: () => state };

  const start = (location.hash || "").slice(1);
  goTo(byId[start] ? start : "intro");

  /* the cover: PLAY closes it and opens the first screen; a deep link to any other screen skips it */
  const cover = $("#cover"), coverBtn = $(".cover-play", cover);
  const firstScreen = DATA.screens[0].id;
  const behind = [$("#screens"), $("#chrome")];
  const dropCover = () => { cover.classList.add("gone"); behind.forEach(e => e.removeAttribute("inert")); };
  if (byId[start] && start !== firstScreen) dropCover();
  else behind.forEach(e => e.setAttribute("inert", ""));
  coverBtn.addEventListener("click", () => { dropCover(); goTo(firstScreen); });
  sel.addEventListener("change", dropCover);
})();
