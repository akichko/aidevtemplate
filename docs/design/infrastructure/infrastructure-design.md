# インフラ設計

| リソース | 目的 | 環境 |
|---|---|---|
| Docker Compose | ローカル開発サービスの起動・管理 | 開発 |
| SQL Server 2022 Developer エディション（コンテナー） | 開発用データベース | 開発 |
| Docker 名前付きボリューム（`sqlserver-data`） | コンテナー再起動後もデータベースファイルを保持 | 開発 |
| Azure Static Web Apps | Webホスティング（配置の詳細は未確定） | 本番（想定） |

## ローカル開発用データベース

開発用データベースは、SQL Server 2022 Developer イメージを使ってDocker Composeで起動する。接続ポートは `127.0.0.1:1433` のみに公開し、データは名前付きボリューム `sqlserver-data` に保持する。データベースやスキーマの初期化は行わない。

1. `infra/.env.example` を `infra/.env` にコピーし、仮の値を十分に強いSQL ServerのSAパスワードに置き換える。
2. リポジトリのルートでデータベースを起動する。

	```powershell
	docker compose -f infra/docker-compose.yml up -d
	```

3. `infra/.env` に設定したパスワードを使い、ユーザー `sa`、接続先 `localhost,1433` で接続する。
4. データベースファイルを保持したままコンテナーを停止する。

	```powershell
	docker compose -f infra/docker-compose.yml down
	```

`infra/.env` はGitの追跡対象外とする。名前付きボリュームを削除するとローカルのデータベースデータも削除される。上記の停止コマンドではボリュームは削除されない。
