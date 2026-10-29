import fs from 'node:fs';
import path from 'node:path';
const dir = path.resolve(process.argv[2] || 'content');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
let errors = 0, warn = 0;
const stats = {};
const err = (f, m) => { errors++; console.log(`ERROR ${f}: ${m}`); };
const wrn = (f, m) => { warn++; console.log(`warn  ${f}: ${m}`); };
const conceptIds = {};
for (const f of files) {
  let data;
  try { data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); }
  catch (e) { err(f, 'invalid JSON: ' + e.message); continue; }
  const slug = f.split('.')[0];
  if (data.slug !== slug) err(f, `slug mismatch: ${data.slug} vs ${slug}`);
  stats[slug] ??= { concepts: 0, terms: 0, questions: 0, tf: 0 };
  const seen = new Set();
  const chk = (arr, kind, letter, fn) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((it, i) => {
      const where = `${kind}[${i}] ${it.id || ''}`;
      if (!it.id || !new RegExp(`^${slug}-${letter}\\d{3}$`).test(it.id)) err(f, `${where}: bad id`);
      if (seen.has(it.id)) err(f, `${where}: duplicate id`);
      seen.add(it.id);
      fn(it, where);
    });
    stats[slug][kind] += arr.length;
  };
  if (f.endsWith('.concepts.json')) {
    chk(data.concepts, 'concepts', 'c', (c, w) => {
      for (const k of ['sub', 'title', 'body']) if (typeof c[k] !== 'string' || !c[k].trim()) err(f, `${w}: missing ${k}`);
      if (!Array.isArray(c.points) || c.points.length < 1) err(f, `${w}: points missing`);
      if (c.body && c.body.length < 40) wrn(f, `${w}: body very short`);
      if (/<[a-z]+>/i.test(c.body || '')) err(f, `${w}: HTML in body`);
      conceptIds[c.id] = true;
    });
    chk(data.terms, 'terms', 't', (t, w) => {
      if (!t.term || !t.def) err(f, `${w}: term/def missing`);
    });
  } else if (f.endsWith('.questions.json')) {
    const dist = [0, 0, 0, 0];
    chk(data.questions, 'questions', 'q', (q, w) => {
      if (!q.q || typeof q.q !== 'string') err(f, `${w}: q missing`);
      if (!Array.isArray(q.choices) || q.choices.length !== 4) err(f, `${w}: need 4 choices`);
      else if (q.choices.some(c => typeof c !== 'string' || !c.trim())) err(f, `${w}: empty choice`);
      else if (new Set(q.choices).size !== 4) err(f, `${w}: duplicate choices`);
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) err(f, `${w}: bad answer`);
      else dist[q.answer]++;
      if (!q.explanation || q.explanation.length < 20) err(f, `${w}: explanation missing/short`);
      if (![1, 2, 3].includes(q.difficulty)) err(f, `${w}: difficulty must be 1-3`);
      if (!q.sub) err(f, `${w}: sub missing`);
      if (q.choices && q.choices.some(c => /^[アイウエ][\s.．:：、]/.test(c))) wrn(f, `${w}: choice starts with ア/イ/ウ/エ label`);
    });
    chk(data.tf, 'tf', 'x', (t, w) => {
      if (!t.s) err(f, `${w}: s missing`);
      if (typeof t.answer !== 'boolean') err(f, `${w}: answer must be boolean`);
      if (!t.explanation) err(f, `${w}: explanation missing`);
    });
    const n = dist.reduce((a, b) => a + b, 0);
    if (n >= 12) {
      const max = Math.max(...dist), min = Math.min(...dist);
      if (max > n * 0.4 || min < n * 0.12) wrn(f, `answer distribution skewed: ${dist.join('/')}`);
    }
  }
}
// cross-check concept refs
for (const f of files.filter(f => f.endsWith('.questions.json'))) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const q of data.questions || []) if (q.concept && !conceptIds[q.concept]) wrn(f, `${q.id}: concept ref ${q.concept} not found`);
}
console.log('\nSTATS');
let T = { concepts: 0, terms: 0, questions: 0, tf: 0 };
for (const [s, v] of Object.entries(stats)) { console.log(`${s.padEnd(16)} c=${v.concepts} t=${v.terms} q=${v.questions} x=${v.tf}`); for (const k in T) T[k] += v[k]; }
console.log(`TOTAL            c=${T.concepts} t=${T.terms} q=${T.questions} x=${T.tf}`);
console.log(`\n${errors} errors, ${warn} warnings`);
process.exit(errors ? 1 : 0);
