'use strict';
/* Strength Tracker — Dean Turner 3-Day Full Body. Static PWA, data in localStorage. */
const VERSION = '1.1.3';
const KEY = 'st_data_v1';
const LB = 2.20462262;
const DAYS = ['A', 'B', 'C'];
const SCHEDULE = ['A', 'off', 'B', 'off', 'C', 'off', 'off'];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-5);
const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const e1rm = (w, r) => r <= 1 ? w : w * (1 + r / 30);

/* ---------- program ---------- */
const MUSCLES = ['Quads', 'Hamstrings', 'Glutes', 'Adductors', 'Calves', 'Chest', 'Back', 'Front delts', 'Side delts', 'Biceps', 'Triceps', 'Abs', 'Other'];
const MUSCLE_OF = { 'leg extensions': 'Quads', 'hack or pendulum squats': 'Quads', 'seated leg curls': 'Hamstrings', 'lying leg curls': 'Hamstrings',
  '45° back extensions': 'Glutes', 'glute bridges': 'Glutes', 'adduction machine': 'Adductors', 'calf press': 'Calves',
  'pec fly machine': 'Chest', 'incline machine press': 'Chest', 'seated/flat machine press': 'Chest',
  'wide-grip lat pulldown': 'Back', 'chest-supported t-bar rows': 'Back', 'chest-supported machine rows': 'Back',
  'seated machine overhead press': 'Front delts', 'machine/cable lateral raises': 'Side delts',
  'machine preacher curls': 'Biceps', 'seated db curls': 'Biceps', 'seated db hammer curls': 'Biceps',
  'incline cable tricep pushdowns': 'Triceps', 'dip machine': 'Triceps', 'overhead tricep extensions': 'Triceps', 'ab crunch machine': 'Abs' };
const MULTI = new Set(['hack or pendulum squats', 'incline machine press', 'seated/flat machine press', 'wide-grip lat pulldown',
  'chest-supported t-bar rows', 'chest-supported machine rows', 'seated machine overhead press', 'dip machine']);
const exMeta = name => ({ muscle: MUSCLE_OF[norm(name)] || 'Other', multi: MULTI.has(norm(name)), uni: false });
function X(name, o) { return Object.assign({ id: uid(), name, sets: 2, repMin: 5, repMax: 10, inc: null, cue: '' }, exMeta(name), o || {}); }
const UNI_CUE = 'Unilateral: do your weak side first, then match those reps on the strong side';
const RIR_OPTS = [0, 1, 2, 3];
const rirLbl = r => r >= 3 ? '3+' : String(r);
const CALF_CUE = 'Pause 3-5 s in the stretch, then up to neutral';
function defaultDay(d) {
  const P = {
    A: [X('Leg extensions'), X('Seated leg curls'), X('Pec fly machine'), X('Wide-grip lat pulldown'),
      X('Seated machine overhead press'), X('Machine preacher curls'), X('Incline cable tricep pushdowns'),
      X('Calf press', { cue: CALF_CUE }), X('Ab crunch machine')],
    B: [X('Lying leg curls'), X('Leg extensions'), X('Incline machine press'),
      X('Chest-supported T-bar rows', { cue: 'Overhand grip' }), X('Machine/cable lateral raises'),
      X('Seated DB curls', { cue: 'Palms up, arm supported' }), X('Dip machine'),
      X('Adduction machine', { sets: 3 }), X('Glute bridges')],
    C: [X('Hack or pendulum squats'), X('45° back extensions'), X('Seated/flat machine press'),
      X('Chest-supported machine rows', { cue: 'Neutral grip' }), X('Seated machine overhead press'),
      X('Seated DB hammer curls', { cue: 'Palms facing' }), X('Overhead tricep extensions'),
      X('Ab crunch machine'), X('Calf press', { cue: CALF_CUE })]
  };
  return { name: 'Day ' + d, exercises: P[d] };
}
const SEEDS = { 'lying leg curls': 140, 'leg extensions': 160 };

/* ---------- storage ---------- */
function fresh() {
  return {
    version: 1,
    settings: { unit: 'lb', rest: 180, incLb: 5, incKg: 2.5, vibrate: true, sound: true },
    templates: { A: defaultDay('A'), B: defaultDay('B'), C: defaultDay('C') },
    seeds: Object.assign({}, SEEDS), sessions: [], active: null, lastExport: null
  };
}
function migrate(d) {
  const f = fresh();
  const out = Object.assign(f, d);
  out.settings = Object.assign(fresh().settings, d.settings || {});
  out.templates = out.templates || {};
  DAYS.forEach(k => { if (!out.templates[k] || !Array.isArray(out.templates[k].exercises)) out.templates[k] = defaultDay(k);
    out.templates[k].exercises.forEach(e => { const m = exMeta(e.name); if (!e.muscle) e.muscle = m.muscle; if (e.multi == null) e.multi = m.multi; if (e.uni == null) e.uni = false; }); });
  out.sessions = (Array.isArray(d.sessions) ? d.sessions : []).slice().sort((a, b) => a.start - b.start);
  out.seeds = Object.assign({}, SEEDS, d.seeds || {});
  return out;
}
function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.version) return migrate(d); } catch (e) { }
  return fresh();
}
let D = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) { toast('Could not save — storage full?'); } }

/* ---------- units ---------- */
const U = () => D.settings.unit;
const disp = lb => U() === 'kg' ? lb / LB : lb;
const fromDisp = v => U() === 'kg' ? v * LB : v;
const r2 = v => Math.round(v * 100) / 100;
const fw = lb => String(+r2(disp(lb || 0)).toFixed(2));
const fe = lb => String(Math.round(disp(lb || 0) * 2) / 2); // est. 1RM, nearest 0.5
function stepDisp(e) {
  if (U() === 'kg') return e && e.inc != null ? Math.max(0.25, Math.round(e.inc / LB * 4) / 4) : D.settings.incKg;
  return e && e.inc != null ? e.inc : D.settings.incLb;
}
const fmtDate = t => new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const fmtDateY = t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const fmtTime = t => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const ymd = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

/* ---------- history helpers ---------- */
const working = e => (e.sets || []).filter(s => !s.warm);
function lastFor(key) {
  for (let i = D.sessions.length - 1; i >= 0; i--) {
    const e = D.sessions[i].exercises.find(x => x.key === key && working(x).length);
    if (e) return { s: D.sessions[i], e };
  }
  return null;
}
function exHistory(key) {
  return D.sessions.map(s => {
    const e = s.exercises.find(x => x.key === key); if (!e) return null;
    const ws = working(e); if (!ws.length) return null;
    const top = ws.reduce((a, b) => (b.w > a.w || (b.w === a.w && b.r > a.r)) ? b : a);
    const best = Math.max(...ws.map(x => e1rm(x.w, x.r)));
    return { t: s.start, sid: s.id, name: e.name, sets: e.sets, top, e1: best, note: e.note };
  }).filter(Boolean);
}
function allKeys() {
  const m = new Map();
  D.sessions.forEach(s => s.exercises.forEach(e => m.set(e.key, e.name)));
  DAYS.forEach(d => D.templates[d].exercises.forEach(e => { const k = norm(e.name); if (!m.has(k)) m.set(k, e.name); }));
  return [...m.entries()].map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name));
}
function nextDay() {
  const last = D.sessions[D.sessions.length - 1];
  if (!last) return 'A';
  return DAYS[(DAYS.indexOf(last.day) + 1) % 3] || 'A';
}
/* Dean Turner: if set 1 reaches the top of the rep range at 0-1 RIR, add weight next time (set 2 is expected to drop). */
const hitTop = (sets, repMax) => !!sets[0] && sets[0].r >= repMax && (sets[0].rir == null || sets[0].rir <= 1);
const roundStep = (lb, e) => { const st = stepDisp(e); return fromDisp(Math.max(0, Math.round(disp(lb) / st) * st)); };
function warmupsFor(workLb, e) {
  // ramp: ~50% x8, ~70% x5, ~85% x3 of the working weight, rounded to the exercise increment
  return [[0.5, 8], [0.7, 5], [0.85, 3]].map(([p, r]) => ({ w: roundStep(workLb * p, e), r, done: false, warm: true }))
    .filter((s, i, a) => s.w > 0 && (i === 0 || s.w !== a[i - 1].w));
}

/* ---------- workout ---------- */
function buildEx(t, firstMulti) {
  const key = norm(t.name), last = lastFor(key), n = t.sets;
  let sets = [], bump = null, lastSets = [], lastDate = null;
  if (last) {
    lastSets = working(last.e).map(s => ({ w: s.w, r: s.r, rir: s.rir })); lastDate = last.s.start;
    if (hitTop(lastSets, t.repMax)) {
      const top = lastSets[0].w;
      const to = fromDisp(r2(disp(top) + stepDisp(t)));
      bump = { from: top, to };
      for (let i = 0; i < n; i++) sets.push({ w: to, r: Math.max(t.repMin, t.repMax - 2), rir: 1, done: false });
    } else {
      for (let i = 0; i < n; i++) { const l = lastSets[i] || lastSets[lastSets.length - 1]; sets.push({ w: l.w, r: l.r, rir: 1, done: false }); }
    }
  } else {
    const seed = D.seeds[key] || 0;
    for (let i = 0; i < n; i++) sets.push({ w: seed, r: 8, rir: 1, done: false });
  }
  const ex = { key, name: t.name, planned: n, repMin: t.repMin, repMax: t.repMax, inc: t.inc, cue: t.cue, muscle: t.muscle || 'Other', multi: !!t.multi, uni: !!t.uni,
    firstMulti: !!firstMulti, sets, note: '', bump, lastSets, lastDate };
  if (firstMulti && sets[0] && sets[0].w > 0) ex.sets = warmupsFor(sets[0].w, ex).concat(sets);
  return ex;
}
function startWorkout(day) {
  if (D.active && !confirm('A workout is already in progress. Discard it and start Day ' + day + '?')) return;
  const t = D.templates[day];
  D.active = { id: uid(), day, start: Date.now(), cur: 0, restEnd: null, restAlerted: false, exercises: t.exercises.map((e, i) => buildEx(e, e.multi && t.exercises.findIndex(x => x.multi) === i)) };
  save(); go('#/workout');
}
const curEx = () => D.active.exercises[clamp(D.active.cur, 0, D.active.exercises.length - 1)];
const doneSets = A => A.exercises.reduce((n, e) => n + e.sets.filter(s => s.done && !s.warm).length, 0);
const exFull = e => { const w = working(e); return w.length > 0 && w.every(s => s.done); };

function detectPRs(sess) {
  const prs = [];
  sess.exercises.forEach(e => {
    const ws = working(e); if (!ws.length) return;
    let pw = 0, pe = 0, had = false;
    D.sessions.forEach(s => s.exercises.forEach(x => { if (x.key !== e.key) return; working(x).forEach(st => { had = true; pw = Math.max(pw, st.w); pe = Math.max(pe, e1rm(st.w, st.r)); }); }));
    if (!had) return;
    const cw = Math.max(...ws.map(s => s.w)), ce = Math.max(...ws.map(s => e1rm(s.w, s.r)));
    if (cw > pw + 1e-6) prs.push({ key: e.key, name: e.name, type: 'Heaviest weight', v: cw });
    if (ce > pe + 0.05) prs.push({ key: e.key, name: e.name, type: 'Best est. 1RM', v: ce });
  });
  return prs;
}
function finishWorkout() {
  const A = D.active; if (!A) return;
  const done = A.exercises.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0);
  const undone = A.exercises.reduce((n, e) => n + working(e).filter(s => !s.done).length, 0);
  if (!done) { if (confirm('No sets are marked done. Discard this workout?')) { D.active = null; save(); releaseWake(); go('#/home'); } return; }
  if (!confirm(undone ? `${undone} working set(s) not marked done will not be saved.\n\nFinish and save the workout?` : 'Finish and save this workout?')) return;
  const sess = {
    id: A.id, day: A.day, start: A.start, end: Date.now(),
    exercises: A.exercises.map(e => ({ key: e.key, name: e.name, repMax: e.repMax, planned: e.planned, muscle: e.muscle,
      sets: e.sets.filter(s => s.done).map(s => s.warm ? { w: s.w, r: s.r, warm: true } : { w: s.w, r: s.r, rir: s.rir == null ? 1 : s.rir }), note: (e.note || '').trim() }))
      .filter(e => e.sets.length || e.note)
  };
  sess.prs = detectPRs(sess);
  D.sessions.push(sess); D.active = null; save(); releaseWake();
  go('#/summary/' + sess.id);
}

/* ---------- rest timer ---------- */
let audioCtx = null;
function primeAudio() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) { } }
function beep() {
  if (!D.settings.sound || !audioCtx) return;
  try {
    [0, 0.45, 0.9].forEach(off => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime + off;
      o.frequency.value = 880; o.type = 'square'; g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + 0.36);
    });
  } catch (e) { }
}
function restAlert() {
  window.__restAlerts = (window.__restAlerts || 0) + 1;
  if (D.settings.vibrate && navigator.vibrate) navigator.vibrate([600, 250, 600, 250, 600]);
  beep();
}
function startRest() { D.active.restStart = Date.now(); D.active.restEnd = Date.now() + D.settings.rest * 1000; D.active.restAlerted = false; save(); tick(); }
function restLen() { const A = D.active; return A && A.restStart ? (A.restEnd - A.restStart) / 1000 : D.settings.rest; }
let timerState = '';
function tick() {
  const el = $('#timer'), A = D.active;
  if (!A || !A.restEnd) { if (!el.hidden) { el.hidden = true; document.body.classList.remove('resting'); } return; }
  const left = (A.restEnd - Date.now()) / 1000;
  if (el.hidden) { el.hidden = false; document.body.classList.add('resting'); }
  if (left > 0) {
    if (timerState !== 'run') { el.className = ''; $('#tlbl').textContent = 'REST'; timerState = 'run'; }
    $('#tclock').textContent = mmss(Math.ceil(left));
    $('#tfill').style.width = clamp(left / restLen() * 100, 0, 100) + '%';
  } else {
    if (!A.restAlerted) { A.restAlerted = true; save(); restAlert(); }
    if (timerState !== 'over') { el.className = 'over'; $('#tlbl').textContent = 'REST OVER'; $('#tclock').textContent = 'GO!'; $('#tfill').style.width = '0%'; timerState = 'over'; }
    if (left < -20) { A.restEnd = null; save(); tick(); }
  }
}
setInterval(tick, 250);

/* ---------- wake lock (keeps screen on during a workout) ---------- */
let wakeLock = null;
async function wake() {
  try { if (D.active && 'wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { }
}
function releaseWake() { try { wakeLock && wakeLock.release(); } catch (e) { } wakeLock = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { tick(); if (location.hash.startsWith('#/workout')) wake(); } });

/* ---------- UI helpers ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600); }
function go(h) { if (location.hash === h) render(); else location.hash = h; }
const dayName = d => esc((D.templates[d] && D.templates[d].name) || 'Day ' + d);
const setStr = s => `${fw(s.w)}×${s.r}` + (s.warm || s.rir == null ? '' : ` @${rirLbl(s.rir)}`) + (!s.warm && s.rir >= 3 ? ' ⚠' : '');
function chart(hist) {
  if (!hist.length) return '<p class="mut">No data yet.</p>';
  const W = 360, H = 230, L = 50, R = 14, T = 16, B = 34;
  const ys = hist.flatMap(h => [disp(h.top.w), disp(h.e1)]);
  let mn = Math.min(...ys), mx = Math.max(...ys);
  if (mx - mn < 1) { mn -= 5; mx += 5; }
  const pad = (mx - mn) * 0.12; mn = Math.max(0, mn - pad); mx += pad;
  const t0 = hist[0].t, t1 = hist[hist.length - 1].t;
  const xf = t => t1 === t0 ? L + (W - L - R) / 2 : L + (t - t0) / (t1 - t0) * (W - L - R);
  const yf = v => T + (1 - (v - mn) / (mx - mn)) * (H - T - B);
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const v = mn + (mx - mn) * i / 4, y = yf(v).toFixed(1);
    g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="#2c2c2c" stroke-width="1"/><text x="${L - 6}" y="${+y + 5}" fill="#bbb" font-size="13" text-anchor="end">${Math.round(v)}</text>`;
  }
  const md = t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  g += `<text x="${L}" y="${H - 10}" fill="#bbb" font-size="13">${md(t0)}</text>`;
  if (t1 !== t0) g += `<text x="${W - R}" y="${H - 10}" fill="#bbb" font-size="13" text-anchor="end">${md(t1)}</text>`;
  const line = (f, c) => {
    const pts = hist.map(h => [xf(h.t), yf(f(h))]);
    return `<polyline fill="none" stroke="${c}" stroke-width="3.5" stroke-linejoin="round" points="${pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}"/>` +
      pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="5" fill="${c}"/>`).join('');
  };
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Progress chart">${g}${line(h => disp(h.e1), '#6cb6ff')}${line(h => disp(h.top.w), '#ffd400')}</svg>
  <div class="legend"><span><i style="background:#ffd400"></i>Top-set weight</span><span><i style="background:#6cb6ff"></i>Est. 1RM</span></div>`;
}

/* ---------- views ---------- */
function vHome() {
  const nd = nextDay(), last = D.sessions[D.sessions.length - 1];
  let h = '<h1>Strength</h1>';
  if (D.active) {
    const A = D.active;
    h += `<div class="card hl"><div class="lbl">Workout in progress</div><div class="h1">${dayName(A.day)}</div>
      <div class="mut">Started ${fmtTime(A.start)} · ${doneSets(A)} sets done</div>
      <button class="btn primary big" data-a="resume">Resume workout</button>
      <button class="btn danger" data-a="discard">Discard workout</button></div>`;
  } else {
    const ex = D.templates[nd].exercises;
    h += `<div class="card hl"><div class="lbl">Next workout</div><div class="huge" id="nextday">${nd}</div><div class="h2">${dayName(nd)}</div>
      <ol class="exlist">${ex.map(e => `<li>${esc(e.name)}${e.sets !== 2 ? ` <span class="mut">(${e.sets} sets)</span>` : ''}</li>`).join('')}</ol>
      <button class="btn primary big" data-a="start" data-d="${nd}">Start Day ${nd}</button></div>
      <div class="card"><div class="lbl">Or pick another day</div><div class="row3" style="margin-top:10px">
      ${DAYS.map(d => `<button class="btn${d === nd ? ' on' : ''}" data-a="start" data-d="${d}">Day ${d}</button>`).join('')}</div></div>`;
  }
  const dn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  h += `<div class="card"><div class="lbl">Weekly schedule</div><div class="week">${SCHEDULE.map((s, i) => `<div class="${s === 'off' ? 'off' : (s === nd && !D.active ? 't' : '')}"><span class="dn">${dn[i]}</span>${s === 'off' ? 'off' : s}</div>`).join('')}</div>
    <div class="mut small" style="margin-top:8px">2 × 5–10 at 0–1 RIR (Adduction 3 sets). Rest ${mmss(D.settings.rest)}+ between hard sets. Set 1 hits 10 reps at RIR 0–1 → add weight next time.</div></div>`;
  if (last) h += `<a class="item" href="#/session/${last.id}"><div class="card"><span class="chev">›</span><div class="lbl">Last workout</div><div class="t1">${dayName(last.day)} · ${fmtDate(last.start)}</div>
    <div class="t2">${last.exercises.reduce((n, e) => n + working(e).length, 0)} sets · ${Math.round((last.end - last.start) / 60000)} min</div></div></a>`;
  if (deferredInstall) h += `<button class="btn" data-a="install">Install app on this phone</button>`;
  return h;
}
function setRow(e, s, j, n) {
  const lbl = s.warm ? '<b class="warmt">Warm-up</b>' : `<b>Set ${n}</b>`;
  const ls = !s.warm ? e.lastSets[n - 1] : null;
  const last = s.warm ? '<span class="lastset">not counted</span>' : `<span class="lastset">Last: ${ls ? fw(ls.w) + ' × ' + ls.r + (ls.rir != null ? ' @' + rirLbl(ls.rir) : '') : '—'}</span>`;
  const rir = s.rir == null ? 1 : s.rir;
  if (s.done) return `<div class="set done${s.warm ? ' warm' : ''}" data-set="${j}"><div class="sethead">${lbl}${last}</div>
    <div class="row"><div class="doneval">✓ ${fw(s.w)} ${U()} × ${s.r}${s.warm ? '' : `<span class="rirdone"> RIR ${rirLbl(rir)}</span>`}</div><button class="btn sm" data-a="undo" data-j="${j}">Edit</button></div>
    ${!s.warm && rir >= 3 ? '<div class="easy">⚠ Too easy — 3+ reps left. Go heavier or closer to failure.</div>' : ''}</div>`;
  return `<div class="set${s.warm ? ' warm' : ''}" data-set="${j}"><div class="sethead">${lbl}${last}</div>
    <div class="stepper"><button class="stp" data-a="w-" data-j="${j}" aria-label="Less weight">−</button>
      <div class="numwrap"><input class="num" data-c="w" data-j="${j}" inputmode="decimal" value="${fw(s.w)}" aria-label="Weight"><span class="unit">${U()} · ±${stepDisp(e)}</span></div>
      <button class="stp" data-a="w+" data-j="${j}" aria-label="More weight">+</button></div>
    <div class="stepper"><button class="stp" data-a="r-" data-j="${j}" aria-label="Fewer reps">−</button>
      <div class="numwrap"><input class="num" data-c="r" data-j="${j}" inputmode="numeric" value="${s.r}" aria-label="Reps"><span class="unit">reps</span></div>
      <button class="stp" data-a="r+" data-j="${j}" aria-label="More reps">+</button></div>
    ${s.warm ? '' : `<div class="rirrow"><span class="unit">RIR</span>${RIR_OPTS.map(v => `<button class="rir${v === rir ? ' on' : ''}${v >= 3 ? ' hi' : ''}" data-a="rir" data-j="${j}" data-v="${v}" aria-label="${rirLbl(v)} reps in reserve">${rirLbl(v)}</button>`).join('')}</div>
    ${rir >= 3 ? '<div class="easy">⚠ RIR 3+ is too easy — aim for 0–1</div>' : ''}`}
    <div class="row">${s.warm ? `<button class="btn sm" style="flex:0 0 auto" data-a="rmset" data-j="${j}">Remove</button>` : ''}
    <button class="btn ${s.warm ? '' : 'ok'} donebtn" data-a="done" data-j="${j}">${s.warm ? 'Log warm-up' : 'Done set'}</button></div></div>`;
}
function vWorkout() {
  const A = D.active; if (!A) { setTimeout(() => go('#/home')); return ''; }
  A.cur = clamp(A.cur, 0, A.exercises.length - 1);
  const e = curEx(), i = A.cur, N = A.exercises.length;
  let h = `<div class="wtop"><button class="btn sm" data-a="home">‹ Home</button><div class="mid">${dayName(A.day)} · ${i + 1}/${N}</div><button class="btn sm ok" data-a="finish">Finish</button></div>
    <div class="jump">${A.exercises.map((x, k) => `<button class="${k === i ? 'cur ' : ''}${exFull(x) ? 'full' : ''}" data-a="jump" data-i="${k}" aria-label="${esc(x.name)}">${k + 1}</button>`).join('')}</div>
    <div class="card"><div class="exname">${esc(e.name)}</div><div class="target">${e.planned} × ${e.repMin}–${e.repMax} reps · 0–1 RIR · rest ${mmss(D.settings.rest)}</div>`;
  if (e.cue) h += `<div class="cue">${esc(e.cue)}</div>`;
  if (e.uni) h += `<div class="cue uni">↔ ${UNI_CUE}</div>`;
  if (e.firstMulti) h += `<div class="cue warmcue">First multi-joint lift: ramp up with 2–3 warm-up sets (not counted). Later exercises: 0–1 warm-ups.</div>`;
  if (e.lastSets.length) h += `<div class="lastline">Last time (${fmtDate(e.lastDate)}): <b>${e.lastSets.map(setStr).join(', ')}</b></div>`;
  else { const w0 = working(e)[0]; h += `<div class="lastline">First time logged${w0 && w0.w && D.seeds[e.key] ? ` · starting at last-used ${fw(D.seeds[e.key])} ${U()}` : ''}</div>`; }
  if (e.bump) h += `<div class="badge" id="addbadge">▲ Add weight: ${fw(e.bump.to)} ${U()} (was ${fw(e.bump.from)})</div>`;
  const w1 = working(e)[0];
  if (w1 && w1.done && hitTop([w1], e.repMax)) h += `<div class="badge outline">✓ Set 1 hit ${e.repMax} at RIR ${rirLbl(w1.rir == null ? 1 : w1.rir)} — add weight next time</div>`;
  let n = 0;
  e.sets.forEach((s, j) => { if (!s.warm) n++; h += setRow(e, s, j, n); });
  h += `<div class="row2" style="margin-top:14px"><button class="btn" data-a="addwarm">+ Warm-up set</button><button class="btn" data-a="sugwarm">Suggest warm-ups</button></div>
    <button class="btn" data-a="addset">+ Extra working set</button>`;
  if (working(e).length > 1 && !working(e)[working(e).length - 1].done) h += `<button class="btn" data-a="rmlast">− Remove last set</button>`;
  h += `<label class="fl" for="note">Notes</label><textarea id="note" data-c="note" rows="2" placeholder="Seat 4, felt strong…">${esc(e.note)}</textarea>`;
  if (exFull(e)) h += i < N - 1 ? `<button class="btn primary big" data-a="next">Next: ${esc(A.exercises[i + 1].name)} ›</button>` : `<button class="btn ok big" data-a="finish">Finish workout</button>`;
  h += `</div>`;
  return h;
}
function vSummary(id) {
  const s = D.sessions.find(x => x.id === id); if (!s) return vHome();
  const sets = s.exercises.reduce((n, e) => n + working(e).length, 0);
  let h = `<h1>Workout saved ✓</h1><div class="card hl"><div class="h1">${dayName(s.day)}</div><div class="mut">${fmtDate(s.start)} · ${Math.round((s.end - s.start) / 60000)} min · ${sets} working sets</div></div>`;
  if (s.prs && s.prs.length) h += `<div class="card"><div class="lbl">New PRs</div>${s.prs.map(p => `<div class="kv"><span>${esc(p.name)}<br><span class="mut small">${p.type}</span></span><b class="badge pr" style="margin:0">${p.type.includes('1RM') ? fe(p.v) : fw(p.v)} ${U()}</b></div>`).join('')}</div>`;
  h += `<div class="card"><div class="lbl">Next workout</div><div class="huge">${nextDay()}</div></div>
    <a class="btn primary big" href="#/home">Done</a><a class="btn" href="#/session/${s.id}">View details</a>`;
  return h;
}
let histTab = 'sessions';
function vHistory() {
  let h = `<h1>History</h1><div class="tabsel"><button class="btn${histTab === 'sessions' ? ' on' : ''}" data-a="htab" data-t="sessions">Workouts</button><button class="btn${histTab === 'ex' ? ' on' : ''}" data-a="htab" data-t="ex">Exercises</button><button class="btn${histTab === 'week' ? ' on' : ''}" data-a="htab" data-t="week">Weekly sets</button></div>`;
  if (histTab === 'week') return h + vWeek();
  if (histTab === 'sessions') {
    if (!D.sessions.length) return h + '<p class="mut">No workouts yet. Finish one and it shows up here.</p>';
    h += D.sessions.slice().reverse().map(s => `<a class="item" href="#/session/${s.id}"><div class="card"><span class="chev">›</span><div class="t1">${dayName(s.day)} · ${fmtDate(s.start)}</div>
      <div class="t2">${s.exercises.reduce((n, e) => n + working(e).length, 0)} sets · ${Math.round((s.end - s.start) / 60000)} min${s.prs && s.prs.length ? ` · ★ ${s.prs.length} PR` : ''}</div></div></a>`).join('');
  } else {
    h += allKeys().map(k => { const hs = exHistory(k.key), l = hs[hs.length - 1];
      return `<a class="item" href="#/exercise/${encodeURIComponent(k.key)}"><div class="card"><span class="chev">›</span><div class="t1">${esc(k.name)}</div><div class="t2">${l ? `Last: ${l.sets.filter(s => !s.warm).map(setStr).join(', ')} · ${fmtDate(l.t)}` : 'No sets yet'}</div></div></a>`; }).join('');
  }
  return h;
}
let weekOff = 0;
const weekStart = off => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + off * 7); return d.getTime(); };
const muscleOf = e => e.muscle || (DAYS.map(d => D.templates[d].exercises.find(x => norm(x.name) === e.key)).find(Boolean) || {}).muscle || MUSCLE_OF[e.key] || 'Other';
function weekCounts(off) {
  const a = weekStart(off), b = a + 7 * 864e5, m = {};
  D.sessions.filter(s => s.start >= a && s.start < b).forEach(s => s.exercises.forEach(e => {
    const n = working(e).length; if (!n) return; const k = muscleOf(e);
    m[k] = m[k] || { sets: 0, sess: new Set() }; m[k].sets += n; m[k].sess.add(s.id);
  }));
  return m;
}
function vWeek() {
  const a = weekStart(weekOff), m = weekCounts(weekOff);
  const plan = {}; DAYS.forEach(d => D.templates[d].exercises.forEach(e => { plan[e.muscle || 'Other'] = (plan[e.muscle || 'Other'] || 0) + e.sets; }));
  const names = MUSCLES.filter(k => m[k] || plan[k]);
  let h = `<div class="card"><div class="row"><button class="btn sm" style="flex:0 0 auto" data-a="wk" data-v="-1">‹</button>
    <div style="text-align:center"><div class="lbl">Week of</div><div class="h2">${fmtDate(a)}</div></div>
    <button class="btn sm" style="flex:0 0 auto" data-a="wk" data-v="1" ${weekOff >= 0 ? 'disabled' : ''}>›</button></div>
    <div class="mut small" style="margin-top:8px">Dean's guide: about 4–7 proper sets per muscle per week, spread over 2+ sessions. Working sets only.</div></div><div class="card">`;
  h += names.map(k => { const c = m[k] || { sets: 0, sess: new Set() }, n = c.sets, cls = n >= 4 && n <= 7 ? 'good' : n > 7 ? 'high' : 'low';
    return `<div class="musc ${cls}"><div class="mrow"><b>${k}</b><span class="mcount">${n}<span class="mut small"> / 4–7</span></span></div>
      <div class="mbar"><i style="width:${clamp(n / 8 * 100, 0, 100)}%"></i><em style="left:50%"></em><em style="left:87.5%"></em></div>
      <div class="mut small">${c.sess.size} session${c.sess.size === 1 ? '' : 's'}${n && c.sess.size < 2 ? ' · spread over 2+' : ''} · plan ${plan[k] || 0}/wk</div></div>`; }).join('');
  return h + '</div>';
}
function vSession(id) {
  const s = D.sessions.find(x => x.id === id); if (!s) return '<p>Not found.</p>';
  let h = `<a class="btn sm" href="#/history">‹ History</a><h1>${dayName(s.day)}</h1><div class="mut" style="margin-bottom:12px">${fmtDateY(s.start)} · ${fmtTime(s.start)}–${fmtTime(s.end)}</div>`;
  h += s.exercises.map(e => `<a class="item" href="#/exercise/${encodeURIComponent(e.key)}"><div class="card"><span class="chev">›</span><div class="t1">${esc(e.name)}</div>
    <div class="setlist">${e.sets.map(st => st.warm ? `<span class="w">W ${setStr(st)}</span>` : setStr(st)).join(' &nbsp; ')}</div>
    ${e.note ? `<div class="t2">📝 ${esc(e.note)}</div>` : ''}</div></a>`).join('');
  h += `<button class="btn danger" data-a="delsess" data-id="${s.id}">Delete this workout</button>`;
  return h;
}
function vExercise(key) {
  const hs = exHistory(key), k = allKeys().find(x => x.key === key);
  const name = k ? k.name : key;
  let h = `<a class="btn sm" href="#/history">‹ History</a><h1>${esc(name)}</h1><div class="card">${chart(hs)}</div>`;
  if (hs.length) {
    const bw = hs.reduce((a, b) => (b.top.w > a.top.w || (b.top.w === a.top.w && b.top.r > a.top.r)) ? b : a), be = hs.reduce((a, b) => b.e1 > a.e1 ? b : a);
    h += `<div class="card"><div class="kv"><span>Heaviest</span><b>${fw(bw.top.w)} ${U()} × ${bw.top.r}</b></div><div class="kv"><span>Best est. 1RM</span><b>${fe(be.e1)} ${U()}</b></div><div class="kv"><span>Workouts</span><b>${hs.length}</b></div></div>`;
    h += hs.slice().reverse().map(x => `<div class="card"><div class="t1" style="font-weight:800">${fmtDate(x.t)}</div><div class="setlist">${x.sets.map(st => st.warm ? `<span class="w">W ${setStr(st)}</span>` : setStr(st)).join(' &nbsp; ')}</div>
      <div class="mut small">Top ${setStr(x.top)} · e1RM ${fe(x.e1)}</div>${x.note ? `<div class="mut small">📝 ${esc(x.note)}</div>` : ''}</div>`).join('');
  }
  return h;
}
function vPRs() {
  const rows = allKeys().map(k => ({ k, hs: exHistory(k.key) })).filter(x => x.hs.length);
  let h = '<h1>Personal records</h1>';
  if (!rows.length) return h + '<p class="mut">No PRs yet. Log a workout first.</p>';
  h += rows.map(({ k, hs }) => {
    const bw = hs.reduce((a, b) => (b.top.w > a.top.w || (b.top.w === a.top.w && b.top.r > a.top.r)) ? b : a), be = hs.reduce((a, b) => b.e1 > a.e1 ? b : a);
    return `<a class="item" href="#/exercise/${encodeURIComponent(k.key)}"><div class="card"><span class="chev">›</span><div class="t1">${esc(k.name)}</div>
      <div class="kv"><span>Heaviest</span><b>${fw(bw.top.w)} ${U()} × ${bw.top.r} <span class="mut small">${fmtDate(bw.t)}</span></b></div>
      <div class="kv"><span>Est. 1RM</span><b>${fe(be.e1)} ${U()} <span class="mut small">${fmtDate(be.t)}</span></b></div></div></a>`;
  }).join('');
  return h;
}
function vSettings() {
  const S = D.settings;
  return `<h1>Settings</h1>
  <div class="card"><div class="lbl">Units</div><div class="row2" style="margin-top:10px"><button class="btn${S.unit === 'lb' ? ' on' : ''}" data-a="unit" data-u="lb">lb</button><button class="btn${S.unit === 'kg' ? ' on' : ''}" data-a="unit" data-u="kg">kg</button></div></div>
  <div class="card"><div class="lbl">Rest timer</div><div class="cfgstep"><button class="stp" data-a="restlen" data-v="-30">−</button><div class="cfgval" id="restval">${mmss(S.rest)}</div><button class="stp" data-a="restlen" data-v="30">+</button></div><div class="mut small" style="margin-top:6px">Default 3:00. Dean: 3+ minutes between hard sets is best. During rest tap +30s, 3, 4 or 5 min.</div></div>
  <div class="card"><div class="lbl">Default weight increment</div><div class="cfgstep"><button class="stp" data-a="incstep" data-v="-1">−</button><div class="cfgval">${S.unit === 'kg' ? S.incKg : S.incLb} ${S.unit}</div><button class="stp" data-a="incstep" data-v="1">+</button></div>
    <div class="mut small" style="margin-top:6px">Used for the +/− buttons and the "Add weight" suggestion. Set a different one per exercise in Edit templates.</div></div>
  <div class="card"><div class="lbl">Rest alert</div><div class="row2" style="margin-top:10px"><button class="btn${S.vibrate ? ' on' : ''}" data-a="tog" data-k="vibrate">Vibrate ${S.vibrate ? 'ON' : 'OFF'}</button><button class="btn${S.sound ? ' on' : ''}" data-a="tog" data-k="sound">Beep ${S.sound ? 'ON' : 'OFF'}</button></div></div>
  <div class="card"><div class="lbl">Edit workout templates</div><div class="row3" style="margin-top:10px">${DAYS.map(d => `<a class="btn" href="#/tpl/${d}" style="margin:0">Day ${d}</a>`).join('')}</div></div>
  <div class="card"><div class="lbl">Backup</div>
    <div class="mut small" style="margin-top:6px">${D.sessions.length} workouts saved on this phone.${D.lastExport ? ' Last backup ' + fmtDate(D.lastExport) + '.' : ' Not backed up yet.'}</div>
    <button class="btn primary" data-a="export">Export backup (JSON file)</button>
    ${navigator.canShare ? '<button class="btn" data-a="share">Share backup…</button>' : ''}
    <button class="btn" data-a="import">Import backup</button></div>
  ${deferredInstall ? '<button class="btn" data-a="install">Install app on this phone</button>' : ''}
  <div class="card"><div class="lbl">Danger zone</div><button class="btn danger" data-a="erase">Erase all data</button></div>
  <p class="mut small">Strength Tracker v${VERSION} · data stays on this phone · works offline.</p>`;
}
function vTemplate(d) {
  const t = D.templates[d]; if (!t) return '';
  const st = (a, i, v, lbl) => `<div class="cfgstep"><div class="lbl" style="text-align:center">${lbl}</div><button class="stp" data-a="${a}" data-i="${i}" data-v="1">+</button><div class="cfgval">${v}</div><button class="stp" data-a="${a}" data-i="${i}" data-v="-1">−</button></div>`;
  let h = `<a class="btn sm" href="#/settings">‹ Settings</a><h1>Edit Day ${d}</h1>
    <label class="fl">Day name</label><input class="txt" data-c="tdname" data-d="${d}" value="${esc(t.name)}">
    <p class="mut small">Changes apply to the next workout you start. History is matched by exercise name.</p>`;
  h += t.exercises.map((e, i) => `<div class="card tplex"><div class="lbl">#${i + 1}</div>
    <label class="fl">Exercise name</label><input class="txt" data-c="tname" data-d="${d}" data-i="${i}" value="${esc(e.name)}">
    <div class="mini" style="margin-top:12px">${st('tsets', i, e.sets, 'Sets')}${st('tmin', i, e.repMin, 'Min reps')}${st('tmax', i, e.repMax, 'Max reps')}</div>
    <label class="fl">Weight increment (${U()}) — blank = default ${stepDisp(null)}</label><input class="txt" inputmode="decimal" data-c="tinc" data-d="${d}" data-i="${i}" value="${e.inc != null ? fw(e.inc) : ''}">
    <label class="fl">Cue / note</label><input class="txt" data-c="tcue" data-d="${d}" data-i="${i}" value="${esc(e.cue)}">
    <label class="fl">Muscle group (weekly sets)</label><select class="txt" data-c="tmus" data-d="${d}" data-i="${i}">${MUSCLES.map(m => `<option${m === e.muscle ? ' selected' : ''}>${m}</option>`).join('')}</select>
    <div class="row2" style="margin-top:10px"><button class="btn${e.multi ? ' on' : ''}" data-a="tflag" data-k="multi" data-i="${i}">Multi-joint ${e.multi ? 'ON' : 'OFF'}</button><button class="btn${e.uni ? ' on' : ''}" data-a="tflag" data-k="uni" data-i="${i}">Unilateral ${e.uni ? 'ON' : 'OFF'}</button></div>
    <div class="row"><button class="btn" data-a="tup" data-i="${i}" ${i === 0 ? 'disabled' : ''}>▲ Up</button><button class="btn" data-a="tdn" data-i="${i}" ${i === t.exercises.length - 1 ? 'disabled' : ''}>▼ Down</button><button class="btn danger" data-a="trm" data-i="${i}">Remove</button></div></div>`).join('');
  h += `<button class="btn primary" data-a="tadd">+ Add exercise</button><button class="btn danger" data-a="treset">Reset Day ${d} to program default</button><a class="btn" href="#/settings">Done</a>`;
  return h;
}

/* ---------- router ---------- */
let tplDay = 'A';
function render() {
  const [p, a] = (location.hash.replace(/^#\/?/, '') || 'home').split('/');
  const arg = a ? decodeURIComponent(a) : '';
  const V = { home: vHome, workout: vWorkout, summary: () => vSummary(arg), history: vHistory, session: () => vSession(arg), exercise: () => vExercise(arg), prs: vPRs, settings: vSettings, tpl: () => { tplDay = arg; return vTemplate(arg); } };
  const page = V[p] ? p : 'home';
  const y = window.__keepScroll ? window.scrollY : 0;
  $('#view').innerHTML = V[page]();
  window.scrollTo(0, window.__keepScroll ? y : 0); window.__keepScroll = false;
  const inW = page === 'workout' && D.active;
  $('#tabs').hidden = !!inW; $('#wnav').hidden = !inW;
  if (inW) { $('#wprev').disabled = D.active.cur === 0; $('#wnext').textContent = D.active.cur >= D.active.exercises.length - 1 ? 'Finish ✓' : 'Next ›'; wake(); }
  const tabOf = { home: 'home', summary: 'home', history: 'history', session: 'history', exercise: 'history', prs: 'prs', settings: 'settings', tpl: 'settings' };
  document.querySelectorAll('#tabs a').forEach(el => el.classList.toggle('cur', el.dataset.tab === tabOf[page]));
  tick();
}
const rerender = () => { window.__keepScroll = true; render(); };
window.addEventListener('hashchange', render);

/* ---------- actions ---------- */
function setAt(j) { return curEx().sets[+j]; }
// changing a working set's weight carries it to later, not-yet-done working sets that still had the old weight
function setW(j, nw) { const e = curEx(), s = e.sets[+j], old = s.w; s.w = nw;
  if (!s.warm) e.sets.slice(+j + 1).forEach(x => { if (!x.warm && !x.done && Math.abs(x.w - old) < 1e-6) x.w = nw; }); }
const ACT = {
  start: ds => startWorkout(ds.d),
  resume: () => go('#/workout'),
  discard: () => { if (confirm('Discard the workout in progress? Nothing from it will be saved.')) { D.active = null; save(); releaseWake(); render(); } },
  home: () => go('#/home'),
  finish: () => finishWorkout(),
  prev: () => { D.active.cur--; save(); render(); },
  next: () => { if (D.active.cur >= D.active.exercises.length - 1) return finishWorkout(); D.active.cur++; save(); render(); },
  jump: ds => { D.active.cur = +ds.i; save(); render(); },
  'w+': ds => { const s = setAt(ds.j); setW(ds.j, fromDisp(r2(disp(s.w) + stepDisp(curEx())))); save(); rerender(); },
  'w-': ds => { const s = setAt(ds.j); setW(ds.j, Math.max(0, fromDisp(r2(disp(s.w) - stepDisp(curEx()))))); save(); rerender(); },
  'r+': ds => { const s = setAt(ds.j); s.r = s.r + 1; save(); rerender(); },
  'r-': ds => { const s = setAt(ds.j); s.r = Math.max(0, s.r - 1); save(); rerender(); },
  done: ds => {
    primeAudio(); const e = curEx(), s = e.sets[+ds.j]; s.done = true; s.t = Date.now();
    if (!s.warm) startRest(); // warm-ups skip the rest timer
    save(); rerender();
  },
  undo: ds => { setAt(ds.j).done = false; save(); rerender(); },
  rir: ds => { setAt(ds.j).rir = +ds.v; save(); rerender(); },
  sugwarm: () => { const e = curEx(), w = working(e)[0]; if (!w || !w.w) { toast('Set the working weight first'); return; }
    const kept = e.sets.filter(s => !s.warm || s.done); const nd = kept.filter(s => s.warm).length;
    kept.splice(nd, 0, ...warmupsFor(w.w, e)); e.sets = kept; save(); rerender(); toast('Warm-ups: ~50%, 70%, 85% of ' + fw(w.w) + ' ' + U()); },
  addwarm: () => { const e = curEx(), first = working(e)[0]; const nw = e.sets.filter(s => s.warm).length;
    e.sets.splice(nw, 0, { w: first ? fromDisp(r2(disp(first.w) * 0.5)) : 0, r: 8, done: false, warm: true }); save(); rerender(); },
  addset: () => { const e = curEx(), ws = working(e), l = ws[ws.length - 1] || { w: 0, r: 8 }; e.sets.push({ w: l.w, r: l.r, rir: 1, done: false }); save(); rerender(); },
  rmlast: () => { const e = curEx(); for (let k = e.sets.length - 1; k >= 0; k--) if (!e.sets[k].warm && !e.sets[k].done) { e.sets.splice(k, 1); break; } save(); rerender(); },
  rmset: ds => { curEx().sets.splice(+ds.j, 1); save(); rerender(); },
  restset: ds => { const A = D.active; if (A && A.restEnd) { A.restStart = A.restStart || Date.now(); A.restEnd = A.restStart + (+ds.m) * 60000; A.restAlerted = A.restEnd <= Date.now(); save(); tick(); } },
  'rest+': () => { if (D.active && D.active.restEnd) { D.active.restEnd = Math.max(D.active.restEnd, Date.now()) + 30000; D.active.restAlerted = false; save(); tick(); } },
  restskip: () => { if (D.active) { D.active.restEnd = null; save(); tick(); } },
  htab: ds => { histTab = ds.t; render(); },
  wk: ds => { weekOff = Math.min(0, weekOff + (+ds.v)); rerender(); },
  delsess: ds => { if (confirm('Delete this workout from history? This cannot be undone.')) { D.sessions = D.sessions.filter(s => s.id !== ds.id); save(); go('#/history'); } },
  unit: ds => { D.settings.unit = ds.u; save(); rerender(); },
  restlen: ds => { D.settings.rest = clamp(D.settings.rest + (+ds.v), 15, 900); save(); rerender(); },
  incstep: ds => { const S = D.settings; if (S.unit === 'kg') { const o = [0.5, 1, 1.25, 2, 2.5, 5]; S.incKg = o[clamp(o.indexOf(S.incKg) + (+ds.v), 0, o.length - 1)] || 2.5; } else { const o = [1, 2.5, 5, 10, 15, 20, 25]; S.incLb = o[clamp(o.indexOf(S.incLb) + (+ds.v), 0, o.length - 1)] || 5; } save(); rerender(); },
  tog: ds => { D.settings[ds.k] = !D.settings[ds.k]; save(); rerender(); },
  export: () => exportData(),
  share: () => shareData(),
  import: () => $('#importfile').click(),
  erase: () => { if (confirm('Erase ALL workouts, templates and settings on this phone?') && confirm('Really erase everything? Export a backup first if unsure.')) { D = fresh(); save(); go('#/home'); toast('All data erased'); } },
  install: async () => { if (!deferredInstall) return; deferredInstall.prompt(); try { await deferredInstall.userChoice; } catch (e) { } deferredInstall = null; render(); },
  tup: ds => tplMove(+ds.i, -1), tdn: ds => tplMove(+ds.i, 1),
  trm: ds => { const t = D.templates[tplDay]; if (confirm(`Remove "${t.exercises[+ds.i].name}" from Day ${tplDay}?`)) { t.exercises.splice(+ds.i, 1); save(); rerender(); } },
  tadd: () => { D.templates[tplDay].exercises.push(X('New exercise', { muscle: 'Other' })); save(); render(); window.scrollTo(0, document.body.scrollHeight); },
  treset: () => { if (confirm(`Reset Day ${tplDay} to the original program?`)) { D.templates[tplDay] = defaultDay(tplDay); save(); rerender(); } },
  tflag: ds => { const e = D.templates[tplDay].exercises[+ds.i]; e[ds.k] = !e[ds.k]; save(); rerender(); },
  tsets: ds => tplNum(ds, 'sets', 1, 10), tmin: ds => tplNum(ds, 'repMin', 1, 50), tmax: ds => tplNum(ds, 'repMax', 1, 50),
};
function tplMove(i, dir) { const ex = D.templates[tplDay].exercises, j = i + dir; if (j < 0 || j >= ex.length) return; [ex[i], ex[j]] = [ex[j], ex[i]]; save(); rerender(); }
function tplNum(ds, f, lo, hi) { const e = D.templates[tplDay].exercises[+ds.i]; e[f] = clamp(e[f] + (+ds.v), lo, hi); if (e.repMin > e.repMax) { if (f === 'repMin') e.repMax = e.repMin; else e.repMin = e.repMax; } save(); rerender(); }

document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-a]'); if (!b || b.disabled) return;
  const fn = ACT[b.dataset.a]; if (!fn) return;
  ev.preventDefault(); fn(b.dataset, b);
});
document.addEventListener('focusin', ev => { if (ev.target.classList.contains('num')) setTimeout(() => ev.target.select(), 0); });
document.addEventListener('change', ev => {
  const el = ev.target, c = el.dataset.c; if (!c) return;
  const v = el.value.trim();
  if (c === 'w' || c === 'r') {
    const s = setAt(el.dataset.j), n = parseFloat(v.replace(',', '.'));
    if (!isNaN(n) && n >= 0) { if (c === 'w') setW(el.dataset.j, fromDisp(r2(n))); else s.r = Math.round(n); }
    save(); rerender(); return;
  }
  const t = D.templates[el.dataset.d];
  if (c === 'tdname') t.name = v || 'Day ' + el.dataset.d;
  if (c === 'tname') t.exercises[+el.dataset.i].name = v || 'Exercise';
  if (c === 'tcue') t.exercises[+el.dataset.i].cue = v;
  if (c === 'tmus') t.exercises[+el.dataset.i].muscle = v;
  if (c === 'tinc') { const n = parseFloat(v.replace(',', '.')); t.exercises[+el.dataset.i].inc = v === '' || isNaN(n) || n <= 0 ? null : fromDisp(n); }
  save();
});
document.addEventListener('input', ev => {
  if (ev.target.dataset.c === 'note' && D.active) { curEx().note = ev.target.value; save(); }
});
$('#importfile').addEventListener('change', async ev => {
  const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
  let o; try { o = JSON.parse(await f.text()); } catch (e) { toast('That file is not valid JSON'); return; }
  const d = o && (o.data || o);
  if (!d || !Array.isArray(d.sessions) || !d.templates) { toast('That is not a Strength backup file'); return; }
  if (!confirm(`Replace all data on this phone with this backup (${d.sessions.length} workouts)?`)) return;
  D = migrate(d); save(); toast(`Imported ${D.sessions.length} workouts`); go('#/home');
});

/* ---------- backup ---------- */
function backupBlob() { return new Blob([JSON.stringify({ app: 'strength-tracker', version: 1, exportedAt: new Date().toISOString(), data: D }, null, 2)], { type: 'application/json' }); }
function exportData() {
  D.lastExport = Date.now(); save();
  const a = document.createElement('a'); a.href = URL.createObjectURL(backupBlob()); a.download = `strength-backup-${ymd()}.json`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  toast('Backup saved to Downloads'); rerender();
}
async function shareData() {
  const file = new File([backupBlob()], `strength-backup-${ymd()}.json`, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Strength backup' }); D.lastExport = Date.now(); save(); rerender(); } catch (e) { } }
  else exportData();
}

/* ---------- install + service worker ---------- */
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (/home|settings|^$/.test(location.hash.replace(/^#\/?/, '') || 'home')) render(); });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });

render();
