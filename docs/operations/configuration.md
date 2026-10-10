# 構成設定

| 設定名 | 用途 | 必須 | 秘密情報 |
|---|---|---|---|
| `MSSQL_SA_PASSWORD`（`infra/.env`） | ローカル開発用SQL Serverの `sa` ログインパスワード | はい | はい |

`infra/.env.example` をコピーして `infra/.env` を作成する。SQL Serverのパスワード複雑性要件を満たす強力なパスワードを設定し、`infra/.env` をコミットしないこと。
