/* APスクロール — 応用情報 科目A doomscroll learning app (vanilla JS, no build) */
(() => {
'use strict';
const D = window.AP_DATA || { categories: [], concepts: [], terms: [], questions: [], tf: [] };
const EXAM_DATE = new Date(2026, 10, 7); // 2026-11-07 local
const LS_KEY = 'apscroll.v1';
const $ = (s, el = document) => el.querySelector(s);
const feedEl = $('#feed');

/* ---------------- data index ---------------- */
const CATS = D.categories;
const catBy = Object.fromEntries(CATS.map(c => [c.slug, c]));
const MAJOR_NAME = { tech: 'テクノロジ系', mgmt: 'マネジメント系', strat: 'ストラテジ系' };
const ITEMS = {}; // id -> item (with .kind)
const POOL = { concept: {}, quiz: {}, term: {}, tf: {} }; // kind -> cat -> [items]
const addPool = (kind, arr) => {
  for (const it of arr) {
    it.kind = kind; ITEMS[it.id] = it;
    (POOL[kind][it.cat] ??= []).push(it);
  }
};
addPool('concept', D.concepts); addPool('quiz', D.questions); addPool('term', D.terms); addPool('tf', D.tf);
const TOTAL_Q = D.questions.length + D.tf.length;

/* ---------------- state ---------------- */
const defaultState = () => ({
  items: {},            // id -> {s: seen count, ok, ng, box, due, last, bk}
  xp: 0, streak: 0, lastDay: null, days: {}, bestCombo: 0,
  cats: Object.fromEntries(CATS.map(c => [c.slug, true])), solo: null,
  settings: { goal: 30, sound: false, theme: 'dark', fs: 17, ratio: 'mix' },
  exams: [], onboarded: false, created: Date.now()
});
let S = defaultState();
try { const raw = localStorage.getItem(LS_KEY); if (raw) S = Object.assign(defaultState(), JSON.parse(raw)); S.settings = Object.assign(defaultState().settings, S.settings || {}); } catch (e) { /* ignore */ }
for (const c of CATS) if (S.cats[c.slug] === undefined) S.cats[c.slug] = true;
let saveT = null;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {} }, 150); };
const rec = (id) => (S.items[id] ??= { s: 0, ok: 0, ng: 0, box: 0, due: 0, last: 0, bk: false });
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => (S.days[dayKey()] ??= { a: 0, c: 0, r: 0, xp: 0 });

/* ---------------- helpers ---------------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const fmt = (s) => esc(s).replace(/【([^】]+)】/g, '<b>$1</b>');
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const LABELS = ['ア', 'イ', 'ウ', 'エ'];
const daysLeft = () => Math.max(0, Math.ceil((EXAM_DATE - new Date().setHours(0, 0, 0, 0)) / 864e5));
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const enabledCats = () => S.solo ? [S.solo] : CATS.filter(c => S.cats[c.slug]).map(c => c.slug);

let toastT;
function toast(msg, ms = 1800) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, ms); }
function confetti(n = 26) {
  const fx = $('#fx'); const colors = ['#4cc9f0', '#f4b942', '#f472b6', '#3ddc84', '#7c8cff'];
  for (let i = 0; i < n; i++) {
    const p = el(`<i class="p"></i>`); p.style.left = `${40 + rnd(20)}%`; p.style.top = '45%';
    p.style.background = pick(colors); p.style.setProperty('--dx', `${rnd(360) - 180}px`); p.style.setProperty('--dy', `${-rnd(260) - 60}px`);
    fx.appendChild(p); setTimeout(() => p.remove(), 1200);
  }
}
function floatXP(n, x, y) { const f = el(`<div class="xp-float">+${n} XP</div>`); f.style.left = `${x}px`; f.style.top = `${y}px`; document.body.appendChild(f); setTimeout(() => f.remove(), 900); }
let audio;
function beep(ok) {
  if (!S.settings.sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain(); o.connect(g); g.connect(audio.destination);
    o.frequency.value = ok ? 880 : 220; o.type = ok ? 'sine' : 'square'; g.gain.value = .06;
    o.start(); o.frequency.exponentialRampToValueAtTime(ok ? 1320 : 160, audio.currentTime + .12); g.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .18); o.stop(audio.currentTime + .2);
  } catch (e) {}
}

/* ---------------- gamification ---------------- */
let combo = 0;
const LEVELS = ['見習い', 'ビギナー', '受験生', 'チャレンジャー', '実力者', '合格圏', '応用マスター', 'AP賢者', 'レジェンド'];
const level = (xp = S.xp) => Math.floor(Math.sqrt(xp / 60));
const levelTitle = (lv) => LEVELS[Math.min(lv, LEVELS.length - 1)] + (lv >= LEVELS.length ? ` Lv.${lv}` : '');
function addXP(n, evt) {
  const before = level(); S.xp += n; today().xp += n;
  if (evt) floatXP(n, evt.clientX - 20, evt.clientY - 30);
  if (level() > before) { confetti(40); toast(`レベルアップ！ ${levelTitle(level())}`, 2600); }
  touchStreak(); hud(); save();
}
function touchStreak() {
  const k = dayKey();
  if (S.lastDay === k) return;
  const y = dayKey(new Date(Date.now() - 864e5));
  S.streak = (S.lastDay === y) ? S.streak + 1 : 1; S.lastDay = k;
}
function setCombo(ok) {
  combo = ok ? combo + 1 : 0; S.bestCombo = Math.max(S.bestCombo, combo);
  const c = $('#combo'); if (combo >= 3) { c.textContent = `${combo} COMBO`; c.hidden = false; c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; } else c.hidden = true;
}
function hud() {
  $('#streak-txt').textContent = S.streak; $('#xp-txt').textContent = S.xp;
  const t = today(); const goal = S.settings.goal; const pct = Math.min(1, t.a / goal);
  $('.ring-fg').style.strokeDashoffset = 97.4 * (1 - pct); $('#goal-txt').textContent = t.a >= goal ? '✓' : t.a;
  const dl = daysLeft(); $('#hud-count').textContent = dl === 0 ? '本番' : `D-${dl}`;
}

/* ---------------- SRS ---------------- */
const INTERVALS = [10 * 60e3, 864e5, 3 * 864e5, 7 * 864e5, 21 * 864e5];
function markSeen(id) { const r = rec(id); r.s++; r.last = Date.now(); save(); }
function answer(id, ok) {
  const r = rec(id); r.s++; r.last = Date.now();
  if (ok) { r.ok++; r.box = Math.min(r.box + 1, INTERVALS.length - 1); r.due = Date.now() + INTERVALS[r.box]; }
  else { r.ng++; r.box = 0; r.due = Date.now() + 5 * 60e3; }
  const t = today(); t.a++; if (ok) t.c++;
  save();
}
const dueItems = () => Object.entries(S.items).filter(([id, r]) => r.due && r.due <= Date.now() && ITEMS[id] && (ITEMS[id].kind === 'quiz' || ITEMS[id].kind === 'tf') && enabledCats().includes(ITEMS[id].cat)).map(([id]) => ITEMS[id]);
const weakScore = (slug) => { // 0..1 higher = weaker
  let ok = 0, ng = 0; for (const [id, r] of Object.entries(S.items)) if (ITEMS[id]?.cat === slug) { ok += r.ok; ng += r.ng; }
  return ok + ng < 3 ? .35 : ng / (ok + ng);
};

/* ---------------- feed engine ---------------- */
const recent = []; const remember = (id) => { recent.push(id); if (recent.length > 60) recent.shift(); };
const PATTERN = { mix: ['concept', 'quiz', 'term', 'quiz', 'tf', 'concept', 'quiz', 'quiz', 'term', 'concept', 'quiz', 'tf'], quiz: ['quiz', 'quiz', 'tf', 'quiz', 'quiz', 'term'], learn: ['concept', 'concept', 'term', 'quiz', 'concept', 'term', 'tf'] };
let patIdx = 0; let cardsSinceMilestone = 0; let answeredThisSession = 0; let lastMilestone = 0;
let mode = { type: 'feed' }; // {type:'feed'} | {type:'exam', ...} | {type:'list', items:[]}

function chooseCat(kind) {
  const cats = enabledCats().filter(s => (POOL[kind][s] || []).length);
  if (!cats.length) return null;
  const w = cats.map(s => catBy[s].weight * (0.6 + weakScore(s) * 1.6));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cats.length; i++) { r -= w[i]; if (r <= 0) return cats[i]; }
  return cats[cats.length - 1];
}
function chooseItem(kind, cat) {
  const pool = (POOL[kind][cat] || []).filter(it => !recent.includes(it.id));
  if (!pool.length) return null;
  const unseen = pool.filter(it => !S.items[it.id]?.s);
  if (unseen.length && Math.random() < 0.8) return pick(unseen);
  // least recently seen, tie-break by weakness
  return pool.sort((a, b) => (S.items[a.id]?.last || 0) - (S.items[b.id]?.last || 0)).slice(0, Math.max(3, pool.length >> 2))[rnd(Math.min(3, pool.length))];
}
function nextCards() {
  const out = [];
  // milestone / summary cards
  if (cardsSinceMilestone >= 12 && answeredThisSession >= lastMilestone + 10) { cardsSinceMilestone = 0; lastMilestone = answeredThisSession; out.push({ kind: 'system', type: 'milestone' }); }
  // SRS due
  const due = dueItems().filter(it => !recent.includes(it.id));
  if (due.length && Math.random() < Math.min(.6, .2 + due.length * .05)) { const it = pick(due); out.push(Object.assign({ due: true }, it, { _it: it })); remember(it.id); return out; }
  const pat = PATTERN[S.settings.ratio] || PATTERN.mix;
  let kind = pat[patIdx++ % pat.length];
  let cat = chooseCat(kind); if (!cat) { for (const k of ['quiz', 'concept', 'term', 'tf']) { cat = chooseCat(k); if (cat) { kind = k; break; } } }
  if (!cat) return out;
  const it = chooseItem(kind, cat); if (!it) return out;
  if (kind === 'quiz' && it.concept && ITEMS[it.concept] && !S.items[it.concept]?.s && !recent.includes(it.concept) && Math.random() < .7) { out.push(ITEMS[it.concept]); remember(it.concept); }
  out.push(it); remember(it.id);
  return out;
}

/* ---------------- rendering ---------------- */
let seq = 0;
function catChip(it) { const c = catBy[it.cat]; return `<span class="chip">${esc(c?.short || it.cat)}</span>${it.sub ? `<span class="sub">${esc(it.sub)}</span>` : ''}`; }
function wrap(it, inner, extra = '') {
  const c = catBy[it.cat]; const kind = it.kind || 'system';
  return el(`<article class="card" data-kind="${kind}" data-major="${c?.major || ''}" data-id="${esc(it.id || '')}" ${extra}><div class="card-inner">${inner}</div></article>`);
}
const nextBtn = (label = '次へ ↓') => `<button class="btn primary act-next">${label}</button>`;
const bkBtn = (id) => `<button class="btn ghost act-bk ${S.items[id]?.bk ? 'on' : ''}" title="ブックマーク">${S.items[id]?.bk ? '★' : '☆'}</button>`;

function renderConcept(it) {
  return wrap(it, `
    <div class="meta">${catChip(it)}<span class="kind">解説 ${String(++seq).padStart(3, '0')}</span></div>
    <h1 class="title">${fmt(it.title)}</h1>
    <p class="body">${fmt(it.body)}</p>
    ${it.formula ? `<div class="formula">${fmt(it.formula)}</div>` : ''}
    ${it.points?.length ? `<ul class="points">${it.points.map(p => `<li>${fmt(p)}</li>`).join('')}</ul>` : ''}
    ${it.tip ? `<div class="tip">${fmt(it.tip)}</div>` : ''}
    <div class="actions">${bkBtn(it.id)}<button class="btn act-quiz" data-concept="${esc(it.id)}">この論点の問題</button>${nextBtn('理解した ↓')}</div>`);
}
function renderQuiz(it, exam) {
  const n = exam ? `${exam.idx + 1}/${exam.qs.length}` : String(++seq).padStart(3, '0');
  return wrap(it, `
    <div class="meta">${catChip(it)}${it.due ? '<span class="due-tag">復習</span>' : ''}<span class="kind">${exam ? '模試 ' : 'Q '}${n}</span></div>
    <p class="q">${fmt(it.q)}</p>
    <div class="choices">${it.choices.map((c, i) => `<button class="choice" data-i="${i}"><span class="lbl">${LABELS[i]}</span><span>${fmt(c)}</span></button>`).join('')}</div>
    <div class="result"></div>
    <div class="actions">${exam ? '' : bkBtn(it.id)}${exam ? nextBtn(exam.idx + 1 === exam.qs.length ? '採点する' : '次へ ↓') : nextBtn()}</div>`, exam ? 'data-exam="1"' : '');
}
function renderTF(it) {
  return wrap(it, `
    <div class="meta">${catChip(it)}${it.due ? '<span class="due-tag">復習</span>' : ''}<span class="kind">○× ${String(++seq).padStart(3, '0')}</span></div>
    <p class="q">${fmt(it.s)}</p>
    <div class="tf-btns"><button class="tf-btn" data-v="true">○</button><button class="tf-btn" data-v="false">×</button></div>
    <div class="result"></div>
    <div class="actions">${bkBtn(it.id)}${nextBtn()}</div>`);
}
function renderTerm(it) {
  return wrap(it, `
    <div class="meta">${catChip(it)}<span class="kind">用語 ${String(++seq).padStart(3, '0')}</span></div>
    <div class="term-box act-flip"><div class="term">${fmt(it.term)}</div><div class="term-hint">タップして意味を表示</div></div>
    <div class="actions">${bkBtn(it.id)}${nextBtn()}</div>`);
}
function renderSystem(it) {
  let inner = '';
  if (it.type === 'welcome') {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    inner = `<div class="sys"><div class="big">📱</div><h1>APスクロール</h1><p>応用情報 科目A を、SNSみたいに流し見で覚える。\n上にスワイプで次のカード。問題は選択肢をタップ。</p>
      <div class="numbers"><div><b>${D.concepts.length}</b><span>解説カード</span></div><div><b>${TOTAL_Q}</b><span>問題</span></div><div><b>${daysLeft()}</b><span>試験まで(日)</span></div></div>
      <p>出題比率は本試験（テクノロジ50／マネジメント10／ストラテジ20）に合わせ、間違えた問題は自動で再出題されます。</p>
      ${!standalone && ios ? `<div class="hint">📌 <b>ホーム画面に追加</b>すると全画面アプリになります：Safariの共有ボタン（□↑）→「ホーム画面に追加」</div>` : ''}
      <div class="actions">${nextBtn('はじめる ↓')}</div></div>`;
  } else if (it.type === 'milestone') {
    const t = today(); const acc = t.a ? Math.round(t.c / t.a * 100) : 0;
    const msgs = ['いい調子。脳に刻まれてる。', 'スクロールの手が止まらない。', '本番でもこのテンポで。', '間違えた問題はあとで戻ってくる。', 'セキュリティは11問出る。油断しない。'];
    inner = `<div class="sys"><div class="big">${acc >= 80 ? '🔥' : acc >= 60 ? '💪' : '🧠'}</div><h1>今日 ${t.a} 問</h1><p>${pick(msgs)}</p>
      <div class="numbers"><div><b>${acc}%</b><span>今日の正答率</span></div><div><b>${S.streak}</b><span>連続日数</span></div><div><b>${levelTitle(level())}</b><span>Lv.${level()}</span></div></div>
      ${t.a >= S.settings.goal ? `<p>🎯 今日の目標 ${S.settings.goal}問 達成！</p>` : `<p>目標まであと ${S.settings.goal - t.a} 問</p>`}
      <div class="actions"><button class="btn act-open-stats">記録を見る</button>${nextBtn('続ける ↓')}</div></div>`;
  } else if (it.type === 'empty') {
    inner = `<div class="sys"><div class="big">🫥</div><h1>カードがありません</h1><p>分野タブで出題する分野を1つ以上オンにしてください。</p><div class="actions"><button class="btn primary act-open-cats">分野を選ぶ</button></div></div>`;
  } else if (it.type === 'exam-start') {
    inner = `<div class="sys"><div class="big">⏱</div><h1>模擬試験 ${it.n}問</h1><p>本番と同じ配分・形式。制限時間 ${Math.round(it.n * 1.875)} 分。\n解答中は正誤を表示しません。最後に採点します。</p><div class="actions"><button class="btn act-exam-cancel">やめる</button>${nextBtn('開始 ↓')}</div></div>`;
  } else if (it.type === 'exam-result') {
    const ex = it.exam; const n = ex.qs.length; const correct = ex.qs.filter((q, i) => ex.answers[i] === q.answer).length; const pct = Math.round(correct / n * 100);
    const bym = {}; ex.qs.forEach((q, i) => { const m = catBy[q.cat].major; bym[m] ??= { a: 0, c: 0 }; bym[m].a++; if (ex.answers[i] === q.answer) bym[m].c++; });
    const mins = Math.round((ex.end - ex.start) / 60e3);
    inner = `<div class="sys"><div class="big">${pct >= 60 ? '🎉' : '😤'}</div><div class="score">${pct}<small>%</small></div><h1>${pct >= 60 ? '合格ライン突破' : '合格ラインまであと' + (Math.ceil(n * .6) - correct) + '問'}</h1><p>${correct}/${n} 正解 ・ ${mins}分</p>
      <div class="result-cats">${Object.entries(bym).map(([m, v]) => `<div class="row" data-major="${m}"><div class="grow"><div class="name">${MAJOR_NAME[m]}</div><div class="bar"><i style="width:${Math.round(v.c / v.a * 100)}%"></i></div></div><span>${v.c}/${v.a}</span></div>`).join('')}</div>
      <div class="actions">${correct < n ? '<button class="btn act-exam-review">間違えた問題を復習</button>' : ''}<button class="btn primary act-exam-end">フィードに戻る</button></div></div>`;
  } else if (it.type === 'list-end') {
    inner = `<div class="sys"><div class="big">✅</div><h1>おしまい</h1><p>${esc(it.msg || '')}</p><div class="actions"><button class="btn primary act-exam-end">フィードに戻る</button></div></div>`;
  }
  return wrap({ id: `sys-${Date.now()}-${rnd(1e4)}`, kind: 'system' }, inner);
}
function render(it) {
  if (it.kind === 'system') return renderSystem(it);
  if (it.kind === 'concept') return renderConcept(it);
  if (it.kind === 'quiz') return renderQuiz(it, it._exam);
  if (it.kind === 'tf') return renderTF(it);
  if (it.kind === 'term') return renderTerm(it);
  return renderSystem({ type: 'empty' });
}

/* ---------------- feed management ---------------- */
const cardItem = new WeakMap();
function append(it) { const node = render(it); cardItem.set(node, it); feedEl.appendChild(node); return node; }
function fill(min = 6) {
  if (mode.type !== 'feed') return;
  const cur = currentIndex(); let guard = 0;
  while (feedEl.children.length - cur < min && guard++ < 20) {
    const items = nextCards(); if (!items.length) { if (!feedEl.querySelector('[data-kind="system"]:last-child')) append({ kind: 'system', type: 'empty' }); break; }
    for (const it of items) { append(it); cardsSinceMilestone++; }
  }
}
let pruneT = null;
function pruneLater() { clearTimeout(pruneT); pruneT = setTimeout(() => { while (feedEl.children.length > 60 && currentIndex() > 20) { const h = feedEl.firstElementChild.offsetHeight; feedEl.firstElementChild.remove(); feedEl.scrollTop -= h; lastIdx--; } }, 400); }
function currentIndex() { const h = feedEl.clientHeight || 1; return Math.round(feedEl.scrollTop / h); }
function scrollNext() { const h = feedEl.clientHeight; feedEl.scrollTo({ top: (currentIndex() + 1) * h, behavior: 'smooth' }); }
function resetFeed(items) {
  feedEl.innerHTML = ''; feedEl.scrollTop = 0; seq = 0; cardsSinceMilestone = 0;
  if (items) for (const it of items) append(it);
}
function startFeed() { mode = { type: 'feed' }; resetFeed(); if (!S.onboarded) { append({ kind: 'system', type: 'welcome' }); } fill(8); setTab('feed'); }

let lastIdx = -1, seenT = null;
feedEl.addEventListener('scroll', () => {
  const i = currentIndex(); if (i === lastIdx) return; lastIdx = i;
  const node = feedEl.children[i]; const it = node && cardItem.get(node);
  clearTimeout(seenT);
  if (it && (it.kind === 'concept' || it.kind === 'term')) seenT = setTimeout(() => { if (!S.items[it.id]?.s) { markSeen(it.id); addXP(it.kind === 'concept' ? 3 : 1); } }, 1500);
  if (it?.type === 'welcome') { /* nothing */ } else if (!S.onboarded) { S.onboarded = true; save(); }
  if (mode.type === 'feed') { fill(6); pruneLater(); }
}, { passive: true });

/* ---------------- interactions ---------------- */
feedEl.addEventListener('click', (e) => {
  const card = e.target.closest('.card'); if (!card) return; const it = cardItem.get(card); if (!it) return;
  const choice = e.target.closest('.choice');
  if (choice && it.kind === 'quiz') return onChoice(card, it, +choice.dataset.i, e);
  const tfb = e.target.closest('.tf-btn');
  if (tfb && it.kind === 'tf') return onTF(card, it, tfb.dataset.v === 'true', e);
  if (e.target.closest('.act-flip') && it.kind === 'term') return onFlip(card, it);
  const termAct = e.target.closest('.act-term'); if (termAct) return onTermRate(card, it, termAct.dataset.v === '1', e);
  if (e.target.closest('.act-next')) {
    if (it._exam) { return examNext(card, it); }
    if (it.type === 'welcome') { S.onboarded = true; save(); }
    if (it.kind === 'concept' && !S.items[it.id]?.s) { markSeen(it.id); addXP(3, e); }
    return scrollNext();
  }
  if (e.target.closest('.act-bk')) { const r = rec(it.id); r.bk = !r.bk; save(); const b = e.target.closest('.act-bk'); b.classList.toggle('on', r.bk); b.textContent = r.bk ? '★' : '☆'; toast(r.bk ? 'ブックマークに追加' : 'ブックマーク解除'); return; }
  if (e.target.closest('.act-quiz')) { const cid = e.target.closest('.act-quiz').dataset.concept; const qs = D.questions.filter(q => q.concept === cid && !recent.includes(q.id)); const q = qs.length ? pick(qs) : pick(POOL.quiz[it.cat] || []); if (!q) return toast('この論点の問題はまだありません'); insertAfter(card, q); remember(q.id); return scrollNext(); }
  if (e.target.closest('.act-open-stats')) return openSheet('stats');
  if (e.target.closest('.act-open-cats')) return openSheet('cats');
  if (e.target.closest('.act-exam-cancel') || e.target.closest('.act-exam-end')) return startFeed();
  if (e.target.closest('.act-exam-review')) return examReview(it.exam);
});
function insertAfter(card, it) { const node = render(it); cardItem.set(node, it); card.after(node); }

function verdictHTML(ok, xp, text) { return `<div class="verdict ${ok ? 'ok' : 'ng'}">${ok ? '正解！' : '不正解'}${ok && combo >= 3 ? ` <small>×${combo}</small>` : ''}<span class="xp">+${xp} XP</span></div><div class="explain">${fmt(text)}</div>`; }
function onChoice(card, it, i, e) {
  const box = card.querySelector('.choices'); if (box.classList.contains('done')) return; box.classList.add('done');
  if (it._exam) { box.querySelectorAll('.choice').forEach(c => c.classList.remove('picked')); box.children[i].classList.add('picked'); it._exam.answers[it._exam.idx] = i; box.classList.remove('done'); setTimeout(() => examNext(card, it), 350); return; }
  const ok = i === it.answer; box.children[it.answer].classList.add('correct'); if (!ok) { box.children[i].classList.add('wrong'); card.querySelector('.card-inner').classList.add('shake'); }
  setCombo(ok); beep(ok); answer(it.id, ok); answeredThisSession++;
  const xp = ok ? 10 + Math.min(10, combo * 2) * (it.difficulty || 1) : 2; addXP(xp, e);
  let extra = ''; if (!ok && it.concept && ITEMS[it.concept]) extra = `<div class="actions" style="margin-top:0;padding-top:0"><button class="btn sm act-quiz-concept" data-c="${esc(it.concept)}">📖 関連解説を読む</button></div>`;
  card.querySelector('.result').innerHTML = verdictHTML(ok, xp, it.explanation) + extra;
  if (!ok) { const c = ITEMS[it.concept]; card.querySelector('.act-quiz-concept')?.addEventListener('click', () => { insertAfter(card, c); scrollNext(); }); }
  if (ok && combo > 0 && combo % 5 === 0) confetti(20);
  afterAnswer();
}
function onTF(card, it, v, e) {
  const box = card.querySelector('.tf-btns'); if (box.classList.contains('done')) return; box.classList.add('done');
  const ok = v === it.answer; box.querySelector(`[data-v="${it.answer}"]`).classList.add('correct'); if (!ok) { box.querySelector(`[data-v="${v}"]`).classList.add('wrong'); card.querySelector('.card-inner').classList.add('shake'); }
  setCombo(ok); beep(ok); answer(it.id, ok); answeredThisSession++;
  const xp = ok ? 5 + Math.min(5, combo) : 1; addXP(xp, e);
  card.querySelector('.result').innerHTML = verdictHTML(ok, xp, it.explanation);
  afterAnswer();
}
function onFlip(card, it) {
  const box = card.querySelector('.term-box'); if (box.dataset.open) return; box.dataset.open = '1';
  box.querySelector('.term-hint').remove();
  box.insertAdjacentHTML('beforeend', `<div class="term-def">${fmt(it.def)}</div><div class="term-actions"><button class="btn act-term" data-v="0">知らなかった</button><button class="btn primary act-term" data-v="1">知ってた</button></div>`);
}
function onTermRate(card, it, knew, e) {
  card.querySelectorAll('.act-term').forEach(b => b.disabled = true);
  const r = rec(it.id); r.s++; r.last = Date.now(); if (knew) { r.ok++; r.box = Math.min(r.box + 1, 4); r.due = Date.now() + INTERVALS[r.box]; } else { r.ng++; r.box = 0; r.due = Date.now() + 10 * 60e3; }
  save(); addXP(knew ? 3 : 1, e); scrollNext();
}
function afterAnswer() {
  const t = today(); if (t.a === S.settings.goal) { confetti(50); toast(`🎯 今日の目標 ${S.settings.goal}問 達成！`, 2600); }
  hud();
}

/* ---------------- exam ---------------- */
function buildExam(n) {
  const cats = enabledCats(); const totalW = cats.reduce((a, s) => a + catBy[s].weight, 0);
  const qs = []; const quota = cats.map(s => ({ s, q: Math.round(n * catBy[s].weight / totalW) }));
  for (const { s, q } of quota) { const pool = shuffle([...(POOL.quiz[s] || [])]); qs.push(...pool.slice(0, q)); }
  while (qs.length > n) qs.pop();
  let guard = 0;
  while (qs.length < n && guard++ < 500) { const s = chooseCat('quiz') || pick(cats); const pool = (POOL.quiz[s] || []).filter(q => !qs.includes(q)); if (!pool.length) continue; qs.push(pick(pool)); }
  return shuffle(qs);
}
let examTimer = null;
function startExam(n) {
  const qs = buildExam(n); if (qs.length < 5) return toast('問題が足りません。分野を増やしてください');
  const exam = { qs, answers: new Array(qs.length).fill(null), idx: 0, start: Date.now(), end: null, limit: Math.round(qs.length * 1.875) * 60e3 };
  mode = { type: 'exam', exam };
  resetFeed([{ kind: 'system', type: 'exam-start', n: qs.length }]);
  const q0 = Object.assign({}, qs[0], { _exam: Object.assign(exam, { idx: 0 }) }); append(q0);
  closeSheet(); setTab('exam');
  clearInterval(examTimer); examTimer = setInterval(() => {
    const left = exam.limit - (Date.now() - exam.start); const m = Math.max(0, Math.floor(left / 60e3)), s = Math.max(0, Math.floor(left / 1e3) % 60);
    $('#hud-count').innerHTML = `<span class="exam-timer">${m}:${String(s).padStart(2, '0')}</span>`;
    if (left <= 0) { clearInterval(examTimer); finishExam(exam); }
  }, 500);
}
function examNext(card, it) {
  const exam = it._exam; if (exam.idx + 1 >= exam.qs.length) return finishExam(exam);
  exam.idx++; const q = Object.assign({}, exam.qs[exam.idx], { _exam: exam }); insertAfter(card, q); scrollNext();
}
function finishExam(exam) {
  clearInterval(examTimer); exam.end = Date.now();
  const correct = exam.qs.filter((q, i) => exam.answers[i] === q.answer).length;
  exam.qs.forEach((q, i) => { if (exam.answers[i] !== null) answer(q.id, exam.answers[i] === q.answer); });
  S.exams.push({ t: exam.end, n: exam.qs.length, c: correct }); addXP(correct * 8 + (correct / exam.qs.length >= .6 ? 100 : 0)); save();
  if (correct / exam.qs.length >= .6) confetti(60);
  const node = append({ kind: 'system', type: 'exam-result', exam }); node.scrollIntoView({ behavior: 'smooth' }); hud();
}
function examReview(exam) {
  const wrong = exam.qs.filter((q, i) => exam.answers[i] !== q.answer).map(q => Object.assign({}, q));
  startList(wrong, '間違えた問題はすべて復習しました。');
}
function startList(items, msg) {
  mode = { type: 'list' }; resetFeed(items.map(it => Object.assign({}, ITEMS[it.id] || it))); append({ kind: 'system', type: 'list-end', msg }); closeSheet(); setTab('feed'); hud();
}

/* ---------------- sheets / tabs ---------------- */
const sheet = $('#sheet'); let openPanel = null;
function setTab(name) { document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name)); }
function closeSheet() { sheet.hidden = true; openPanel = null; if (mode.type !== 'exam') setTab('feed'); else setTab('exam'); }
function openSheet(name) {
  if (openPanel === name) return closeSheet();
  openPanel = name; sheet.hidden = false; setTab(name === 'settings' ? 'feed' : name);
  const body = $('#sheet-body'); body.scrollTop = 0;
  const titles = { cats: '分野', exam: '模擬試験', stats: '記録', settings: '設定' };
  $('#sheet-title').textContent = titles[name];
  body.innerHTML = ''; ({ cats: panelCats, exam: panelExam, stats: panelStats, settings: panelSettings })[name](body);
}
$('#sheet-close').addEventListener('click', closeSheet);
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => { const t = b.dataset.tab; if (t === 'feed') { closeSheet(); if (mode.type !== 'feed') startFeed(); } else openSheet(t); }));
$('#btn-settings').addEventListener('click', () => openSheet('settings'));
$('#hud-goal').addEventListener('click', () => openSheet('stats'));

function catProgress(slug) {
  const cs = POOL.concept[slug] || [], qs = [...(POOL.quiz[slug] || []), ...(POOL.tf[slug] || [])];
  const seen = cs.filter(c => S.items[c.id]?.s).length; let ok = 0, ng = 0; for (const q of qs) { const r = S.items[q.id]; if (r) { ok += r.ok; ng += r.ng; } }
  const tried = qs.filter(q => S.items[q.id]?.s).length;
  return { seen, total: cs.length, ok, ng, tried, qtotal: qs.length, acc: ok + ng ? Math.round(ok / (ok + ng) * 100) : null };
}
function panelCats(body) {
  body.innerHTML = `<p>オンにした分野だけフィードに流れます。「この分野だけ」で集中モード。出題目安は本試験80問中の概数です。</p>
    ${S.solo ? `<button class="btn on" id="solo-off">🎯 「${esc(catBy[S.solo].name)}」だけ流し中 — 解除</button>` : ''}`;
  for (const m of ['tech', 'mgmt', 'strat']) {
    const cats = CATS.filter(c => c.major === m);
    const head = el(`<div class="major-head"><h3>${MAJOR_NAME[m]}</h3><button class="pill act-major" data-m="${m}">全部切替</button></div>`); body.appendChild(head);
    for (const c of cats) {
      const p = catProgress(c.slug);
      const row = el(`<div class="row" data-major="${m}" data-slug="${c.slug}">
        <div class="grow"><div class="name">${esc(c.name)}</div>
        <div class="meta2"><span class="w">約${c.weight}問</span><span>解説 ${p.seen}/${p.total}</span><span>問題 ${p.tried}/${p.qtotal}</span><span>${p.acc === null ? '正答率 —' : '正答率 ' + p.acc + '%'}</span></div>
        <div class="bar"><i style="width:${p.total ? p.seen / p.total * 100 : 0}%"></i></div></div>
        <button class="pill act-solo ${S.solo === c.slug ? 'on' : ''}">この分野だけ</button>
        <button class="toggle ${S.cats[c.slug] ? 'on' : ''}" aria-label="${esc(c.name)}を出題"></button></div>`);
      body.appendChild(row);
    }
  }
  body.addEventListener('click', (e) => {
    const row = e.target.closest('.row'); const slug = row?.dataset.slug;
    if (e.target.closest('.toggle') && slug) { S.cats[slug] = !S.cats[slug]; e.target.closest('.toggle').classList.toggle('on', S.cats[slug]); save(); return; }
    if (e.target.closest('.act-solo') && slug) { S.solo = slug; save(); closeSheet(); startFeed(); toast(`${catBy[slug].name} だけ流します`); return; }
    if (e.target.id === 'solo-off') { S.solo = null; save(); closeSheet(); startFeed(); return; }
    const mj = e.target.closest('.act-major')?.dataset.m; if (mj) { const cs = CATS.filter(c => c.major === mj); const on = !cs.every(c => S.cats[c.slug]); cs.forEach(c => S.cats[c.slug] = on); save(); openPanel = null; openSheet('cats'); }
  });
}
function panelExam(body) {
  const hist = S.exams.slice(-5).reverse();
  body.innerHTML = `<p>本試験と同じ四肢択一・同じ分野配分で出題。解答中は正誤を表示せず、最後に採点します。合格ラインは60%。</p>
    <h3>問題数</h3><div class="grid3"><button class="btn act-start" data-n="20">20問<br><small>約38分</small></button><button class="btn act-start" data-n="40">40問<br><small>約75分</small></button><button class="btn act-start" data-n="80">80問<br><small>本番 150分</small></button></div>
    <h3>弱点集中</h3><button class="btn" id="weak-start">間違えた問題だけ復習（${Object.entries(S.items).filter(([id, r]) => r.ng > r.ok && ITEMS[id] && (ITEMS[id].kind === 'quiz' || ITEMS[id].kind === 'tf')).length}問）</button>
    <h3>これまでの模試</h3>${hist.length ? hist.map(h => `<div class="list-item"><span class="t">${Math.round(h.c / h.n * 100)}%</span> <span class="s">${h.c}/${h.n}問 ・ ${new Date(h.t).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>`).join('') : '<p>まだ受けていません。</p>'}`;
  body.querySelectorAll('.act-start').forEach(b => b.addEventListener('click', () => startExam(+b.dataset.n)));
  $('#weak-start').addEventListener('click', () => {
    const items = Object.entries(S.items).filter(([id, r]) => r.ng > r.ok && ITEMS[id] && (ITEMS[id].kind === 'quiz' || ITEMS[id].kind === 'tf')).map(([id]) => ITEMS[id]);
    if (!items.length) return toast('間違えた問題がまだありません'); startList(shuffle(items).slice(0, 40), '弱点の復習が終わりました。');
  });
}
function panelStats(body) {
  let a = 0, c = 0; for (const d of Object.values(S.days)) { a += d.a; c += d.c; }
  const seen = D.concepts.filter(x => S.items[x.id]?.s).length;
  const days = []; for (let i = 6; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5); const k = dayKey(d); days.push({ k, d, v: S.days[k]?.a || 0 }); }
  const max = Math.max(1, ...days.map(x => x.v));
  const weak = CATS.map(cat => ({ cat, p: catProgress(cat.slug) })).filter(x => x.p.acc !== null && x.p.ok + x.p.ng >= 3).sort((x, y) => x.p.acc - y.p.acc).slice(0, 5);
  const due = dueItems().length;
  const bks = Object.entries(S.items).filter(([, r]) => r.bk).map(([id]) => ITEMS[id]).filter(Boolean);
  body.innerHTML = `
    <div class="grid2"><div class="stat"><b>${S.xp}</b><span>XP ・ Lv.${level()} ${levelTitle(level())}</span></div><div class="stat"><b>${S.streak}日</b><span>連続学習</span></div>
    <div class="stat"><b>${a ? Math.round(c / a * 100) : 0}%</b><span>通算正答率（${a}問）</span></div><div class="stat"><b>${seen}/${D.concepts.length}</b><span>読んだ解説</span></div></div>
    <h3>この7日間（解答数）</h3><div class="days">${days.map((x, i) => `<div class="${i === 6 ? 'today' : ''}"><i style="height:${Math.max(4, x.v / max * 56)}px"></i>${x.d.getDate()}</div>`).join('')}</div>
    <p>今日: ${today().a}問 ・ 目標 ${S.settings.goal}問 ・ 最大コンボ ${S.bestCombo} ・ 試験まで ${daysLeft()}日</p>
    <h3>復習待ち</h3><button class="btn" id="due-start">${due ? `いま復習すべき ${due} 問を解く` : '復習待ちはありません 👍'}</button>
    <h3>苦手な分野</h3>${weak.length ? weak.map(x => `<div class="row" data-major="${x.cat.major}"><div class="grow"><div class="name">${esc(x.cat.name)}</div><div class="bar"><i class="acc" style="width:${x.p.acc}%"></i></div></div><button class="pill act-solo" data-slug="${x.cat.slug}">${x.p.acc}% → 集中</button></div>`).join('') : '<p>もう少し解くと表示されます。</p>'}
    <h3>ブックマーク（${bks.length}）</h3>${bks.length ? bks.slice(0, 50).map(it => `<button class="list-item act-bk-open" data-id="${esc(it.id)}"><div class="t">${esc(it.title || it.term || (it.q || it.s || '').slice(0, 40))}</div><div class="s">${esc(catBy[it.cat].name)} ・ ${{ concept: '解説', quiz: '問題', term: '用語', tf: '○×' }[it.kind]}</div></button>`).join('') : '<p>カードの ☆ で保存できます。</p>'}`;
  $('#due-start').addEventListener('click', () => { const items = dueItems(); if (!items.length) return; startList(shuffle(items).slice(0, 30), '復習完了。間隔をあけてまた出題します。'); });
  body.querySelectorAll('.act-solo').forEach(b => b.addEventListener('click', () => { S.solo = b.dataset.slug; save(); closeSheet(); startFeed(); }));
  body.querySelectorAll('.act-bk-open').forEach(b => b.addEventListener('click', () => { const items = bks.filter(x => x.id === b.dataset.id).concat(bks.filter(x => x.id !== b.dataset.id)); startList(items, 'ブックマークを一周しました。'); }));
}
function panelSettings(body) {
  const st = S.settings;
  body.innerHTML = `
    <div class="field"><span>1日の目標</span><div class="seg">${[20, 30, 50, 100].map(n => `<button class="pill ${st.goal === n ? 'on' : ''}" data-k="goal" data-v="${n}">${n}問</button>`).join('')}</div></div>
    <div class="field"><span>カードの配合</span><div class="seg">${[['mix', 'バランス'], ['quiz', '問題多め'], ['learn', '解説多め']].map(([v, l]) => `<button class="pill ${st.ratio === v ? 'on' : ''}" data-k="ratio" data-v="${v}">${l}</button>`).join('')}</div></div>
    <div class="field"><span>文字サイズ</span><div class="seg">${[['15', '小'], ['17', '中'], ['19', '大']].map(([v, l]) => `<button class="pill ${String(st.fs) === v ? 'on' : ''}" data-k="fs" data-v="${v}">${l}</button>`).join('')}</div></div>
    <div class="field"><span>テーマ</span><div class="seg">${[['dark', 'ダーク'], ['light', 'ライト']].map(([v, l]) => `<button class="pill ${st.theme === v ? 'on' : ''}" data-k="theme" data-v="${v}">${l}</button>`).join('')}</div></div>
    <div class="field"><span>効果音</span><button class="toggle ${st.sound ? 'on' : ''}" data-k="sound"></button></div>
    <h3>データ</h3>
    <p>進捗はこの端末のブラウザに保存されます。ホーム画面に追加したアプリとSafariは別々に保存される点に注意。</p>
    <button class="btn" id="export">進捗をコピー（バックアップ）</button>
    <button class="btn" id="import" style="margin-top:8px">進捗を貼り付けて復元</button>
    <button class="btn danger" id="reset" style="margin-top:8px">進捗をリセット</button>
    <h3>このアプリ</h3>
    <p>収録: 解説 ${D.concepts.length} ・ 用語 ${D.terms.length} ・ 四肢択一 ${D.questions.length} ・ ○× ${D.tf.length}。全23中分類をカバー。データ版 ${D.version || '-'}。</p>
    <p>試験日 2026/11/07（あと${daysLeft()}日）。合格ラインは60%。</p>`;
  body.addEventListener('click', (e) => {
    const p = e.target.closest('[data-k]'); if (!p) return; const k = p.dataset.k;
    if (k === 'sound') { st.sound = !st.sound; p.classList.toggle('on', st.sound); }
    else { st[k] = isNaN(+p.dataset.v) ? p.dataset.v : +p.dataset.v; p.parentElement.querySelectorAll('.pill').forEach(x => x.classList.toggle('on', x === p)); }
    applySettings(); save();
  });
  $('#export').addEventListener('click', async () => { try { await navigator.clipboard.writeText(JSON.stringify(S)); toast('クリップボードにコピーしました'); } catch (e) { prompt('コピーしてください', JSON.stringify(S)); } });
  $('#import').addEventListener('click', () => { const t = prompt('バックアップ文字列を貼り付け'); if (!t) return; try { const o = JSON.parse(t); if (!o.items) throw 0; S = Object.assign(defaultState(), o); save(); location.reload(); } catch (e) { toast('読み込めませんでした'); } });
  $('#reset').addEventListener('click', () => { if (confirm('進捗をすべて消去しますか？')) { localStorage.removeItem(LS_KEY); location.reload(); } });
}
function applySettings() {
  document.documentElement.dataset.theme = S.settings.theme; document.documentElement.style.setProperty('--fs', S.settings.fs + 'px');
  $('meta[name="theme-color"]').content = S.settings.theme === 'light' ? '#f4f5f8' : '#0a0c10';
}

/* ---------------- keyboard (desktop testing) ---------------- */
document.addEventListener('keydown', (e) => {
  if (!sheet.hidden) { if (e.key === 'Escape') closeSheet(); return; }
  const card = feedEl.children[currentIndex()]; if (!card) return;
  if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'j') { e.preventDefault(); scrollNext(); }
  else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); feedEl.scrollTo({ top: (currentIndex() - 1) * feedEl.clientHeight, behavior: 'smooth' }); }
  else if ('1234'.includes(e.key) && e.key) { card.querySelectorAll('.choice')[+e.key - 1]?.click(); }
  else if (e.key === 'o') card.querySelector('.tf-btn[data-v="true"]')?.click();
  else if (e.key === 'x') card.querySelector('.tf-btn[data-v="false"]')?.click();
  else if (e.key === 'Enter') (card.querySelector('.act-flip') || card.querySelector('.act-next'))?.click();
});

/* ---------------- PWA ---------------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => { const nw = reg.installing; nw?.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) { toast('新しい版があります。再読み込みで更新', 4000); nw.postMessage('skipWaiting'); } }); });
    }).catch(() => {});
    let refreshing = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (refreshing) return; refreshing = true; });
  });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) hud(); });

/* ---------------- boot ---------------- */
applySettings(); hud(); startFeed();
window.AP = { S, D, startExam, startFeed, nextCards };
})();
