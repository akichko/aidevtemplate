# 構成設定

| 設定名 | 用途 | 必須 | 秘密情報 |
|---|---|---|---|
| `PORT` | Express APIの待受ポート | いいえ（既定: 3001） | いいえ |
| `DB_PROVIDER` | 使用するDBアダプター（`sqlite` / `sqlserver`） | いいえ（既定: `sqlite`） | いいえ |
| `SQLITE_PATH` | SQLiteファイルのパス（APIワークスペースの作業ディレクトリ基準） | いいえ（既定: `./data/accounting.sqlite`） | いいえ |
| `SQLSERVER_HOST` | SQL Serverホスト名 | SQL Server利用時は必須 | いいえ |
| `SQLSERVER_PORT` | SQL Serverポート | いいえ（既定: 1433） | いいえ |
| `SQLSERVER_DATABASE` | SQL Serverデータベース名 | SQL Server利用時は必須 | いいえ |
| `SQLSERVER_USER` | SQL Server接続ユーザー | SQL Server利用時は必須 | はい |
| `SQLSERVER_PASSWORD` | SQL Server接続パスワード | SQL Server利用時は必須 | はい |
| `SQLSERVER_ENCRYPT` | SQL Server接続の暗号化 | いいえ（既定: 有効） | いいえ |
| `SQLSERVER_TRUST_CERT` | SQL Server証明書を信頼する開発用設定 | いいえ（既定: 無効） | いいえ |

設定する場合は `.env.example` を `.env` にコピーし、必要な値を設定する。`.env` はGit管理対象外とする。プロセス環境変数が設定されている場合は `.env` より優先する。SQL Serverの接続秘密情報をコミットしないこと。SQLiteファイルはローカルデータとしてGit管理対象外とする。
