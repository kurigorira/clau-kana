# 花奈の問題集 🌸

栗原花奈さん（予備校生）の受験勉強用の問題集サイトです。
**英語・国語・社会**の問題を「一問一答・暗記カード」形式で学習できます。

- 採点・正答率の表示
- 間違えた問題だけの復習モード
- 学習進捗の保存（ブラウザ内 `localStorage`・ログイン不要）
- 出題のシャッフル
- スマホ・PC 両対応

## 公開URL

GitHub Pages: **https://kurigorira.github.io/clau-kana/**

## 使い方

1. ホームで科目（英語／国語／社会）を選ぶ
2. 章（デッキ）を選び、**📝 テスト** か **🃏 暗記カード** を選ぶ
3. テストでは答えを思い出してから「答えを見る」→ 自分で ⭕/❌ を記録
4. 終了時に正答率が出る。間違えた問題は「🔁 復習」でまとめて解き直せる

## 技術構成

ビルド不要の静的サイト（素の HTML / CSS / JavaScript）。

```
index.html              アプリ本体（1ページSPA）
css/styles.css          スタイル
js/storage.js           進捗の保存（localStorage）
js/data.js              問題データの読み込み
js/app.js               画面描画・学習ロジック
data/manifest.json      科目一覧
data/english.json       英語の問題
data/japanese.json      国語の問題
data/society.json       社会の問題
assets/images/          写真問題用の画像
```

## 問題の追加方法

問題（テキスト・写真・PDF）を送っていただければ、こちらでデータに登録します。
ご自身で追加する場合のデータ形式は [`docs/問題の追加方法.md`](docs/問題の追加方法.md) を参照してください。

## 公開（初回のみの設定）

GitHub Actions による自動デプロイを設定済みです（`.github/workflows/pages.yml`）。
初回だけ、リポジトリの **Settings → Pages → Build and deployment → Source** を
**「GitHub Actions」** に設定してください。以降は `main` ブランチへの push で自動公開されます。

## ローカルで確認する

```bash
python3 -m http.server 8000
# ブラウザで http://localhost:8000/ を開く
```
