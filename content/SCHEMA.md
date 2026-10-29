# コンテンツスキーマ（応用情報 科目A ドゥームスクロール学習アプリ）

1中分類につき2ファイル。ファイル名は `content/<slug>.concepts.json` と `content/<slug>.questions.json`。
すべてUTF-8のJSON。コメント不可。末尾カンマ不可。

## <slug>.concepts.json
```json
{
  "slug": "security",
  "concepts": [
    {
      "id": "security-c001",
      "sub": "情報セキュリティ",
      "title": "公開鍵暗号方式",
      "body": "2〜5文の本文。改行は \n。平易だが試験レベルの正確さ。",
      "points": ["要点1（短く）", "要点2", "要点3"],
      "tip": "試験での狙われ方・ひっかけ・覚え方（1〜2文）。任意だが推奨。",
      "formula": "任意。公式がある場合のみ。例: 稼働率 = MTBF / (MTBF + MTTR)"
    }
  ],
  "terms": [
    { "id": "security-t001", "term": "XSS", "def": "1〜2文の簡潔な定義（用語フラッシュカード用）" }
  ]
}
```

## <slug>.questions.json
```json
{
  "slug": "security",
  "questions": [
    {
      "id": "security-q001",
      "sub": "情報セキュリティ",
      "concept": "security-c001",
      "q": "問題文。『〜はどれか。』形式が基本。計算問題もOK。改行は \n。",
      "choices": ["選択肢ア", "選択肢イ", "選択肢ウ", "選択肢エ"],
      "answer": 2,
      "explanation": "正解の理由と、他の選択肢が誤りである理由を簡潔に。3〜6文。",
      "difficulty": 2
    }
  ],
  "tf": [
    { "id": "security-x001", "s": "○×で判定する命題文。", "answer": false, "explanation": "1〜3文。" }
  ]
}
```

## ルール
- `id` はファイル内で一意、形式は `<slug>-c###` / `<slug>-t###` / `<slug>-q###` / `<slug>-x###`（3桁ゼロ埋め）。
- `choices` は必ず4つ。`answer` は 0〜3 のインデックス。正解位置は均等にばらす（0,1,2,3 がそれぞれ約25%）。
- `difficulty` は 1（基本）/2（標準）/3（応用）。
- `concept` は同じslugのconceptsに存在するidを指す（任意だが推奨）。
- 問題は過去問の丸写し禁止。頻出論点を踏まえたオリジナル問題にする。
- 計算問題では数値を必ず検算する。
- すべて日本語。選択肢に「ア」「イ」等の記号を含めない（アプリ側で付与）。
- 文中にHTMLは使わない。強調したい語は【】で囲んでもよい。
- `sub` はIPA試験要綱の小分類名を使う。
