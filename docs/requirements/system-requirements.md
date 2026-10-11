# システム要件

## 技術要件

| 対象 | 想定 | 状態・備考 |
|---|---|---|
| フロントエンド | Vue 3、Vite、TypeScript | 採用決定。 |
| API | Node.js、Express、TypeScript | 採用決定。 |
| テストツール | Playwright | 採用予定。自動化範囲は別途定義する。 |

## 環境要件

| 環境 | 想定 | 状態・備考 |
|---|---|---|
| 開発 | SQLite | ローカルファイルに保存する。APIからアダプター経由で利用する。 |
| 本番 | SQL Server | SQLiteと共通のリポジトリインターフェースを使う。接続情報は環境設定から与える。SQL Serverのバージョンと配置先は未確定。 |
| 本番 | Azure Static Web Apps | 配置先の想定。Azureサービスの詳細、プラン、構成は後続で検討する。 |

## 未確定事項

- 本番環境でのAPIおよびSQL Serverの配置先、認証方式。
- SQL Serverのバージョン。
- Node.jsのサポート対象バージョンとパッケージのバージョン更新方針。
- Playwrightで自動化するテストの範囲と実行環境。
- 仕訳明細で補助科目を選択できるか。

データベースの選択と共通インターフェースは [ADR-001](../architecture/decisions/ADR-001-database-adapters.md) を参照する。Azureの詳細設計は本書の対象外とする。