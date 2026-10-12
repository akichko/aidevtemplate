# API設計

| ID | メソッド | パス | 目的 | 関連 |
|---|---|---|---|---|
| API-001 | GET | `/api/accounts` | 勘定科目一覧取得。`category` による絞り込みに対応する。 | REQ-F-004、REQ-F-006 |
| API-002 | GET | `/api/accounts/{accountId}` | 勘定科目と補助科目一覧の取得。 | REQ-F-005、REQ-F-006 |
| API-003 | POST | `/api/accounts` | 勘定科目登録。 | REQ-F-004、REQ-F-006 |
| API-004 | PUT | `/api/accounts/{accountId}` | 勘定科目変更。 | REQ-F-006 |
| API-005 | POST | `/api/accounts/{accountId}/subaccounts` | 補助科目登録。 | REQ-F-005、REQ-F-007 |
| API-006 | PUT | `/api/accounts/{accountId}/subaccounts/{subaccountId}` | 補助科目変更。 | REQ-F-007 |
| API-007 | GET | `/api/journals?month=YYYY-MM` | 必須の対象年月に登録された仕訳一覧取得。 | REQ-F-008 |
| API-008 | POST | `/api/journals` | 貸借一致を検証して仕訳を新規登録。 | REQ-F-001、REQ-F-009 |
| API-013 | GET | `/api/journals/{journalId}` | 編集対象の仕訳と明細を取得。 | REQ-F-010 |
| API-011 | PUT | `/api/journals/{journalId}` | 貸借一致を検証して既存仕訳を変更。 | REQ-F-010 |
| API-012 | DELETE | `/api/journals/{journalId}` | 確認後に仕訳と明細を物理削除。 | REQ-F-011 |
| API-009 | GET | `/api/reports/balance-sheet` | 基準日を指定した貸借対照表取得。 | REQ-F-002 |
| API-010 | GET | `/api/reports/income-statement` | 期間を指定した損益計算書取得。 | REQ-F-003 |

エラー応答は `{ "error": { "code": "...", "message": "..." } }` とする。API契約と[OpenAPI](openapi.yaml)を整合させる。
