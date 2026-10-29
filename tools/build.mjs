// Merge content/*.json into data.js consumed by the app (no build framework needed).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const contentDir = path.join(root, 'content');
const categories = JSON.parse(fs.readFileSync(path.join(root, 'tools/categories.json'), 'utf8'));
const out = { categories, concepts: [], terms: [], questions: [], tf: [] };
for (const cat of categories) {
  const read = (suffix) => {
    const p = path.join(contentDir, `${cat.slug}.${suffix}.json`);
    if (!fs.existsSync(p)) { console.warn(`missing ${p}`); return {}; }
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  };
  const c = read('concepts'), q = read('questions');
  for (const x of c.concepts || []) out.concepts.push({ ...x, cat: cat.slug });
  for (const x of c.terms || []) out.terms.push({ ...x, cat: cat.slug });
  for (const x of q.questions || []) out.questions.push({ ...x, cat: cat.slug });
  for (const x of q.tf || []) out.tf.push({ ...x, cat: cat.slug });
}
const json = JSON.stringify(out);
const hash = crypto.createHash('sha1').update(json).digest('hex').slice(0, 10);
out.version = hash;
out.built = new Date().toISOString();
fs.writeFileSync(path.join(root, 'data.js'), `window.AP_DATA=${JSON.stringify(out)};\n`);
// stamp service worker cache version
const swPath = path.join(root, 'sw.js');
if (fs.existsSync(swPath)) {
  const sw = fs.readFileSync(swPath, 'utf8').replace(/const VERSION = '[^']*'/, `const VERSION = '${hash}'`);
  fs.writeFileSync(swPath, sw);
}
console.log(`data.js: concepts=${out.concepts.length} terms=${out.terms.length} questions=${out.questions.length} tf=${out.tf.length} version=${hash} size=${(json.length / 1024).toFixed(0)}KB`);
