# Database Design

本書はSQLiteとSQL Serverで共有する論理スキーマを示す。識別子は両DBで整数として扱い、SQLiteでは `INTEGER PRIMARY KEY`、SQL Serverでは `BIGINT IDENTITY` とする。仕訳金額は円単位の整数とする。固定資産金額の通貨・精度はOPEN-DOM-010で確定する。物理SQLの差分は各アダプターに閉じ込める。

| テーブル | 主な列 | 関連・制約 |
|---|---|---|
| accounts | `id`, `system_key`（NULL可・一意）, `name`, `category`, `is_system` | `category` は `asset`, `liability`, `equity`, `profit`, `loss` のいずれか。固定資産勘定（`fixed_asset`）と減価償却費勘定（`depreciation_expense`）は専用system keyを持つ初期行で、削除不可。 |
| subaccounts | `id`, `account_id`, `name` | `account_id` は `accounts.id` を参照。勘定科目ごとに0件以上。通常勘定科目で使用する補助科目。 |
| fixed_assets | `id`, `name`, `acquisition_date`, `acquisition_price`, `depreciation_method`, `useful_life`, `residual_value`, `depreciation_start_date` | 固定資産管理モジュールが所有する。識別子以外の必須条件・値域・通貨・単位はOPEN-DOM-009～011で確定する。 |
| journal_entries | `id`, `entry_date`, `description`, `created_at` | 仕訳ヘッダー。仕訳明細を2件以上持つ。 |
| journal_lines | `id`, `journal_entry_id`, `account_id`, `subaccount_id`（NULL可）, `side`, `amount` | `account_id`は常に`accounts.id`を参照。通常勘定科目では`subaccount_id`はNULLまたは同じ勘定科目に属する補助科目ID。`system_key=fixed_asset`の勘定科目では`subaccount_id`に固定資産IDを保存し、固定資産候補照会ポートで存在確認する。 |

### 仕訳明細の参照制約

- `account_id`はすべての仕訳明細で必須とする。固定資産勘定も勘定科目マスタの初期データとして存在する。
- `subaccount_id`がNULLでない場合、親勘定科目の`system_key`で参照先を切り替える。`fixed_asset`では固定資産ID、その他では当該勘定科目に属する補助科目IDとして解釈する。
- 固定資産IDの存在確認は固定資産候補照会ポートに委譲する。補助科目IDとの値衝突は親勘定科目の`system_key`で区別する（ADR-004）。
- 初期勘定科目の`system_key`は一意かつ変更不可とし、アプリケーションはsystem keyで保護動作を判定する。

### 既存仕訳スキーマからの移行

- 既存の通常勘定科目明細は`account_id`を保持し、通常勘定科目形式として解釈できる状態を維持する。
- 固定資産勘定と減価償却費勘定の初期データを冪等に追加する。`subaccount_id`列は追加変更せず、固定資産勘定の明細では固定資産IDを保存する。
- `accounts`に専用`system_key`と`is_system`を保持する。既存勘定科目と仕訳を保持し、既存IDとの衝突を避ける初期データ投入方式はインフラ詳細設計で定義する。

## 仕訳の変更・削除

- 仕訳変更時は、仕訳ヘッダーと全明細を同一トランザクションで更新し、変更後の借方・貸方一致を検証する。
- 仕訳削除は利用者の確認後にヘッダーと全明細を同一トランザクションで物理削除し、アプリケーションから復元できない（[ADR-003](../../architecture/decisions/ADR-003-journal-deletion.md)）。
- 監査証跡とバックアップ保持期間はOPEN-DOM-006で別途確認する。

## 未確定事項

補助科目を指定しない明細では `subaccount_id` をNULLとする。勘定科目・補助科目名の最大長と一意性、更新履歴、DBマイグレーション方式は未確定とする。
