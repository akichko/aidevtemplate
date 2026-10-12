# ER図

以下はドメイン要件から導いた論理ER図であり、物理テーブルや列定義を確定するものではない。固定資産IDは固定資産勘定が選択された仕訳明細のsubaccountId欄で扱う。

```mermaid
erDiagram
    JOURNAL ||--|{ JOURNAL_LINE : "複数の明細で構成する"
    ACCOUNT ||--o{ JOURNAL_LINE : "全明細で参照される"
    ACCOUNT ||--o{ SUBACCOUNT : "内訳を持つ"
    SUBACCOUNT o|--o{ JOURNAL_LINE : "通常勘定科目のsubaccountId"
    FIXED_ASSET o|--o{ JOURNAL_LINE : "固定資産勘定のsubaccountId"
```

仕訳明細を共通構造とし、借方・貸方ごとに別テーブルを設けない。すべての明細はACCOUNTを参照する。ACCOUNTのsystem_keyが固定資産勘定を示す場合、subaccountIdはFIXED_ASSETのIDを表し、それ以外の場合は親ACCOUNTに属するSUBACCOUNTのIDを表す。FIXED_ASSETは固定資産管理コンテキストが所有し、両関係とも論理参照でありDB外部キーを意味しない。貸借対照表では固定資産勘定残高を合算し、資産別の個別表示切替はOPEN-DOM-015を参照する。
