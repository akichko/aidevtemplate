# API設計

| ID | メソッド | パス | 目的 | 関連 |
|---|---|---|---|---|
| API-001 | GET | `/api/accounts` | 勘定科目一覧取得。`category`による絞り込みに対応し、初期勘定の`systemKey`と`isSystem`を返す。 | REQ-F-004、REQ-F-006、REQ-F-016 |
| API-002 | GET | `/api/accounts/{accountId}` | 勘定科目と通常補助科目一覧を取得する。固定資産勘定を含む。 | REQ-F-005、REQ-F-006、REQ-F-012、REQ-F-016 |
| API-003 | POST | `/api/accounts` | 勘定科目登録。 | REQ-F-004、REQ-F-006 |
| API-004 | PUT | `/api/accounts/{accountId}` | 勘定科目変更。 | REQ-F-006 |
| API-005 | POST | `/api/accounts/{accountId}/subaccounts` | 補助科目登録。 | REQ-F-005、REQ-F-007 |
| API-006 | PUT | `/api/accounts/{accountId}/subaccounts/{subaccountId}` | 補助科目変更。 | REQ-F-007 |
| API-007 | GET | `/api/journals?month=YYYY-MM` | 必須の対象年月に登録された仕訳一覧取得。 | REQ-F-008 |
| API-008 | POST | `/api/journals` | 貸借一致と、勘定科目のsystem keyに応じた`subaccountId`参照整合性を検証して仕訳を新規登録。 | REQ-F-001、REQ-F-009、REQ-F-012、REQ-F-015、REQ-F-016 |
| API-013 | GET | `/api/journals/{journalId}` | 編集対象の仕訳と明細（通常補助科目IDまたは固定資産IDを`subaccountId`として含む）を取得。 | REQ-F-010、REQ-F-012、REQ-F-015、REQ-F-016 |
| API-011 | PUT | `/api/journals/{journalId}` | 貸借一致と、勘定科目のsystem keyに応じた`subaccountId`参照整合性を検証して既存仕訳を変更。 | REQ-F-010、REQ-F-012、REQ-F-015、REQ-F-016 |
| API-012 | DELETE | `/api/journals/{journalId}` | 確認後に仕訳と明細を物理削除。 | REQ-F-011 |
| API-014 | GET | `/api/fixed-assets` | 固定資産一覧取得。 | REQ-F-013、REQ-F-014 |
| API-015 | POST | `/api/fixed-assets` | 固定資産登録。 | REQ-F-013、REQ-F-014 |
| API-016 | GET | `/api/fixed-assets/{fixedAssetId}` | 固定資産詳細取得。 | REQ-F-013、REQ-F-014 |
| API-017 | PUT | `/api/fixed-assets/{fixedAssetId}` | 固定資産変更。 | REQ-F-013、REQ-F-014 |
| API-018 | GET | `/api/fixed-assets/journal-options` | 固定資産勘定の仕訳明細で選択する固定資産候補を取得。応答のIDを仕訳明細の`subaccountId`へ設定する。 | REQ-F-015、REQ-F-016 |
| API-009 | GET | `/api/reports/balance-sheet` | 基準日を指定した貸借対照表取得。 | REQ-F-002 |
| API-010 | GET | `/api/reports/income-statement` | 期間を指定した損益計算書取得。 | REQ-F-003 |

エラー応答は `{ "error": { "code": "...", "message": "..." } }` とする。API仕様と[OpenAPI](openapi.yaml)を整合させる。

`/api/fixed-assets/journal-options`のような固定パスは、`/api/fixed-assets/{fixedAssetId}`の動的パスより先にルーティングする。
