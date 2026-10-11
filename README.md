# Web App AI Development Template

AI駆動Webアプリ開発用テンプレート。

## 開発フロー

Requirements → Architecture → Design → Implementation → Unit/Integration Test → Traceability

## 最初に読むもの

1. `AGENTS.md`
2. `docs/DEVELOPMENT-FLOW.md`
3. `docs/requirements/`

## 主なディレクトリ

```text
AGENTS.md
skills/
docs/
src/
tests/
infra/
scripts/
.github/
templates/
README.md
CHANGELOG.md
```

## ローカル開発

Node.js 22以降とnpmを使用する。リポジトリのルートで依存をインストールし、フロントエンドとAPIを起動する。

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

画面: <http://127.0.0.1:5173>
API: <http://127.0.0.1:3001/api/health>

開発時のDBはSQLiteで、`src/api/data/accounting.sqlite` に保存される。テストは `npm test`、本番向けビルドは `npm run build` で実行する。
