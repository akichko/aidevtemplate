# Database Design

本書はSQLiteとSQL Serverで共有する論理スキーマを示す。識別子は両DBで整数として扱い、SQLiteでは `INTEGER PRIMARY KEY`、SQL Serverでは `BIGINT IDENTITY` とする。金額は円単位の整数とする。物理SQLの差分は各アダプターに閉じ込める。

| テーブル | 主な列 | 関連・制約 |
|---|---|---|
| accounts | `id`, `name`, `category` | `category` は `asset`, `liability`, `equity`, `profit`, `loss` のいずれか。 |
| subaccounts | `id`, `account_id`, `name` | `account_id` は `accounts.id` を参照。勘定科目ごとに0件以上。`(account_id, id)` を複合参照可能な一意キーとする。 |
| journal_entries | `id`, `entry_date`, `description`, `created_at` | 仕訳ヘッダー。仕訳明細を2件以上持つ。 |
| journal_lines | `id`, `journal_entry_id`, `account_id`, `subaccount_id`（NULL可）, `side`, `amount` | `journal_entry_id` と `account_id` は外部キー。`subaccount_id` は任意の補助科目参照。`(account_id, subaccount_id)` は `subaccounts(account_id, id)` を参照し、異なる勘定科目の補助科目を指定できない。`side` は `debit` / `credit`、`amount` は正の整数。 |

## 仕訳の変更・削除

- 仕訳変更時は、仕訳ヘッダーと全明細を同一トランザクションで更新し、変更後の借方・貸方一致を検証する。
- 仕訳削除は利用者の確認後にヘッダーと全明細を同一トランザクションで物理削除し、アプリケーションから復元できない（[ADR-003](../../architecture/decisions/ADR-003-journal-deletion.md)）。
- 監査証跡とバックアップ保持期間はOPEN-DOM-006で別途確認する。

## 未確定事項

補助科目を指定しない明細では `subaccount_id` をNULLとする。勘定科目・補助科目名の最大長と一意性、更新履歴、DBマイグレーション方式は未確定とする。
