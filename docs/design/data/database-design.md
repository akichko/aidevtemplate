# Database Design

本書はSQLiteとSQL Serverで共有する論理スキーマを示す。識別子は両DBで整数として扱い、SQLiteでは `INTEGER PRIMARY KEY`、SQL Serverでは `BIGINT IDENTITY` とする。金額は円単位の整数とする。物理SQLの差分は各アダプターに閉じ込める。

| テーブル | 主な列 | 関連・制約 |
|---|---|---|
| accounts | `id`, `name`, `category` | `category` は `asset`, `liability`, `equity`, `profit`, `loss` のいずれか。 |
| subaccounts | `id`, `account_id`, `name` | `account_id` は `accounts.id` を参照。勘定科目ごとに0件以上。 |
| journal_entries | `id`, `entry_date`, `description`, `created_at` | 仕訳ヘッダー。仕訳明細を2件以上持つ。 |
| journal_lines | `id`, `journal_entry_id`, `account_id`, `side`, `amount` | `journal_entry_id` と `account_id` は外部キー。`side` は `debit` / `credit`、`amount` は正の整数。 |

補助科目を仕訳明細へ記録するかは未確定のため、`journal_lines` に補助科目列は設けない。名前の最大長・一意性、更新履歴、論理削除、DBマイグレーション方式は未確定。借貸一致はアプリケーションのトランザクション内で検証してから保存する。
