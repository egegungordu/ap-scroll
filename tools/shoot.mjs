// Screenshot driver: launches headless Chrome with CDP, emulates iPhone viewport, runs scripted steps.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL_ = process.argv[2] || 'http://localhost:4173/';
const OUT = process.argv[3] || 'C:/Users/Egg/AppData/Local/Temp/shots';
fs.mkdirSync(OUT, { recursive: true });
const port = 9333;
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, '--user-data-dir=' + OUT + '/profile', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, 'base64')); console.log('shot', name); };
try {
  let targets; for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://localhost:${port}/json`)).json(); break; } catch { await sleep(250); } }
  const page = targets.find(t => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id).res(d.result); pending.delete(d.id); } };
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await send('Network.enable'); await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: URL_ }); await sleep(1500);
  const steps = JSON.parse(fs.readFileSync(new URL('./shoot-steps.json', import.meta.url), 'utf8'));
  for (const s of steps) {
    if (s.eval) { const v = await evaluate(s.eval); if (s.log) console.log(s.log, v); }
    if (s.wait) await sleep(s.wait);
    if (s.shot) await shot(s.shot);
  }
} catch (e) { console.error(e); } finally { ws?.close(); chrome.kill(); }
