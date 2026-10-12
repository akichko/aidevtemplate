# 単体テスト方針

## 対象

- ドメイン: 仕訳入力検証（補助科目IDを含む）、年月検証、貸借一致、貸借対照表・損益計算書の計算。
- アプリケーション: 月別一覧、仕訳登録・編集・削除のユースケースと入力検証。
- リポジトリ: SQLiteのCRUD、月境界検索、明細とのトランザクション、補助科目の保存・親子制約・既存DB移行、削除後の集計除外。

## ケース設計

- 正常系、境界値、異常系、対象なし、更新後の状態を確認する。
- 日付・年月、金額、仕訳明細、借貸一致、年月境界を個別に検証する。
- 金額は円単位の整数、テスト日付は固定値を用いる。
- SQLiteリポジトリテストはインメモリDBを使い、テスト間でデータを共有しない。
- 仕訳の編集・削除テストでは、明細を含めたトランザクション結果と財務諸表への反映を検証する。

## 実行

リポジトリルートから `npm test` を実行する。テストコードは現状、対象APIソースの近くに配置している。

| 仕様書 | 対象コード | テスト数 |
|---|---|---:|
| [UT-001 会計ドメイン](UT-001-accounting-domain.md) | `src/api/src/domain/accounting.test.ts` | 12 |
| [UT-002 SQLiteリポジトリ](UT-002-sqlite-repository.md) | `src/api/src/infrastructure/sqlite-repository.test.ts` | 4 |
| [UT-003 アプリケーションサービス](UT-003-accounting-service.md) | `src/api/src/application/accounting-service.test.ts` | 2 |

実装済み単体テストは合計18件。結合テストは[IT-001](../integration/IT-001-accounting-workflow.md)で設計し、自動化は未実装。
