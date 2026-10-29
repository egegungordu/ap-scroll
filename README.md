# APスクロール — 応用情報技術者試験 科目A ドゥームスクロール学習アプリ

縦スワイプのフィードで、解説カード・四肢択一・○×・用語カードが本試験の分野配分で流れてくる PWA。
iPhone の Safari で開き、共有 → 「ホーム画面に追加」で全画面アプリとして使えます。オフライン動作。

- `index.html` / `app.js` / `styles.css` — アプリ本体（ビルド不要の素の HTML/JS）
- `content/*.json` — 教材データ（23中分類 × concepts/questions）。`content/SCHEMA.md` 参照
- `tools/build.mjs` — `content/` を `data.js` に束ねる（`node tools/build.mjs`）
- `tools/validate.mjs` — 教材データの検証（`node tools/validate.mjs content`）
- `tools/serve.mjs` — ローカル確認用サーバ（`node tools/serve.mjs` → http://localhost:4173）

進捗は端末の localStorage に保存されます。
